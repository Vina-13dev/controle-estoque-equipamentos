import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  FileText,
  Users,
  Wrench,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Search,
  Menu,
  X,
  Download,
  Image as ImageIcon,
  Save,
  Trash2,
  Shield,
  UserPlus,
  History,
  Play,
  Ban,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  ArrowRightLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './style.css';

const CID = 'loqmais';
const STOCK_VERSION = 2;

const baseTerms = `1. O locatário declara receber os equipamentos em condições de uso e se responsabiliza por sua guarda e conservação durante o período da locação.
2. Danos decorrentes de mau uso, perda ou extravio poderão ser cobrados do locatário após avaliação.
3. A devolução após a data acordada poderá gerar cobrança adicional conforme o período excedente.
4. O equipamento deverá ser utilizado exclusivamente para sua finalidade e respeitando as orientações de segurança do fabricante.
5. Valores de transporte, caução, combustível, limpeza ou outros serviços somente serão cobrados quando informados na locação.
6. As condições específicas registradas no orçamento ou na locação integram este contrato.`;

const nav = [
  ['Dashboard', LayoutDashboard],
  ['Equipamentos', Package],
  ['Locações', CalendarDays],
  ['Mesas e Cadeiras', Package],
  ['Orçamentos', FileText],
  ['Clientes', Users],
  ['Manutenção', Wrench],
  ['Relatórios', BarChart3],
  ['Configurações', Settings]
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localISO(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const today = () => localISO(new Date());

function dateBR(v) {
  if (!v) return '';
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(v);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('pt-BR');
}

function daysBetween(a, b) {
  if (!a || !b) return 1;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const start = new Date(ay, am - 1, ad, 12, 0, 0);
  const end = new Date(by, bm - 1, bd, 12, 0, 0);
  const diff = Math.ceil((end - start) / 86400000);
  return Math.max(1, diff);
}

function addDaysISO(dateStr, amount) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + Number(amount || 0));
  return localISO(dt);
}

// A locação usa o intervalo [retirada, devolução): o dia da devolução não é cobrado.
function weekendDaysBetween(start, due) {
  if (!start || !due || due < start) return 0;
  const [y,m,d] = start.split('-').map(Number);
  const begin = new Date(Date.UTC(y,m-1,d));
  const count = daysBetween(start,due);
  let weekend = 0;
  for (let i=0;i<count;i++) {
    const day = new Date(begin.getTime()+i*86400000).getUTCDay();
    if (day===0 || day===6) weekend++;
  }
  return weekend;
}
function furniturePriceBreakdown(start,due,games,tables,chairs,stock,gameOverride=null) {
  const days=daysBetween(start,due), weekend=weekendDaysBetween(start,due);
  const regular=Number(stock.gameRate||0), special=Number(stock.weekendGameRate??regular);
  const weekendEnabled=stock.weekendGameRate!==undefined && stock.weekendGameRate!==null;
  const defaultGameTotal=(days-weekend)*regular+weekend*(weekendEnabled?special:regular);
  const gameUnitTotal=gameOverride===null?defaultGameTotal:Number(gameOverride||0)*days;
  const gameSubtotal=Math.max(0,Number(games||0))*gameUnitTotal;
  const tableSubtotal=Math.max(0,Number(tables||0))*Number(stock.tableRate||0)*days;
  const chairSubtotal=Math.max(0,Number(chairs||0))*Number(stock.chairRate||0)*days;
  return {days,weekend,gameSubtotal,tableSubtotal,chairSubtotal,subtotal:gameSubtotal+tableSubtotal+chairSubtotal,gameUnitTotal};
}
function editRentalPaymentState(total,paid) {
  const balance=Math.max(0,Number(total||0)-Number(paid||0));
  return {balance,paymentStatus:balance<=0.001?'Pago':Number(paid||0)>0?'Parcial':'Pendente'};
}
// Edição documental: mantém os itens e quantidades físicas originais para não
// alterar o estoque por acidente. O preço total dos itens é editável por linha.
function EditRentalModal({ rental, user, close, furniture=false }) {
  const [saving,setSaving]=useState(false);
  const [start,setStart]=useState(rental.start||today());
  const [due,setDue]=useState(rental.due||today());
  const [clientName,setClientName]=useState(rental.clientName||'');
  const [clientPhone,setClientPhone]=useState(rental.clientPhone||'');
  const [clientDocument,setClientDocument]=useState(rental.clientDocument||'');
  const [lineTotals,setLineTotals]=useState((rental.items||[]).map(i=>Number(i.subtotal||0)));
  const [freight,setFreight]=useState(Number(rental.freight??rental.delivery??0));
  const [addition,setAddition]=useState(Number(rental.addition||0));
  const [discountType,setDiscountType]=useState(rental.discountType||'money');
  const [discountInput,setDiscountInput]=useState(Number(rental.discountInput??rental.discount??0));
  const subtotal=lineTotals.reduce((a,b)=>a+Math.max(0,Number(b||0)),0);
  const discount=discountType==='percent'?subtotal*Math.min(100,Math.max(0,Number(discountInput||0)))/100:Math.max(0,Number(discountInput||0));
  const total=Math.max(0,subtotal+Number(freight||0)+Number(addition||0)-discount);
  const paid=Number(rental.paidAmount||0);
  async function save(e) {
    e.preventDefault();
    if(!clientName.trim())return alert('Informe o nome do cliente.');
    if(!isValidPeriod(start,due))return alert('A devolução não pode ser anterior à retirada.');
    if(total+0.001<paid)return alert('O novo total é menor que os pagamentos já registrados. Corrija o valor antes de salvar; pagamentos anteriores não serão apagados.');
    if(!window.confirm('Salvar a correção desta locação? O estoque e o histórico de pagamentos serão preservados.'))return;
    setSaving(true);
    const ref=doc(db,'companies',CID,'rentals',rental.id);
    try {
      await runTransaction(db,async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists())throw new Error('NOT_FOUND');
        const live=snap.data();
        const livePaid=Number(live.paidAmount||0);
        if(total+0.001<livePaid)throw new Error('PAID_OVER_TOTAL');
        if((live.items||[]).length!==lineTotals.length)throw new Error('ITEMS_CHANGED');
        const newDays=daysBetween(start,due);
        const items=(live.items||[]).map((i,index)=>{
          const amount=Math.max(0,Number(lineTotals[index]||0));
          const qty=Math.max(1,Number(i.qty||1));
          const rate=amount/(qty*(i.pricing==='daily'?newDays:1));
          return {...i,subtotal:amount,days:newDays,...(i.pricing==='daily'?{daily:rate,rate}: {rate})};
        });
        const before={start:live.start,due:live.due,clientName:live.clientName,total:live.total??live.value};
        tx.update(ref,{start,due,days:newDays,clientName:clientName.trim(),clientPhone:clientPhone.trim(),clientDocument:clientDocument.trim(),items,subtotal,freight:Number(freight||0),delivery:Number(freight||0),addition:Number(addition||0),discountType,discountInput:Number(discountInput||0),discount,total,value:total,...editRentalPaymentState(total,livePaid),lastCorrection:{date:today(),by:user.uid,before},updatedAt:serverTimestamp()});
      });
      await logAudit(user,'rental_corrected','rental',rental.id,{number:rental.number,start,due,total,furniture});
      close();
    } catch(err) {console.error(err);alert(err.message==='PAID_OVER_TOTAL'?'Há pagamentos superiores ao novo total.':err.message==='ITEMS_CHANGED'?'A locação foi alterada em outra sessão. Reabra e tente novamente.':'Não foi possível salvar a correção.');}
    finally{setSaving(false)}
  }
  return <Modal title={`Editar locação — ${rental.number||''}`} close={close} wide><form className="form grid2" onSubmit={save}>
    <div className="full note">É possível corrigir dados, datas e valores mesmo depois da emissão do contrato. Quantidades físicas e itens não são alterados aqui, para preservar o estoque. Pagamentos registrados são mantidos.</div>
    <InputControlled l="Nome do cliente" value={clientName} onChange={setClientName}/><InputControlled l="Telefone" value={clientPhone} onChange={setClientPhone}/>
    <InputControlled l="CPF/CNPJ" value={clientDocument} onChange={setClientDocument}/><div/>
    <InputControlled l="Data de retirada" type="date" value={start} onChange={setStart}/><InputControlled l="Previsão de devolução" type="date" min={start} value={due} onChange={setDue}/>
    {(rental.items||[]).map((i,index)=><div className="full" key={index}><MoneyControlled l={`Valor total dos itens: ${i.description||i.name||'Item '+(index+1)} (${i.qty||1} un.)`} value={lineTotals[index]||0} onChange={v=>setLineTotals(a=>a.map((x,k)=>k===index?v:x))}/></div>)}
    <MoneyControlled l="Frete" value={freight} onChange={setFreight}/><MoneyControlled l="Acréscimo" value={addition} onChange={setAddition}/>
    <SelectControlled l="Desconto em" value={discountType} onChange={setDiscountType} opts={[["money","Reais (R$)"],["percent","Porcentagem (%)"]]}/>{discountType==='percent'?<InputControlled l="Desconto (%)" type="number" min="0" max="100" step="0.01" value={discountInput} onChange={setDiscountInput}/>:<MoneyControlled l="Desconto (R$)" value={discountInput} onChange={setDiscountInput}/>}
    <div className="full rentalGrandTotal"><span>Subtotal <b>{money(subtotal)}</b></span><span>Já recebido <b>{money(paid)}</b></span><strong>Total corrigido: {money(total)}</strong><span>Saldo após correção <b>{money(Math.max(0,total-paid))}</b></span></div>
    <button className="primary" disabled={saving}><Save/> {saving?'Salvando...':'Salvar correções'}</button>
  </form></Modal>;
}

function isValidPeriod(start, due) {
  return Boolean(start && due && due >= start);
}

function money(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoney(v) {
  let x = String(v ?? '').replace(/[^0-9,.-]/g, '').trim();
  if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

function userEmail(username) {
  return `${String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@loqmais.local`;
}

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

function compactText(v) {
  return String(v || '').trim().toLowerCase();
}

function tsMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return Number(v.seconds) * 1000;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sortNewest(rows) {
  return [...rows].sort((a, b) => {
    const tb = tsMillis(b.createdAt) || Date.parse(`${b.start || b.issued || '1970-01-01'}T12:00:00`) || 0;
    const ta = tsMillis(a.createdAt) || Date.parse(`${a.start || a.issued || '1970-01-01'}T12:00:00`) || 0;
    return tb - ta;
  });
}

function rentalStatus(r) {
  if (r?.status === 'Ativa' && r?.due && r.due < today()) return 'Atrasada';
  return r?.status || '';
}

function operationalStatus({ total, available, rented, reserved, maintenance, inactive }) {
  if (inactive) return 'Inativo';
  if (total <= 0) return 'Inativo';
  if (available > 0) return 'Disponível';
  if (rented > 0) return 'Alugado';
  if (reserved > 0) return 'Reservado';
  if (maintenance > 0) return 'Manutenção';
  return 'Disponível';
}

function deriveStock(eq, rentals = [], maintenanceRows = []) {
  const total = Math.max(0, Number(eq?.quantity ?? 1));
  const inactive = eq?.status === 'Inativo' || eq?.active === false;
  let rented = 0;
  let reserved = 0;
  let maintenance = 0;

  for (const r of rentals) {
    const rentalItems = Array.isArray(r.items) && r.items.length
      ? r.items
      : [{ equipmentId: r.equipmentId, qty: r.qty || 1 }];
    for (const item of rentalItems) {
      if (item.equipmentId !== eq.id) continue;
      const q = Math.max(1, Number(item.qty || 1));
      if (r.status === 'Ativa') rented += q;
      if (r.status === 'Reservada') reserved += q;
    }
  }

  for (const m of maintenanceRows) {
    if (m.equipmentId !== eq.id || m.status === 'Finalizada' || m.status === 'Cancelada') continue;
    maintenance += Math.max(1, Number(m.qty || 1));
  }

  rented = Math.max(0, Math.min(total, rented));
  reserved = Math.max(0, Math.min(Math.max(0, total - rented), reserved));
  maintenance = Math.max(0, Math.min(Math.max(0, total - rented - reserved), maintenance));
  const available = inactive ? 0 : Math.max(0, total - rented - reserved - maintenance);

  return {
    total,
    rented,
    reserved,
    maintenance,
    available,
    inactive,
    status: operationalStatus({ total, available, rented, reserved, maintenance, inactive })
  };
}

function stockFromDocument(eq, fallback) {
  if (Number(eq?.stockVersion) !== STOCK_VERSION) return fallback;
  const total = Math.max(0, Number(eq.quantity ?? fallback.total ?? 1));
  const rented = Math.max(0, Number(eq.rentedQty || 0));
  const reserved = Math.max(0, Number(eq.reservedQty || 0));
  const maintenance = Math.max(0, Number(eq.maintenanceQty || 0));
  const inactive = eq.status === 'Inativo' || eq.active === false;
  const available = inactive ? 0 : Math.max(0, total - rented - reserved - maintenance);
  return {
    total,
    rented,
    reserved,
    maintenance,
    available,
    inactive,
    status: operationalStatus({ total, available, rented, reserved, maintenance, inactive })
  };
}

function stockFields(total, rented, reserved, maintenance, inactive = false) {
  total = Math.max(0, Number(total || 0));
  rented = Math.max(0, Number(rented || 0));
  reserved = Math.max(0, Number(reserved || 0));
  maintenance = Math.max(0, Number(maintenance || 0));
  const available = inactive ? 0 : Math.max(0, total - rented - reserved - maintenance);
  return {
    quantity: total,
    rentedQty: rented,
    reservedQty: reserved,
    maintenanceQty: maintenance,
    availableQty: available,
    active: !inactive,
    status: operationalStatus({ total, available, rented, reserved, maintenance, inactive }),
    stockVersion: STOCK_VERSION,
    updatedAt: serverTimestamp()
  };
}

function findDuplicateClient(clients, documentValue, phoneValue, excludeId = '') {
  const docDigits = digits(documentValue);
  const phoneDigits = digits(phoneValue);
  return clients.find((c) => {
    if (c.id === excludeId) return false;
    return (docDigits && digits(c.document) === docDigits) || (phoneDigits.length >= 8 && digits(c.phone) === phoneDigits);
  });
}

function makeNumber(prefix, refId) {
  return `${prefix}-${today().replaceAll('-', '')}-${String(refId || '').slice(0, 6).toUpperCase()}`;
}

async function logAudit(user, action, entity, entityId, details = {}) {
  try {
    await addDoc(collection(db, 'companies', CID, 'audit'), {
      action,
      entity,
      entityId: entityId || '',
      details,
      actorUid: user?.uid || '',
      actorEmail: user?.email || '',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Falha ao registrar auditoria:', err);
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get('install') === '1' ? 'Configurações' : 'Dashboard');
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(null);
  const [loaded, setLoaded] = useState({});
  const [data, setData] = useState({
    equipment: [],
    clients: [],
    rentals: [],
    quotes: [],
    members: [],
    maintenance: [],
    adminInvites: [],
    audit: []
  });
  const [cfg, setCfg] = useState({
    name: 'LOQ MAIS',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    terms: baseTerms,
    logo: '/logo-source.png'
  });
  const migratedRef = useRef(false);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setReady(false);
    setDenied(false);
    setRole(null);
    if (!u) {
      setUser(null);
      setReady(true);
      return;
    }

    try {
      const companyRef = doc(db, 'companies', CID);
      const memberRef = doc(db, 'companies', CID, 'members', u.uid);
      const companySnap = await getDoc(companyRef);
      const email = String(u.email || '').trim().toLowerCase();

      if (!companySnap.exists()) {
        await setDoc(companyRef, {
          name: 'LOQ MAIS',
          initialAdminUid: u.uid,
          ownerUid: u.uid,
          ownerEmail: email,
          createdAt: serverTimestamp(),
          settings: { name: 'LOQ MAIS', terms: baseTerms, logo: '/logo-source.png' }
        });
        await setDoc(memberRef, {
          name: u.displayName || email.split('@')[0] || 'Administrador',
          email,
          username: '',
          provider: 'google',
          role: 'admin',
          active: true,
          createdAt: serverTimestamp()
        });
      } else {
        let memberSnap = await getDoc(memberRef);
        const company = companySnap.data() || {};

        if (!memberSnap.exists()) {
          const isLegacyOwner = company.ownerUid === u.uid || company.initialAdminUid === u.uid || (company.ownerEmail && String(company.ownerEmail).toLowerCase() === email);
          if (isLegacyOwner) {
            await setDoc(memberRef, {
              name: u.displayName || email.split('@')[0] || 'Administrador',
              email,
              username: '',
              provider: 'google',
              role: 'admin',
              active: true,
              migratedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            });
            memberSnap = await getDoc(memberRef);
          }
        }

        if (!memberSnap.exists() && email) {
          const inviteRef = doc(db, 'companies', CID, 'adminInvites', email);
          const invite = await getDoc(inviteRef);
          if (invite.exists() && invite.data().active === true && invite.data().role === 'admin') {
            await setDoc(memberRef, {
              name: u.displayName || email.split('@')[0],
              email,
              username: '',
              provider: 'google',
              role: 'admin',
              active: true,
              createdAt: serverTimestamp()
            });
            await updateDoc(inviteRef, {
              active: false,
              claimedBy: u.uid,
              claimedAt: serverTimestamp()
            });
            memberSnap = await getDoc(memberRef);
          }
        }

        if (!memberSnap.exists() || memberSnap.data().active === false) {
          setDenied(true);
          await signOut(auth);
          setReady(true);
          return;
        }
      }

      const finalMember = await getDoc(memberRef);
      setRole(finalMember.data()?.role || 'employee');
      setUser(u);
    } catch (err) {
      console.error(err);
      setDenied(true);
      try { await signOut(auth); } catch (_) {}
    } finally {
      setReady(true);
    }
  }), []);

  useEffect(() => {
    if (!user || !role) return undefined;
    const unsubs = [];
    const subscribe = (key) => {
      const un = onSnapshot(
        collection(db, 'companies', CID, key),
        (snap) => {
          setData((cur) => ({ ...cur, [key]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
          setLoaded((cur) => ({ ...cur, [key]: true }));
        },
        (err) => console.error(`Listener ${key}:`, err)
      );
      unsubs.push(un);
    };

    ['equipment', 'clients', 'rentals', 'quotes', 'maintenance'].forEach(subscribe);

    const companyUn = onSnapshot(doc(db, 'companies', CID), (snap) => {
      if (snap.exists()) setCfg((cur) => ({ ...cur, ...(snap.data().settings || {}) }));
    });
    unsubs.push(companyUn);

    const memberUn = onSnapshot(doc(db, 'companies', CID, 'members', user.uid), (snap) => {
      if (!snap.exists() || snap.data().active === false) {
        signOut(auth);
        return;
      }
      setRole(snap.data().role || 'employee');
      if ((snap.data().role || 'employee') !== 'admin') {
        setData((cur) => ({ ...cur, members: [{ id: snap.id, ...snap.data() }] }));
      }
    });
    unsubs.push(memberUn);

    if (role === 'admin') {
      ['members', 'adminInvites', 'audit'].forEach(subscribe);
    } else {
      setData((cur) => ({ ...cur, adminInvites: [], audit: [] }));
    }

    return () => unsubs.forEach((un) => un());
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== 'admin' || migratedRef.current) return;
    if (!loaded.equipment || !loaded.rentals || !loaded.maintenance) return;
    migratedRef.current = true;

    (async () => {
      const changed = data.equipment.filter((eq) => eq.kind !== 'furniture_stock').filter((eq) => {
        const s = deriveStock(eq, data.rentals, data.maintenance);
        return Number(eq.stockVersion) !== STOCK_VERSION
          || Number(eq.availableQty ?? -1) !== s.available
          || Number(eq.rentedQty ?? -1) !== s.rented
          || Number(eq.reservedQty ?? -1) !== s.reserved
          || Number(eq.maintenanceQty ?? -1) !== s.maintenance;
      });
      if (!changed.length) return;

      let batch = writeBatch(db);
      let count = 0;
      for (const eq of changed) {
        const s = deriveStock(eq, data.rentals, data.maintenance);
        batch.update(doc(db, 'companies', CID, 'equipment', eq.id), stockFields(s.total, s.rented, s.reserved, s.maintenance, s.inactive));
        count += 1;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count) await batch.commit();
      await logAudit(user, 'inventory_reconciled', 'equipment', '', { items: changed.length });
    })().catch((err) => {
      migratedRef.current = false;
      console.error('Falha ao reconciliar estoque:', err);
    });
  }, [user, role, loaded, data.equipment, data.rentals, data.maintenance]);

  if (!ready) return <div className="login"><div className="loginbox">Carregando...</div></div>;
  if (!user) return <Login denied={denied} />;

  const props = { data, cfg, setCfg, role, user };

  return (
    <div className="app">
      <aside className={mobile ? 'open' : ''}>
        <div className="brand"><img src="/logo-source.png" alt="LOQ MAIS" /></div>
        {nav.map(([name, Icon]) => (
          <button key={name} className={page === name ? 'active' : ''} onClick={() => { setPage(name); setMobile(false); setSearch(''); }}>
            <Icon /> {name}
          </button>
        ))}
        <button onClick={() => signOut(auth)}><LogOut /> Sair</button>
      </aside>
      <main>
        <header>
          <button className="hamb" onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</button>
          <div className="search globalSearch">
            <Search />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar equipamentos, clientes, locações..." />
            {search.trim().length >= 2 && <SearchResults query={search} data={data} setPage={setPage} close={() => setSearch('')} />}
          </div>
          <div className="user">
            <b>{data.members.find((x) => x.id === user.uid)?.name || user.displayName || 'Usuário'}</b>
            <small>{role === 'admin' ? 'Administrador' : 'Funcionário'}</small>
          </div>
        </header>
        <section><Page name={page} {...props} /></section>
      </main>
    </div>
  );
}

function Login({ denied }) {
  const [mode, setMode] = useState('user');
  const [err, setErr] = useState('');

  async function enter(e) {
    e.preventDefault();
    setErr('');
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await signInWithEmailAndPassword(auth, userEmail(f.username), f.password);
    } catch (_) {
      setErr('Usuário ou senha inválidos.');
    }
  }

  return (
    <div className="login">
      <div className="loginbox">
        <img src="/logo-source.png" alt="LOQ MAIS" />
        <h1>Controle de Locações</h1>
        {denied && <p className="error">Este usuário não possui acesso ao sistema.</p>}
        {mode === 'user' ? (
          <form onSubmit={enter} className="loginform">
            <input name="username" placeholder="Usuário" required />
            <input name="password" type="password" placeholder="Senha" required />
            <button>Entrar</button>
            {err && <p className="error">{err}</p>}
            <button type="button" className="linkbtn" onClick={() => setMode('google')}>Acesso do administrador</button>
          </form>
        ) : (
          <>
            <p>Entre com uma conta Google previamente autorizada como administrador.</p>
            <button onClick={() => signInWithPopup(auth, googleProvider)}>Entrar com Google</button>
            <button className="linkbtn" onClick={() => setMode('user')}>Voltar para usuário e senha</button>
          </>
        )}
      </div>
    </div>
  );
}

function SearchResults({ query, data, setPage, close }) {
  const q = compactText(query);
  const groups = [
    ['Equipamentos', data.equipment.filter((x)=>x.kind!=='furniture_stock').filter((x) => compactText(`${x.code} ${x.name} ${x.category}`).includes(q)).slice(0, 5), (x) => `${x.code || ''} · ${x.name}`],
    ['Clientes', data.clients.filter((x) => compactText(`${x.name} ${x.phone} ${x.document}`).includes(q)).slice(0, 5), (x) => `${x.name}${x.phone ? ` · ${x.phone}` : ''}`],
    ['Locações', data.rentals.filter((x) => x.rentalType!=='furniture').filter((x) => compactText(`${x.number} ${x.clientName} ${x.equipmentName} ${x.status}`).includes(q)).slice(0, 5), (x) => `${x.number || 'Locação'} · ${x.clientName} · ${x.equipmentName}`],
    ['Mesas e Cadeiras', data.rentals.filter((x) => x.rentalType==='furniture').filter((x) => compactText(`${x.number} ${x.clientName} ${x.equipmentName} ${x.status}`).includes(q)).slice(0, 5), (x) => `${x.number || 'Locação'} · ${x.clientName} · ${x.equipmentName}`],
    ['Orçamentos', data.quotes.filter((x) => compactText(`${x.number} ${x.clientName} ${x.equipmentName} ${(x.items || []).map((i) => i.description).join(' ')}`).includes(q)).slice(0, 5), (x) => `${x.number || 'Orçamento'} · ${x.clientName}`]
  ];
  const count = groups.reduce((n, [, rows]) => n + rows.length, 0);

  return (
    <div className="searchResults">
      {count === 0 && <div className="searchEmpty">Nenhum resultado encontrado.</div>}
      {groups.map(([name, rows, label]) => rows.length > 0 && (
        <div className="searchGroup" key={name}>
          <b>{name}</b>
          {rows.map((r) => <button key={r.id} onClick={() => { setPage(name); close(); }}>{label(r)}</button>)}
        </div>
      ))}
    </div>
  );
}

function Page({ name, ...p }) {
  if (name === 'Dashboard') return <Dashboard {...p} />;
  if (name === 'Equipamentos') return <Equipment {...p} />;
  if (name === 'Clientes') return <Clients {...p} />;
  if (name === 'Locações') return <Rentals {...p} />;
  if (name === 'Mesas e Cadeiras') return <Furniture {...p} />;
  if (name === 'Orçamentos') return <Quotes {...p} />;
  if (name === 'Manutenção') return <Maintenance {...p} />;
  if (name === 'Relatórios') return <Reports {...p} />;
  return <Config {...p} />;
}

const Title = ({ t, s, action }) => (
  <div className="title"><div><h1>{t}</h1><p>{s}</p></div>{action}</div>
);

const Del = ({ onClick }) => <button className="danger" title="Excluir" onClick={onClick}><Trash2 /> Excluir</button>;

function confirmDel(what, fn) {
  if (window.confirm(`Excluir ${what}? Esta ação não pode ser desfeita.`)) fn();
}

function Table({ rows, cols, actions }) {
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>{cols.map((c) => <th key={c[0]}>{c[0]}</th>)}{actions && <th />}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id}>
              {cols.map((c) => <td key={c[0]}>{c[2] ? c[2](r) : r[c[1]]}</td>)}
              {actions && <td><div className="rowactions">{actions(r)}</div></td>}
            </tr>
          )) : <tr><td colSpan={cols.length + 1}>Nenhum registro.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ data }) {
  const stocks = data.equipment.filter((eq) => eq.kind !== 'furniture_stock').map((eq) => deriveStock(eq, data.rentals, data.maintenance));
  const availableUnits = stocks.reduce((sum, s) => sum + s.available, 0);
  const rentedUnits = stocks.reduce((sum, s) => sum + s.rented, 0);
  const maintenanceUnits = stocks.reduce((sum, s) => sum + s.maintenance, 0);
  const late = data.rentals.filter((x) => rentalStatus(x) === 'Atrasada').length;
  const recent = sortNewest(data.rentals).slice(0, 8);

  return (
    <>
      <Title t="Dashboard" s="Visão geral da operação." />
      <div className="stats">
        {[
          ['Unidades disponíveis', availableUnits, Package, 'ok'],
          ['Unidades alugadas', rentedUnits, CalendarDays, 'info'],
          ['Locações atrasadas', late, Wrench, 'late'],
          ['Em manutenção', maintenanceUnits, Settings, 'warn']
        ].map(([label, value, Icon, tone]) => (
          <div className={`card stat ${tone}`} key={label}><div className="statIcon"><Icon /></div><div><b>{value}</b><span>{label}</span></div></div>
        ))}
      </div>
      <div className="card dashboardCard">
        <div className="sectionhead"><div><h3>Locações recentes</h3><p>Acompanhe prazos e devoluções.</p></div></div>
        <Table rows={recent} cols={[
          ['Cliente', 'clientName'],
          ['Equipamento', 'equipmentName'],
          ['Saída', 'start', (r) => dateBR(r.start)],
          ['Devolução', 'due', (r) => dateBR(r.due)],
          ['Status', 'status', (r) => <StatusBadge status={rentalStatus(r)} />]
        ]} />
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge ${String(status || '').toLowerCase().replaceAll(' ', '-')}`}>{status || '—'}</span>;
}

function Equipment({ data, role, user }) {
  const [form, setForm] = useState(null);
  const [priceView, setPriceView] = useState('daily');

  async function save(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.target));
    const code = String(raw.code || '').trim();
    const name = String(raw.name || '').trim();
    const quantity = Math.max(1, Number(raw.quantity || 1));
    const inactive = raw.registrationStatus === 'Inativo';
    const duplicateCode = code && data.equipment.filter((x) => x.kind !== 'furniture_stock').find((x) => x.id !== form?.id && compactText(x.code) === compactText(code));
    if (duplicateCode) return alert(`O código ${code} já está sendo usado por ${duplicateCode.name}.`);

    try {
      if (form?.id) {
        const eqRef = doc(db, 'companies', CID, 'equipment', form.id);
        const fallback = deriveStock(form, data.rentals, data.maintenance);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(eqRef);
          if (!snap.exists()) throw new Error('EQUIPMENT_NOT_FOUND');
          const current = snap.data();
          const s = stockFromDocument(current, fallback);
          const used = s.rented + s.reserved + s.maintenance;
          if (quantity < used) throw new Error('TOTAL_BELOW_USED');
          if (inactive && used > 0) throw new Error('CANNOT_DISABLE_USED');
          tx.update(eqRef, {
            code,
            name,
            category: String(raw.category || '').trim(),
            controlType: raw.controlType || 'individual',
            daily: parseMoney(raw.daily),
            fortnightly: parseMoney(raw.fortnightly),
            monthly: parseMoney(raw.monthly),
            notes: String(raw.notes || '').trim(),
            ...stockFields(quantity, s.rented, s.reserved, s.maintenance, inactive)
          });
        });
        await logAudit(user, 'equipment_updated', 'equipment', form.id, { name, quantity });
      } else {
        const ref = doc(collection(db, 'companies', CID, 'equipment'));
        await setDoc(ref, {
          code,
          name,
          category: String(raw.category || '').trim(),
          controlType: raw.controlType || 'individual',
          daily: parseMoney(raw.daily),
          fortnightly: parseMoney(raw.fortnightly),
          monthly: parseMoney(raw.monthly),
          notes: String(raw.notes || '').trim(),
          ...stockFields(quantity, 0, 0, 0, inactive),
          createdAt: serverTimestamp()
        });
        await logAudit(user, 'equipment_created', 'equipment', ref.id, { name, quantity });
      }
      setForm(null);
      alert('Equipamento salvo com sucesso.');
    } catch (err) {
      console.error(err);
      if (err.message === 'TOTAL_BELOW_USED') return alert('A quantidade total não pode ser menor que a quantidade atualmente alugada, reservada ou em manutenção.');
      if (err.message === 'CANNOT_DISABLE_USED') return alert('Não é possível inativar um equipamento com unidades alugadas, reservadas ou em manutenção.');
      alert('Não foi possível salvar o equipamento.');
    }
  }

  async function del(r) {
    const s = deriveStock(r, data.rentals, data.maintenance);
    if (s.rented + s.reserved + s.maintenance > 0) return alert('Este equipamento possui unidades em uso e não pode ser excluído.');
    await deleteDoc(doc(db, 'companies', CID, 'equipment', r.id));
    await logAudit(user, 'equipment_deleted', 'equipment', r.id, { name: r.name });
  }

  const rows = data.equipment.filter((eq) => eq.kind !== 'furniture_stock').map((eq) => ({ ...eq, _stock: deriveStock(eq, data.rentals, data.maintenance) }));

  return (
    <>
      <Title t="Equipamentos" s="Cadastro e estoque real de máquinas, ferramentas e itens." action={<button className="primary" onClick={() => setForm({ controlType: 'individual', quantity: 1, status: 'Disponível' })}><Plus /> Novo equipamento</button>} />
      {form && (
        <Modal title="Equipamento" close={() => setForm(null)}>
          <form onSubmit={save} className="form">
            <Input n="code" l="Código" v={form.code} />
            <Input n="name" l="Nome" v={form.name} required />
            <Input n="category" l="Categoria" v={form.category} />
            <Select n="controlType" l="Tipo de controle" v={form.controlType || 'individual'} opts={[
              ['individual', 'Máquinas/ferramentas'],
              ['quantity', 'Mesas/cadeiras / valor combinado']
            ]} />
            <MoneyInput n="daily" l="Valor da diária" v={form.daily} />
            <MoneyInput n="fortnightly" l="Valor quinzenal (15 dias)" v={form.fortnightly} />
            <MoneyInput n="monthly" l="Valor mensal (30 dias)" v={form.monthly} />
            <Input n="quantity" l="Quantidade total" type="number" min="1" v={form.quantity || 1} required />
            <Select n="registrationStatus" l="Situação cadastral" v={form.status === 'Inativo' ? 'Inativo' : 'Ativo'} opts={['Ativo', 'Inativo']} />
            <Input n="notes" l="Observações" v={form.notes} />
            {form.id && <div className="full stockPreview"><b>Estoque atual</b><span>Total: {deriveStock(form, data.rentals, data.maintenance).total}</span><span>Disponível: {deriveStock(form, data.rentals, data.maintenance).available}</span><span>Alugado: {deriveStock(form, data.rentals, data.maintenance).rented}</span><span>Reservado: {deriveStock(form, data.rentals, data.maintenance).reserved}</span><span>Manutenção: {deriveStock(form, data.rentals, data.maintenance).maintenance}</span></div>}
            <div className="full note">O status operacional é calculado automaticamente pelas locações, reservas e manutenções. Aqui você só ativa ou inativa o cadastro.</div>
            <button className="primary"><Save /> Salvar</button>
          </form>
        </Modal>
      )}
      <div className="card"><div className="priceViewBar"><span>Exibir preço:</span><button className={priceView==='daily'?'active':''} onClick={()=>setPriceView('daily')}>Diária</button><button className={priceView==='fortnightly'?'active':''} onClick={()=>setPriceView('fortnightly')}>Quinzenal</button><button className={priceView==='monthly'?'active':''} onClick={()=>setPriceView('monthly')}>Mensal</button></div>
        <Table rows={rows} cols={[
          ['Código', 'code'],
          ['Equipamento', 'name'],
          ['Total', '_stock', (r) => r._stock.total],
          ['Disponíveis', '_stock', (r) => <b>{r._stock.available}</b>],
          ['Alugados', '_stock', (r) => r._stock.rented],
          ['Reservados', '_stock', (r) => r._stock.reserved],
          ['Manutenção', '_stock', (r) => r._stock.maintenance],
          [priceView==='daily'?'Diária':priceView==='fortnightly'?'Quinzenal':'Mensal', priceView, (r) => money(r[priceView])],
          ['Status', '_stock', (r) => <StatusBadge status={r._stock.status} />]
        ]} actions={(r) => <><button onClick={() => setForm(r)}><Pencil /> Editar</button>{role === 'admin' && <Del onClick={() => confirmDel(`o equipamento "${r.name}"`, () => del(r))} />}</>} />
      </div>
    </>
  );
}

function Clients({ data, role, user }) {
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState(null);

  async function save(e) {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target));
    const duplicate = findDuplicateClient(data.clients, o.document, o.phone, form?.id || '');
    if (duplicate) return alert(`Já existe um cliente com o mesmo CPF/CNPJ ou telefone: ${duplicate.name}.`);
    const payload = {
      name: String(o.name || '').trim(),
      document: String(o.document || '').trim(),
      phone: String(o.phone || '').trim(),
      email: String(o.email || '').trim(),
      address: String(o.address || '').trim(),
      updatedAt: serverTimestamp()
    };
    if (!payload.name) return alert('Informe o nome do cliente.');

    if (form?.id) {
      await updateDoc(doc(db, 'companies', CID, 'clients', form.id), payload);
      await logAudit(user, 'client_updated', 'client', form.id, { name: payload.name });
    } else {
      const ref = await addDoc(collection(db, 'companies', CID, 'clients'), { ...payload, createdAt: serverTimestamp() });
      await logAudit(user, 'client_created', 'client', ref.id, { name: payload.name });
    }
    setForm(null);
  }

  async function removeClient(r) {
    const hasHistory = data.rentals.some((x) => x.clientId === r.id) || data.quotes.some((x) => x.clientId === r.id);
    if (hasHistory) return alert('Este cliente possui histórico de locações/orçamentos. Para preservar o histórico, o cadastro não pode ser excluído.');
    await deleteDoc(doc(db, 'companies', CID, 'clients', r.id));
    await logAudit(user, 'client_deleted', 'client', r.id, { name: r.name });
  }

  const historyRows = history ? sortNewest(data.rentals.filter((r) => r.clientId === history.id || (!r.clientId && compactText(r.clientName) === compactText(history.name)))) : [];

  return (
    <>
      <Title t="Clientes" s="Cadastro e histórico dos locatários." action={<button className="primary" onClick={() => setForm({})}><Plus /> Novo cliente</button>} />
      {form && <Modal title="Cliente" close={() => setForm(null)}><form onSubmit={save} className="form">
        <Input n="name" l="Nome / Razão social" v={form.name} required />
        <Input n="document" l="CPF/CNPJ" v={form.document} />
        <Input n="phone" l="Telefone" v={form.phone} />
        <Input n="email" l="E-mail" v={form.email} />
        <Input n="address" l="Endereço" v={form.address} />
        <button className="primary">Salvar</button>
      </form></Modal>}
      {history && <Modal title={`Histórico — ${history.name}`} close={() => setHistory(null)} wide><Table rows={historyRows} cols={[
        ['Nº', 'number'], ['Equipamento', 'equipmentName'], ['Saída', 'start', (r) => dateBR(r.start)], ['Devolução', 'due', (r) => dateBR(r.due)], ['Total', 'value', (r) => money(r.total ?? r.value)], ['Status', 'status', (r) => <StatusBadge status={rentalStatus(r)} />]
      ]} /></Modal>}
      <div className="card"><Table rows={data.clients} cols={[
        ['Nome', 'name'], ['CPF/CNPJ', 'document'], ['Telefone', 'phone'], ['E-mail', 'email']
      ]} actions={(r) => <><button onClick={() => setHistory(r)}><History /> Histórico</button><button onClick={() => setForm(r)}><Pencil /> Editar</button>{role === 'admin' && <Del onClick={() => confirmDel(`o cliente "${r.name}"`, () => removeClient(r))} />}</>} /></div>
    </>
  );
}

function emptyRentalItem() {
  return { key: `${Date.now()}-${Math.random()}`, equipmentId: '', description: '', qty: 1, daily: 0, fortnightly: 0, monthly: 0, pricing: 'daily', rate: 0, manualTotal: 0 };
}

function rentalItemsOf(r) {
  return Array.isArray(r?.items) && r.items.length ? r.items : [{ equipmentId: r?.equipmentId || '', description: r?.equipmentName || '—', qty: r?.qty || 1, daily: r?.daily || 0, fortnightly: r?.fortnightly || 0, monthly: r?.monthly || 0, pricing: r?.pricing || 'daily', rate: r?.rate ?? r?.daily ?? 0, subtotal: r?.total ?? r?.value ?? 0 }];
}

function Rentals({ data, role, cfg, user }) {
  const [openForm, setOpenForm] = useState(false);
  const [view, setView] = useState(null);
  const [clientMode, setClientMode] = useState('registered');
  const [start, setStart] = useState(today());
  const [due, setDue] = useState(today());
  const [status, setStatus] = useState('Ativa');
  const [freight, setFreight] = useState(0);
  const [addition, setAddition] = useState(0);
  const [discountType, setDiscountType] = useState('money');
  const [discountInput, setDiscountInput] = useState(0);
  const [items, setItems] = useState([emptyRentalItem()]);
  const [paymentStatus,setPaymentStatus]=useState('Pendente'), [paymentMethod,setPaymentMethod]=useState('Pix'), [paidNow,setPaidNow]=useState(0);
  const [renew,setRenew]=useState(null), [pay,setPay]=useState(null), [edit,setEdit]=useState(null);

  const days = daysBetween(start, due);
  function resetForm() {
    setClientMode('registered'); setStart(today()); setDue(today()); setStatus('Ativa'); setFreight(0); setAddition(0); setDiscountType('money'); setDiscountInput(0);
    setItems([emptyRentalItem()]); setPaymentStatus('Pendente'); setPaymentMethod('Pix'); setPaidNow(0); setOpenForm(true);
  }
  function updateItem(key, patch) { setItems((rows) => rows.map((x) => x.key === key ? { ...x, ...patch } : x)); }
  function chooseEquipment(key, id) {
    const eq = data.equipment.find((x) => x.id === id);
    if (!eq) return updateItem(key, { equipmentId: '', description: '', qty: 1, daily: 0, fortnightly: 0, monthly: 0, pricing: 'daily', rate: 0, manualTotal: 0 });
    updateItem(key, { equipmentId: eq.id, description: eq.name, qty: 1, daily: Number(eq.daily || 0), fortnightly: Number(eq.fortnightly || 0), monthly: Number(eq.monthly || 0), pricing: eq.controlType === 'quantity' ? 'manual' : 'daily', rate: Number(eq.daily || 0), manualTotal: 0 });
  }
  const itemRentalSubtotal = (i) => i.pricing === 'manual' ? Math.max(0, Number(i.manualTotal || 0)) : i.pricing === 'daily' ? Math.max(0, Number(i.rate ?? i.daily ?? 0) * days * Math.max(1, Number(i.qty || 1))) : Math.max(0, Number(i.rate || 0) * Math.max(1, Number(i.qty || 1)));
  const subtotal = items.reduce((sum, i) => sum + itemRentalSubtotal(i), 0);
  function changeRentalPricing(key, mode) { const it=items.find(x=>x.key===key); if(!it) return; const rate=mode==='fortnightly'?Number(it.fortnightly||0):mode==='monthly'?Number(it.monthly||0):Number(it.daily||0); updateItem(key,{pricing:mode,rate}); if(mode==='fortnightly') setDue(addDaysISO(start,15)); else if(mode==='monthly') setDue(addDaysISO(start,30)); }
  const discount = discountType === 'percent' ? subtotal * Math.min(100, Math.max(0, Number(discountInput || 0))) / 100 : Math.max(0, Number(discountInput || 0));
  const total = Math.max(0, subtotal + Number(freight || 0) + Number(addition || 0) - discount);

  async function save(e) {
    e.preventDefault();
    const fd = new FormData(e.target), o = Object.fromEntries(fd);
    if (!isValidPeriod(start, due)) return alert('A data de devolução não pode ser anterior à data de saída.');
    if (!items.length || items.some((i) => !i.equipmentId || Number(i.qty || 0) < 1)) return alert('Adicione pelo menos um equipamento e confira as quantidades.');
    if (items.some((i) => i.pricing === 'manual' && Number(i.manualTotal || 0) <= 0)) return alert('Informe o valor combinado dos itens com preço manual.');
    const aggregates = new Map();
    for (const i of items) aggregates.set(i.equipmentId, (aggregates.get(i.equipmentId) || 0) + Math.max(1, Number(i.qty || 1)));
    let clientId='', clientName='', clientPhone='', clientDocument='', newClientRef=null, newClientPayload=null;
    if (clientMode === 'registered') {
      const cl=data.clients.find((x)=>x.id===o.clientId); if(!cl) return alert('Selecione um cliente cadastrado.');
      clientId=cl.id; clientName=cl.name; clientPhone=cl.phone||''; clientDocument=cl.document||'';
    } else {
      clientName=String(o.walkInName||'').trim(); clientPhone=String(o.walkInPhone||'').trim(); clientDocument=String(o.walkInDocument||'').trim();
      if(!clientName) return alert('Informe o nome do cliente avulso.');
      if(fd.get('saveClient')==='yes') { const dup=findDuplicateClient(data.clients,clientDocument,clientPhone); if(dup){clientId=dup.id;clientName=dup.name;clientPhone=dup.phone||clientPhone;clientDocument=dup.document||clientDocument;} else {newClientRef=doc(collection(db,'companies',CID,'clients'));clientId=newClientRef.id;newClientPayload={name:clientName,phone:clientPhone,document:clientDocument,email:'',address:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};}}
    }
    const rentalRef=doc(collection(db,'companies',CID,'rentals')), number=makeNumber('LOC',rentalRef.id);
    const initialPaid=paymentStatus==='Pago'?total:paymentStatus==='Parcial'?Math.min(total,Math.max(0,Number(paidNow||0))):0;
    if(paymentStatus==='Parcial' && initialPaid<=0) return alert('Informe o valor pago.');
    const initialPayments=initialPaid>0?[{amount:initialPaid,method:paymentMethod,date:today(),kind:'initial'}]:[];
    const refs=[...aggregates.keys()].map((id)=>({id,ref:doc(db,'companies',CID,'equipment',id),eq:data.equipment.find((x)=>x.id===id)}));
    try {
      await runTransaction(db, async(tx)=>{
        const snaps=[]; for(const x of refs) snaps.push({...x,snap:await tx.get(x.ref)});
        for(const x of snaps){ if(!x.snap.exists()) throw new Error('EQUIPMENT_NOT_FOUND'); const fb=x.eq?deriveStock(x.eq,data.rentals,data.maintenance):deriveStock({id:x.id,...x.snap.data()},data.rentals,data.maintenance); const st=stockFromDocument(x.snap.data(),fb); if(st.inactive) throw new Error(`INACTIVE:${x.snap.data().name||x.id}`); if((aggregates.get(x.id)||0)>st.available) throw new Error(`NO_STOCK:${x.snap.data().name||x.id}`); }
        for(const x of snaps){ const fb=x.eq?deriveStock(x.eq,data.rentals,data.maintenance):deriveStock({id:x.id,...x.snap.data()},data.rentals,data.maintenance); const st=stockFromDocument(x.snap.data(),fb); const q=aggregates.get(x.id)||0; tx.update(x.ref,stockFields(st.total,st.rented+(status==='Ativa'?q:0),st.reserved+(status==='Reservada'?q:0),st.maintenance,false)); }
        if(newClientRef&&newClientPayload) tx.set(newClientRef,newClientPayload);
        const savedItems=items.map(({key,...i})=>({...i,qty:Math.max(1,Number(i.qty||1)),daily:Number(i.daily||0),fortnightly:Number(i.fortnightly||0),monthly:Number(i.monthly||0),rate:Number(i.rate??i.daily??0),days,manualTotal:Number(i.manualTotal||0),subtotal:itemRentalSubtotal(i)}));
        tx.set(rentalRef,{number,issued:today(),clientId,clientName,clientPhone,clientDocument,items:savedItems,equipmentName:savedItems.map(i=>i.description).join(', '),start,due,days,subtotal,freight:Number(freight||0),delivery:Number(freight||0),addition:Number(addition||0),discountType,discountInput:Number(discountInput||0),discount:Number(discount||0),value:total,total,status,paymentStatus:initialPaid>=total?'Pago':initialPaid>0?'Parcial':'Pendente',paidAmount:initialPaid,balance:Math.max(0,total-initialPaid),payments:initialPayments,renewals:[],createdAt:serverTimestamp(),createdBy:user.uid});
      });
      await logAudit(user,'rental_created','rental',rentalRef.id,{number,items:items.length,status,total});
      const savedItems=items.map(({key,...i})=>({...i,days,subtotal:itemRentalSubtotal(i)}));
      setOpenForm(false); setView({id:rentalRef.id,number,issued:today(),clientId,clientName,clientPhone,clientDocument,items:savedItems,equipmentName:savedItems.map(i=>i.description).join(', '),start,due,days,subtotal,freight:Number(freight||0),delivery:Number(freight||0),addition:Number(addition||0),discountType,discountInput:Number(discountInput||0),discount:Number(discount||0),value:total,total,status,paymentStatus:initialPaid>=total?'Pago':initialPaid>0?'Parcial':'Pendente',paidAmount:initialPaid,balance:Math.max(0,total-initialPaid),payments:initialPayments,renewals:[]});
    } catch(err){ console.error(err); if(String(err.message).startsWith('NO_STOCK:')) return alert(`Estoque insuficiente para ${String(err.message).split(':').slice(1).join(':')}.`); if(String(err.message).startsWith('INACTIVE:')) return alert(`Equipamento inativo: ${String(err.message).split(':').slice(1).join(':')}.`); alert('Não foi possível registrar a locação.'); }
  }

  async function moveRental(r, action) {
    const label=action==='return'?'devolução':action==='start'?'início da locação':'cancelamento da reserva';
    if(!window.confirm(`Confirmar ${label} da locação ${r.number}?`)) return;
    try { await runTransaction(db,async(tx)=>{
      const rr=doc(db,'companies',CID,'rentals',r.id), rs=await tx.get(rr); if(!rs.exists()) throw new Error('RENTAL_NOT_FOUND'); const live=rs.data();
      if(action==='return'&&live.status!=='Ativa') throw new Error('INVALID_STATUS'); if((action==='start'||action==='cancel')&&live.status!=='Reservada') throw new Error('INVALID_STATUS');
      const ris=rentalItemsOf(live), ag=new Map(); for(const i of ris) if(i.equipmentId) ag.set(i.equipmentId,(ag.get(i.equipmentId)||0)+Math.max(1,Number(i.qty||1)));
      const refs=[...ag.keys()].map(id=>({id,ref:doc(db,'companies',CID,'equipment',id),eq:data.equipment.find(x=>x.id===id)})); const snaps=[]; for(const x of refs) snaps.push({...x,snap:await tx.get(x.ref)});
      for(const x of snaps){ if(!x.snap.exists()) continue; const fb=x.eq?deriveStock(x.eq,data.rentals,data.maintenance):deriveStock({id:x.id,...x.snap.data()},data.rentals,data.maintenance); const st=stockFromDocument(x.snap.data(),fb),q=ag.get(x.id)||0; let rented=st.rented,reserved=st.reserved; if(action==='return') rented=Math.max(0,rented-q); if(action==='start'){reserved=Math.max(0,reserved-q);rented+=q;} if(action==='cancel') reserved=Math.max(0,reserved-q); tx.update(x.ref,stockFields(st.total,rented,reserved,st.maintenance,st.inactive)); }
      if(action==='return') tx.update(rr,{status:'Devolvida',returned:today(),returnedAt:serverTimestamp()}); if(action==='start') tx.update(rr,{status:'Ativa',startedAt:serverTimestamp()}); if(action==='cancel') tx.update(rr,{status:'Cancelada',cancelledAt:serverTimestamp()});
    }); await logAudit(user,`rental_${action}`,'rental',r.id,{number:r.number}); } catch(err){console.error(err); if(err.message==='INVALID_STATUS') return alert('Esta locação já foi alterada em outra tela.'); alert(`Não foi possível concluir ${label}.`);}
  }
  async function registerPayment(e){
    e.preventDefault(); if(!pay) return; const fd=new FormData(e.target), amount=Math.max(0,Number(fd.get('amount')||0)), method=String(fd.get('method')||'Pix');
    const currentPaid=Number(pay.paidAmount||0), currentTotal=Number(pay.total??pay.value??0), balance=Math.max(0,currentTotal-currentPaid);
    if(amount<=0) return alert('Informe o valor recebido.'); if(amount>balance+0.001) return alert(`O valor é maior que o saldo em aberto (${money(balance)}).`);
    const ref=doc(db,'companies',CID,'rentals',pay.id); try{await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('NOT_FOUND');const live=snap.data(), oldPaid=Number(live.paidAmount||0), liveTotal=Number(live.total??live.value??0), newPaid=Math.min(liveTotal,oldPaid+amount), payments=Array.isArray(live.payments)?live.payments:[];tx.update(ref,{paidAmount:newPaid,balance:Math.max(0,liveTotal-newPaid),paymentStatus:newPaid>=liveTotal?'Pago':newPaid>0?'Parcial':'Pendente',payments:[...payments,{amount,method,date:today(),kind:'payment'}],updatedAt:serverTimestamp()});});await logAudit(user,'rental_payment','rental',pay.id,{number:pay.number,amount,method});setPay(null);}catch(err){console.error(err);alert('Não foi possível registrar o pagamento.');}
  }
  async function renewRental(e){
    e.preventDefault(); if(!renew) return; const fd=new FormData(e.target), mode=String(fd.get('mode')||'fortnightly'), newDue=String(fd.get('newDue')||''), amount=Math.max(0,Number(fd.get('amount')||0)), payNow=fd.get('payNow')==='yes', method=String(fd.get('method')||'Pix');
    if(!newDue||newDue<=String(renew.due||'')) return alert('A nova devolução precisa ser posterior à devolução atual.'); if(amount<=0)return alert('Informe o valor da renovação.');
    const ref=doc(db,'companies',CID,'rentals',renew.id); try{await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('NOT_FOUND');const live=snap.data();if(live.status!=='Ativa')throw new Error('INVALID');const oldTotal=Number(live.total??live.value??0),oldPaid=Number(live.paidAmount||0),newTotal=oldTotal+amount,paymentAmount=payNow?amount:0,newPaid=oldPaid+paymentAmount,renewals=Array.isArray(live.renewals)?live.renewals:[],payments=Array.isArray(live.payments)?live.payments:[];const renewal={mode,amount,previousDue:live.due,newDue,date:today(),paid:payNow};const patch={due:newDue,total:newTotal,value:newTotal,renewals:[...renewals,renewal],paidAmount:newPaid,balance:Math.max(0,newTotal-newPaid),paymentStatus:newPaid>=newTotal?'Pago':newPaid>0?'Parcial':'Pendente',updatedAt:serverTimestamp()};if(payNow)patch.payments=[...payments,{amount,method,date:today(),kind:'renewal'}];tx.update(ref,patch);});await logAudit(user,'rental_renewed','rental',renew.id,{number:renew.number,mode,amount,newDue,payNow});setRenew(null);}catch(err){console.error(err);alert(err.message==='INVALID'?'Somente locações ativas podem ser renovadas.':'Não foi possível renovar a locação.');}
  }
  function renewalSuggested(r,mode){const ris=rentalItemsOf(r);return ris.reduce((sum,i)=>sum+(mode==='fortnightly'?Number(i.fortnightly||0):Number(i.monthly||0))*Math.max(1,Number(i.qty||1)),0)}
  async function removeRental(r){ if(r.status==='Ativa'||r.status==='Reservada') return alert('Finalize ou cancele a locação antes de excluir.'); await deleteDoc(doc(db,'companies',CID,'rentals',r.id)); await logAudit(user,'rental_deleted','rental',r.id,{number:r.number}); }
  const rows=sortNewest(data.rentals.filter(r=>r.rentalType!=='furniture')); const availableEquipment=data.equipment.filter(x=>x.kind!=='furniture_stock').filter(x=>deriveStock(x,data.rentals,data.maintenance).available>0&&x.status!=='Inativo');
  return <>
    <Title t="Locações" s="Reservas, retiradas, devoluções e contratos." action={<button className="primary" onClick={resetForm}><Plus/> Nova locação</button>} />
    {openForm&&<Modal title="Nova locação" close={()=>setOpenForm(false)} wide><form className="form grid2" onSubmit={save}>
      <SelectControlled l="Tipo de cliente" value={clientMode} onChange={setClientMode} opts={[['registered','Cliente cadastrado'],['walkin','Cliente avulso']]}/>
      {clientMode==='registered'?<Select n="clientId" l="Cliente" opts={[["","Selecione..."],...data.clients.map(x=>[x.id,x.name])]}/>:<><Input n="walkInName" l="Nome do cliente" required/><Input n="walkInPhone" l="Telefone"/><Input n="walkInDocument" l="CPF/CNPJ (opcional)"/><label className="check full"><input name="saveClient" type="checkbox" value="yes"/> Salvar este cliente no cadastro</label></>}
      <div className="full rentalItemsEditor"><div className="sectionTitleRow"><h3>Equipamentos desta locação</h3><button type="button" onClick={()=>setItems(x=>[...x,emptyRentalItem()])}><Plus/> Adicionar equipamento</button></div>
      {items.map((it,idx)=>{const eq=data.equipment.find(x=>x.id===it.equipmentId),st=eq?deriveStock(eq,data.rentals,data.maintenance):null;return <div className="rentalItemRow" key={it.key}><b className="itemIndex">{idx+1}</b><label>Equipamento<select value={it.equipmentId} onChange={e=>chooseEquipment(it.key,e.target.value)} required><option value="">Selecione...</option>{availableEquipment.map(x=>{const sx=deriveStock(x,data.rentals,data.maintenance);return <option key={x.id} value={x.id}>{x.code?`${x.code} - `:''}{x.name} ({sx.available} disponível(is))</option>})}</select></label><label>Quantidade<input type="number" min="1" max={st?.available||undefined} value={it.qty} onChange={e=>updateItem(it.key,{qty:e.target.value})}/></label>{it.pricing==='manual'?<label>Valor combinado<input type="number" min="0" step="0.01" value={it.manualTotal} onChange={e=>updateItem(it.key,{manualTotal:e.target.value})}/></label>:<><label>Modalidade<select value={it.pricing} onChange={e=>changeRentalPricing(it.key,e.target.value)}><option value="daily">Diária</option><option value="fortnightly">Quinzenal</option><option value="monthly">Mensal</option></select></label><label>Valor aplicado<input type="number" min="0" step="0.01" value={it.rate??0} onChange={e=>updateItem(it.key,{rate:e.target.value})}/></label><div className="itemCalc"><small>{it.pricing==='daily'?`${money(it.rate)} × ${days} dia(s)`:it.pricing==='fortnightly'?`Quinzenal · ${money(it.rate)}`:`Mensal · ${money(it.rate)}`}</small><b>{money(itemRentalSubtotal(it))}</b></div></>}{items.length>1&&<button type="button" className="icon danger" onClick={()=>setItems(x=>x.filter(a=>a.key!==it.key))}><Trash2/></button>}</div>})}</div>
      <Input n="start" l="Data de saída" type="date" v={start} change={(v)=>{setStart(v);const fixed=items.find(i=>i.pricing==='fortnightly'||i.pricing==='monthly');if(fixed)setDue(addDaysISO(v,fixed.pricing==='fortnightly'?15:30));}} required/><Input n="due" l="Previsão de devolução" type="date" min={start} v={due} change={setDue} required/>
      <MoneyControlled l="Frete" value={freight} onChange={setFreight}/><MoneyControlled l="Acréscimo" value={addition} onChange={setAddition}/>
      <div className="discountField"><label>Desconto</label><div className="discountToggle"><button type="button" className={discountType==='money'?'active':''} onClick={()=>setDiscountType('money')}>R$</button><button type="button" className={discountType==='percent'?'active':''} onClick={()=>setDiscountType('percent')}>%</button></div><input inputMode="decimal" type="number" min="0" max={discountType==='percent'?100:undefined} step="0.01" value={discountInput} onChange={e=>setDiscountInput(e.target.value)}/><small>{discountType==='percent'?`${Number(discountInput||0)}% do subtotal = ${money(discount)}`:'Valor em reais'}</small></div>
      <SelectControlled l="Situação do pagamento" value={paymentStatus} onChange={setPaymentStatus} opts={['Pendente','Pago','Parcial']}/>
      {paymentStatus!=='Pendente'&&<SelectControlled l="Forma de pagamento" value={paymentMethod} onChange={setPaymentMethod} opts={['Pix','Dinheiro','Débito','Crédito']}/>} {paymentStatus==='Parcial'&&<MoneyControlled l="Valor pago agora" value={paidNow} onChange={setPaidNow}/>} 
      <SelectControlled l="Status" value={status} onChange={setStatus} opts={['Ativa','Reservada']}/>
      <div className="full rentalGrandTotal"><span>Subtotal <b>{money(subtotal)}</b></span>{Number(freight)>0&&<span>Frete <b>+ {money(freight)}</b></span>}{Number(addition)>0&&<span>Acréscimo <b>+ {money(addition)}</b></span>}{discount>0&&<span>Desconto {discountType==='percent'?`(${Number(discountInput||0)}%)`:''} <b>- {money(discount)}</b></span>}<strong>Total da locação: {money(total)}</strong></div><button className="primary">Registrar locação</button>
    </form></Modal>}
    {renew&&<Modal title={`Renovar ${renew.number||'locação'}`} close={()=>setRenew(null)}><form className="form grid2" onSubmit={renewRental}><div className="full note">Devolução atual: <b>{dateBR(renew.due)}</b>. A renovação não movimenta o estoque novamente.</div><label>Modalidade<select name="mode" defaultValue="fortnightly" onChange={e=>{const m=e.target.value;const form=e.target.form;form.elements.newDue.value=addDaysISO(renew.due,m==='fortnightly'?15:30);form.elements.amount.value=renewalSuggested(renew,m).toFixed(2)}}><option value="fortnightly">Quinzenal (+15 dias)</option><option value="monthly">Mensal (+30 dias)</option></select></label><Input n="newDue" l="Nova previsão de devolução" type="date" v={addDaysISO(renew.due,15)} required/><Input n="amount" l="Valor da renovação" type="number" step="0.01" min="0" v={renewalSuggested(renew,'fortnightly')} required/><label className="check full"><input name="payNow" type="checkbox" value="yes"/> Renovação paga agora</label><Select n="method" l="Forma de pagamento" opts={['Pix','Dinheiro','Débito','Crédito']}/><button className="primary"><RefreshCw/> Confirmar renovação</button></form></Modal>}
    {edit&&<EditRentalModal rental={edit} user={user} close={()=>setEdit(null)}/>}
    {pay&&<Modal title={`Registrar pagamento — ${pay.number||''}`} close={()=>setPay(null)}><form className="form grid2" onSubmit={registerPayment}><div className="full rentalGrandTotal"><span>Total <b>{money(pay.total??pay.value)}</b></span><span>Já pago <b>{money(pay.paidAmount||0)}</b></span><strong>Saldo: {money(Math.max(0,Number(pay.total??pay.value??0)-Number(pay.paidAmount||0)))}</strong></div><Input n="amount" l="Valor recebido" type="number" step="0.01" min="0.01" required/><Select n="method" l="Forma de pagamento" opts={['Pix','Dinheiro','Débito','Crédito']}/><button className="primary"><Save/> Registrar pagamento</button></form></Modal>}
    {view&&<DocumentModal item={{...view,total:view.total??view.value}} cfg={cfg} type="contract" close={()=>setView(null)}/>} 
    <div className="card"><Table rows={rows} cols={[["Nº","number"],["Cliente","clientName"],["Itens","equipmentName"],["Saída","start",r=>dateBR(r.start)],["Devolução","due",r=>dateBR(r.due)],["Total","value",r=>money(r.total??r.value)],["Pagamento","paymentStatus",r=>r.paymentStatus||"Pendente"],["Status","status",r=><StatusBadge status={rentalStatus(r)}/>]]} actions={r=><><button onClick={()=>setView({...r,number:r.number||makeNumber('LOC',r.id),total:r.total??r.value})}>Contrato</button><button onClick={()=>setEdit(r)}><Pencil/> Editar</button>{r.status==='Reservada'&&<><button onClick={()=>moveRental(r,'start')}><Play/> Iniciar</button><button onClick={()=>moveRental(r,'cancel')}><Ban/> Cancelar</button></>}{r.status==='Ativa'&&<><button onClick={()=>setRenew({...r,renewMode:'fortnightly'})}><RefreshCw/> Renovar</button><button onClick={()=>moveRental(r,'return')}>Devolver</button></>}{Number(r.paidAmount||0)<Number(r.total??r.value??0)&&r.status!=='Cancelada'&&<button onClick={()=>setPay(r)}>Pagamento</button>}{role==='admin'&&r.status!=='Ativa'&&r.status!=='Reservada'&&<Del onClick={()=>confirmDel('esta locação',()=>removeRental(r))}/>}</>}/></div>
  </>;
}

function Furniture({ data, role, cfg, user }) {
  const stockDoc = data.equipment.find((x) => x.kind === 'furniture_stock');
  const stock = stockDoc || { tablesTotal:0, tablesAvailable:0, chairsTotal:0, chairsAvailable:0, gameRate:0, tableRate:0, chairRate:0, weekendGameRate:null };
  const [configOpen,setConfigOpen]=useState(false), [rentOpen,setRentOpen]=useState(false), [view,setView]=useState(null), [edit,setEdit]=useState(null);
  const [clientMode,setClientMode]=useState('registered'), [start,setStart]=useState(today()), [due,setDue]=useState(today()), [status,setStatus]=useState('Ativa');
  const [games,setGames]=useState(0), [tables,setTables]=useState(0), [chairs,setChairs]=useState(0), [gameRateOverride,setGameRateOverride]=useState(null), [freight,setFreight]=useState(0), [addition,setAddition]=useState(0), [discountType,setDiscountType]=useState('money'), [discountInput,setDiscountInput]=useState(0);
  const [fPaymentStatus,setFPaymentStatus]=useState('Pendente'),[fPaymentMethod,setFPaymentMethod]=useState('Pix'),[fPaidNow,setFPaidNow]=useState(0),[fPay,setFPay]=useState(null);
  const days=daysBetween(start,due), gameRate=Number(stock.gameRate||0), tableRate=Number(stock.tableRate||0), chairRate=Number(stock.chairRate||0);
  const priceBreakdown=furniturePriceBreakdown(start,due,games,tables,chairs,stock,gameRateOverride);
  const subtotal=priceBreakdown.subtotal;
  const discount=discountType==='percent'?subtotal*Math.min(100,Math.max(0,Number(discountInput||0)))/100:Math.max(0,Number(discountInput||0));
  const total=Math.max(0,subtotal+Number(freight||0)+Number(addition||0)-discount);
  const tablesNeeded=Math.max(0,Number(games||0))+Math.max(0,Number(tables||0)), chairsNeeded=Math.max(0,Number(games||0))*4+Math.max(0,Number(chairs||0));
  const completeGames=Math.min(Number(stock.tablesAvailable||0),Math.floor(Number(stock.chairsAvailable||0)/4));
  function resetRent(){setClientMode('registered');setStart(today());setDue(today());setStatus('Ativa');setGames(0);setTables(0);setChairs(0);setGameRateOverride(null);setFreight(0);setAddition(0);setDiscountType('money');setDiscountInput(0);setFPaymentStatus('Pendente');setFPaymentMethod('Pix');setFPaidNow(0);setRentOpen(true)}
  async function saveConfig(e){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const gamesTotal=Math.max(0,Number(f.gamesTotal||0)), newTables=gamesTotal, newChairs=gamesTotal*4;const ref=doc(db,'companies',CID,'equipment','furniture-stock');
    try{await runTransaction(db,async tx=>{const snap=await tx.get(ref);const old=snap.exists()?snap.data():{};const usedTables=Math.max(0,Number(old.tablesTotal||0)-Number((old.tablesAvailable ?? old.tablesTotal) || 0));const usedChairs=Math.max(0,Number(old.chairsTotal||0)-Number((old.chairsAvailable ?? old.chairsTotal) || 0));if(newTables<usedTables||newChairs<usedChairs)throw new Error('BELOW_USED');tx.set(ref,{kind:'furniture_stock',name:'Mesas e Cadeiras',tablesTotal:newTables,tablesAvailable:newTables-usedTables,chairsTotal:newChairs,chairsAvailable:newChairs-usedChairs,gameRate:parseMoney(f.gameRate),weekendGameRate:parseMoney(f.weekendGameRate),tableRate:parseMoney(f.tableRate),chairRate:parseMoney(f.chairRate),updatedAt:serverTimestamp()},{merge:true});});setConfigOpen(false);await logAudit(user,'furniture_config_updated','equipment','furniture-stock',{gamesTotal});}catch(err){console.error(err);alert(err.message==='BELOW_USED'?'A nova quantidade não pode ser menor que o que já está alugado/reservado.':'Não foi possível salvar o estoque.')}}
  async function saveRental(e){e.preventDefault();const fd=new FormData(e.target),o=Object.fromEntries(fd);if(!isValidPeriod(start,due))return alert('A data de devolução não pode ser anterior à data de saída.');if(tablesNeeded+chairsNeeded<=0)return alert('Informe pelo menos um jogo, mesa ou cadeira.');let clientId='',clientName='',clientPhone='',clientDocument='',newClientRef=null,newClientPayload=null;if(clientMode==='registered'){const cl=data.clients.find(x=>x.id===o.clientId);if(!cl)return alert('Selecione um cliente.');clientId=cl.id;clientName=cl.name;clientPhone=cl.phone||'';clientDocument=cl.document||'';}else{clientName=String(o.walkInName||'').trim();clientPhone=String(o.walkInPhone||'').trim();clientDocument=String(o.walkInDocument||'').trim();if(!clientName)return alert('Informe o nome do cliente.');if(fd.get('saveClient')==='yes'){const dup=findDuplicateClient(data.clients,clientDocument,clientPhone);if(dup){clientId=dup.id;clientName=dup.name;clientPhone=dup.phone||clientPhone;clientDocument=dup.document||clientDocument}else{newClientRef=doc(collection(db,'companies',CID,'clients'));clientId=newClientRef.id;newClientPayload={name:clientName,phone:clientPhone,document:clientDocument,email:'',address:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}}}}
    const rr=doc(collection(db,'companies',CID,'rentals')), sr=doc(db,'companies',CID,'equipment','furniture-stock'), number=makeNumber('MC',rr.id);const items=[];if(Number(games)>0)items.push({description:'Jogo (1 mesa + 4 cadeiras)',qty:Number(games),daily:priceBreakdown.gameUnitTotal/days,days,pricing:'daily',subtotal:priceBreakdown.gameSubtotal,weekendDays:priceBreakdown.weekend,weekendRate:stock.weekendGameRate??gameRate});if(Number(tables)>0)items.push({description:'Mesa avulsa',qty:Number(tables),daily:tableRate,days,pricing:'daily',subtotal:Number(tables)*tableRate*days});if(Number(chairs)>0)items.push({description:'Cadeira avulsa',qty:Number(chairs),daily:chairRate,days,pricing:'daily',subtotal:Number(chairs)*chairRate*days});
    const initialPaid=fPaymentStatus==='Pago'?total:fPaymentStatus==='Parcial'?Math.min(total,Math.max(0,Number(fPaidNow||0))):0;if(fPaymentStatus==='Parcial'&&initialPaid<=0)return alert('Informe o valor pago.');const initialPayments=initialPaid>0?[{amount:initialPaid,method:fPaymentMethod,date:today(),kind:'initial'}]:[];
    try{await runTransaction(db,async tx=>{const ss=await tx.get(sr);if(!ss.exists())throw new Error('NO_CONFIG');const st=ss.data();if(tablesNeeded>Number(st.tablesAvailable||0)||chairsNeeded>Number(st.chairsAvailable||0))throw new Error('NO_STOCK');tx.update(sr,{tablesAvailable:Number(st.tablesAvailable||0)-tablesNeeded,chairsAvailable:Number(st.chairsAvailable||0)-chairsNeeded,updatedAt:serverTimestamp()});if(newClientRef&&newClientPayload)tx.set(newClientRef,newClientPayload);tx.set(rr,{rentalType:'furniture',number,issued:today(),clientId,clientName,clientPhone,clientDocument,items,equipmentName:items.map(i=>i.description).join(', '),furnitureUsage:{tables:tablesNeeded,chairs:chairsNeeded},start,due,days,subtotal,freight:Number(freight||0),delivery:Number(freight||0),addition:Number(addition||0),discountType,discountInput:Number(discountInput||0),discount,total,value:total,status,paymentStatus:initialPaid>=total?'Pago':initialPaid>0?'Parcial':'Pendente',paidAmount:initialPaid,balance:Math.max(0,total-initialPaid),payments:initialPayments,createdAt:serverTimestamp(),createdBy:user.uid});});setRentOpen(false);setView({number,issued:today(),clientName,clientPhone,clientDocument,items,start,due,days,subtotal,delivery:Number(freight||0),addition:Number(addition||0),discountType,discountInput:Number(discountInput||0),discount,total,status});await logAudit(user,'furniture_rental_created','rental',rr.id,{number,total,tablesNeeded,chairsNeeded});}catch(err){console.error(err);alert(err.message==='NO_CONFIG'?'Configure primeiro o estoque de mesas e cadeiras.':err.message==='NO_STOCK'?'Estoque insuficiente de mesas ou cadeiras.':'Não foi possível registrar a locação.')}}
  async function registerFurniturePayment(e){e.preventDefault();if(!fPay)return;const fd=new FormData(e.target),amount=Math.max(0,Number(fd.get('amount')||0)),method=String(fd.get('method')||'Pix'),ref=doc(db,'companies',CID,'rentals',fPay.id);if(amount<=0)return alert('Informe o valor recebido.');try{await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('NOT_FOUND');const live=snap.data(),oldPaid=Number(live.paidAmount||0),liveTotal=Number(live.total??live.value??0),balance=Math.max(0,liveTotal-oldPaid);if(amount>balance+0.001)throw new Error('OVER');const newPaid=Math.min(liveTotal,oldPaid+amount),payments=Array.isArray(live.payments)?live.payments:[];tx.update(ref,{paidAmount:newPaid,balance:Math.max(0,liveTotal-newPaid),paymentStatus:newPaid>=liveTotal?'Pago':'Parcial',payments:[...payments,{amount,method,date:today(),kind:'payment'}],updatedAt:serverTimestamp()});});await logAudit(user,'furniture_payment','rental',fPay.id,{number:fPay.number,amount,method});setFPay(null);}catch(err){console.error(err);alert(err.message==='OVER'?'O valor informado é maior que o saldo em aberto.':'Não foi possível registrar o pagamento.')}}
  async function move(r,action){if(!confirm(`Confirmar ${action==='return'?'devolução':action==='start'?'início':'cancelamento'} da locação ${r.number}?`))return;try{await runTransaction(db,async tx=>{const rr=doc(db,'companies',CID,'rentals',r.id),sr=doc(db,'companies',CID,'equipment','furniture-stock'),rs=await tx.get(rr),ss=await tx.get(sr);if(!rs.exists()||!ss.exists())throw new Error('NOT_FOUND');const live=rs.data(),st=ss.data(),u=live.furnitureUsage||{tables:0,chairs:0};if(action==='return'&&live.status!=='Ativa')throw new Error('INVALID');if((action==='start'||action==='cancel')&&live.status!=='Reservada')throw new Error('INVALID');if(action==='return'||action==='cancel')tx.update(sr,{tablesAvailable:Math.min(Number(st.tablesTotal||0),Number(st.tablesAvailable||0)+Number(u.tables||0)),chairsAvailable:Math.min(Number(st.chairsTotal||0),Number(st.chairsAvailable||0)+Number(u.chairs||0)),updatedAt:serverTimestamp()});if(action==='return')tx.update(rr,{status:'Devolvida',returned:today(),returnedAt:serverTimestamp()});if(action==='start')tx.update(rr,{status:'Ativa',startedAt:serverTimestamp()});if(action==='cancel')tx.update(rr,{status:'Cancelada',cancelledAt:serverTimestamp()});});await logAudit(user,`furniture_rental_${action}`,'rental',r.id,{number:r.number});}catch(err){console.error(err);alert('Não foi possível concluir a operação.')}}
  const rows=sortNewest(data.rentals.filter(r=>r.rentalType==='furniture'));
  return <><Title t="Mesas e Cadeiras" s="Estoque e locações de jogos, mesas e cadeiras em um só lugar." action={<button className="primary" onClick={resetRent}><Plus/> Nova locação</button>}/>
    <div className="furnitureStock"><div className="card furnitureHero"><div><small>Mesas disponíveis</small><b>{Number(stock.tablesAvailable||0)} <em>/ {Number(stock.tablesTotal||0)}</em></b></div><div><small>Cadeiras disponíveis</small><b>{Number(stock.chairsAvailable||0)} <em>/ {Number(stock.chairsTotal||0)}</em></b></div><div><small>Jogos completos disponíveis</small><b>{completeGames}</b><em>1 mesa + 4 cadeiras</em></div><button onClick={()=>setConfigOpen(true)}><Pencil/> {stockDoc?'Editar estoque e valores':'Configurar estoque'}</button></div>
    <div className="card furnitureRates"><span>Jogo (dia útil) <b>{money(gameRate)}</b></span><span>Jogo (fim de semana) <b>{money(stock.weekendGameRate??gameRate)}</b></span><span>Mesa avulsa <b>{money(tableRate)}</b></span><span>Cadeira avulsa <b>{money(chairRate)}</b></span></div></div>
    <div className="card"><div className="sectionhead"><div><h3>Locações de mesas e cadeiras</h3><p>Contratos separados das locações de equipamentos.</p></div></div><Table rows={rows} cols={[["Nº","number"],["Cliente","clientName"],["Itens","equipmentName"],["Saída","start",r=>dateBR(r.start)],["Devolução","due",r=>dateBR(r.due)],["Total","total",r=>money(r.total??r.value)],["Pagamento","paymentStatus",r=>r.paymentStatus||"Pendente"],["Status","status",r=><StatusBadge status={rentalStatus(r)}/>]]} actions={r=><><button onClick={()=>setView(r)}>Contrato</button><button onClick={()=>setEdit(r)}><Pencil/> Editar</button>{r.status==='Reservada'&&<><button onClick={()=>move(r,'start')}><Play/> Iniciar</button><button onClick={()=>move(r,'cancel')}><Ban/> Cancelar</button></>}{r.status==='Ativa'&&<button onClick={()=>move(r,'return')}>Devolver</button>}{Number(r.paidAmount||0)<Number(r.total??r.value??0)&&r.status!=='Cancelada'&&<button onClick={()=>setFPay(r)}>Pagamento</button>}</>}/></div>
    {configOpen&&<Modal title="Estoque e valores" close={()=>setConfigOpen(false)}><form className="form grid2" onSubmit={saveConfig}><Input n="gamesTotal" l="Quantidade de jogos" type="number" min="0" v={Number(stock.tablesTotal||0)} required/><div className="full note">Cada jogo corresponde a <b>1 mesa + 4 cadeiras</b>. Ex.: 75 jogos = 75 mesas e 300 cadeiras.</div><MoneyInput n="gameRate" l="Diária do jogo (dias úteis)" v={gameRate}/><MoneyInput n="weekendGameRate" l="Diária do jogo (sábado e domingo)" v={stock.weekendGameRate??gameRate}/><MoneyInput n="tableRate" l="Diária da mesa avulsa" v={tableRate}/><MoneyInput n="chairRate" l="Diária da cadeira avulsa" v={chairRate}/><button className="primary"><Save/> Salvar</button></form></Modal>}
    {rentOpen&&<Modal title="Nova locação — Mesas e Cadeiras" close={()=>setRentOpen(false)} wide><form className="form grid2" onSubmit={saveRental}><SelectControlled l="Tipo de cliente" value={clientMode} onChange={setClientMode} opts={[["registered","Cliente cadastrado"],["walkin","Cliente avulso"]]}/>{clientMode==='registered'?<Select n="clientId" l="Cliente" opts={[["","Selecione..."],...data.clients.map(x=>[x.id,x.name])]}/>:<><Input n="walkInName" l="Nome do cliente" required/><Input n="walkInPhone" l="Telefone"/><Input n="walkInDocument" l="CPF/CNPJ (opcional)"/><label className="check full"><input name="saveClient" type="checkbox" value="yes"/> Salvar este cliente no cadastro</label></>}<InputControlled l="Data de saída" type="date" value={start} onChange={setStart}/><InputControlled l="Previsão de devolução" type="date" min={start} value={due} onChange={setDue}/><div className="full furnitureChoices"><label>Jogos <small>1 mesa + 4 cadeiras · {money(gameRate)}/dia útil · {money(stock.weekendGameRate??gameRate)}/dia fim de semana</small><input type="number" min="0" max={completeGames} value={games} onChange={e=>setGames(e.target.value)}/></label><label>Mesas avulsas <small>{Number(stock.tablesAvailable||0)} disponíveis · {money(tableRate)}/dia</small><input type="number" min="0" value={tables} onChange={e=>setTables(e.target.value)}/></label><label>Cadeiras avulsas <small>{Number(stock.chairsAvailable||0)} disponíveis · {money(chairRate)}/dia</small><input type="number" min="0" value={chairs} onChange={e=>setChairs(e.target.value)}/></label></div><MoneyControlled l="Preço por jogo/dia nesta locação (opcional: substitui tarifa automática)" value={gameRateOverride===null?priceBreakdown.gameUnitTotal/days:gameRateOverride} onChange={setGameRateOverride}/><button type="button" onClick={()=>setGameRateOverride(null)}>Usar cálculo automático por dia útil e fim de semana</button><div className="full usagePreview">Esta locação usa <b>{tablesNeeded} mesa(s)</b> e <b>{chairsNeeded} cadeira(s)</b>.</div><MoneyControlled l="Frete" value={freight} onChange={setFreight}/><MoneyControlled l="Acréscimo" value={addition} onChange={setAddition}/><div className="discountField"><label>Desconto</label><div className="discountToggle"><button type="button" className={discountType==='money'?'active':''} onClick={()=>setDiscountType('money')}>R$</button><button type="button" className={discountType==='percent'?'active':''} onClick={()=>setDiscountType('percent')}>%</button></div><input type="number" min="0" max={discountType==='percent'?100:undefined} step="0.01" value={discountInput} onChange={e=>setDiscountInput(e.target.value)}/><small>{discountType==='percent'?`${Number(discountInput||0)}% do subtotal = ${money(discount)}`:'Valor em reais'}</small></div><SelectControlled l="Situação do pagamento" value={fPaymentStatus} onChange={setFPaymentStatus} opts={['Pendente','Pago','Parcial']}/>{fPaymentStatus!=='Pendente'&&<SelectControlled l="Forma de pagamento" value={fPaymentMethod} onChange={setFPaymentMethod} opts={['Pix','Dinheiro','Débito','Crédito']}/>} {fPaymentStatus==='Parcial'&&<MoneyControlled l="Valor pago agora" value={fPaidNow} onChange={setFPaidNow}/>}<SelectControlled l="Status" value={status} onChange={setStatus} opts={['Ativa','Reservada']}/><div className="full rentalGrandTotal"><span>Subtotal <b>{money(subtotal)}</b></span>{Number(freight)>0&&<span>Frete <b>+ {money(freight)}</b></span>}{Number(addition)>0&&<span>Acréscimo <b>+ {money(addition)}</b></span>}{discount>0&&<span>Desconto {discountType==='percent'?`(${Number(discountInput||0)}%)`:''} <b>- {money(discount)}</b></span>}<strong>Total: {money(total)}</strong></div><button className="primary">Registrar locação</button></form></Modal>}
    {edit&&<EditRentalModal rental={edit} user={user} furniture close={()=>setEdit(null)}/>}
    {fPay&&<Modal title={`Registrar pagamento — ${fPay.number||''}`} close={()=>setFPay(null)}><form className="form grid2" onSubmit={registerFurniturePayment}><div className="full rentalGrandTotal"><span>Total <b>{money(fPay.total??fPay.value)}</b></span><span>Já pago <b>{money(fPay.paidAmount||0)}</b></span><strong>Saldo: {money(Math.max(0,Number(fPay.total??fPay.value??0)-Number(fPay.paidAmount||0)))}</strong></div><Input n="amount" l="Valor recebido" type="number" step="0.01" min="0.01" required/><Select n="method" l="Forma de pagamento" opts={['Pix','Dinheiro','Débito','Crédito']}/><button className="primary"><Save/> Registrar pagamento</button></form></Modal>}
    {view&&<DocumentModal item={view} cfg={cfg} type="contract" close={()=>setView(null)}/>}</>;
}

function emptyQuoteItem() {
  return { key: `${Date.now()}-${Math.random()}`, equipmentId: '', description: '', qty: 1, daily: 0, fortnightly: 0, monthly: 0, rate: 0, days: 1, manualTotal: 0, pricing: 'daily' };
}

function quoteItemSubtotal(item) {
  return item.pricing === 'manual'
    ? Math.max(0, Number(item.manualTotal || 0))
    : item.pricing === 'daily'
      ? Math.max(0, Number(item.rate ?? item.daily ?? 0) * Math.max(1, Number(item.days || 1)) * Math.max(1, Number(item.qty || 1)))
      : Math.max(0, Number(item.rate || 0) * Math.max(1, Number(item.qty || 1)));
}

function Quotes({ data, cfg, role, user }) {
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [convert, setConvert] = useState(null);

  function newQuote() {
    setForm({
      id: '',
      number: '',
      clientMode: 'registered',
      clientId: '',
      walkInName: '',
      walkInPhone: '',
      walkInDocument: '',
      saveClient: false,
      issued: today(),
      validUntil: '',
      rentalStart: today(),
      rentalDue: today(),
      discount: 0,
      addition: 0,
      delivery: 0,
      deposit: 0,
      notes: '',
      items: [emptyQuoteItem()]
    });
  }

  function editQuote(q) {
    if (q.status === 'Convertido') return alert('Este orçamento já foi convertido em locação e fica bloqueado para preservar o histórico.');
    const items = Array.isArray(q.items) && q.items.length ? q.items.map((i) => ({ ...i, key: i.key || `${Date.now()}-${Math.random()}` })) : [{ ...emptyQuoteItem(), equipmentId: q.equipmentId || '', description: q.equipmentName || '', qty: q.qty || 1, daily: q.daily || 0, days: q.days || 1, pricing: q.pricing || 'daily', manualTotal: q.pricing === 'manual' ? q.total || 0 : 0 }];
    setForm({
      ...q,
      clientMode: q.clientId ? 'registered' : 'guest',
      walkInName: q.clientName || '',
      walkInPhone: q.clientPhone || '',
      walkInDocument: q.clientDocument || '',
      saveClient: false,
      discount: Number(q.discount || 0),
      addition: Number(q.addition || 0),
      delivery: Number(q.delivery || 0),
      deposit: Number(q.deposit || 0),
      rentalStart: q.rentalStart || q.start || today(),
      rentalDue: q.rentalDue || q.due || today(),
      items
    });
  }

  function updateItem(key, patch) {
    setForm((cur) => ({ ...cur, items: cur.items.map((i) => i.key === key ? { ...i, ...patch } : i) }));
  }

  function chooseEquipment(key, equipmentId) {
    const eq = data.equipment.find((x) => x.id === equipmentId);
    if (!eq) return updateItem(key, { equipmentId: '', description: '', daily: 0, fortnightly: 0, monthly: 0, rate: 0, pricing: 'daily', manualTotal: 0 });
    updateItem(key, {
      equipmentId: eq.id,
      description: eq.name,
      daily: Number(eq.daily || 0),
      fortnightly: Number(eq.fortnightly || 0),
      monthly: Number(eq.monthly || 0),
      rate: Number(eq.daily || 0),
      pricing: eq.controlType === 'quantity' ? 'manual' : 'daily',
      manualTotal: 0
    });
  }

  function changeQuotePricing(key, mode) {
    const item = form.items.find((i) => i.key === key); if (!item) return;
    const rate = mode === 'fortnightly' ? Number(item.fortnightly || 0) : mode === 'monthly' ? Number(item.monthly || 0) : Number(item.daily || 0);
    const days = mode === 'fortnightly' ? 15 : mode === 'monthly' ? 30 : Math.max(1, Number(item.days || 1));
    const due = mode === 'fortnightly' ? addDaysISO(form.rentalStart || today(), 15) : mode === 'monthly' ? addDaysISO(form.rentalStart || today(), 30) : form.rentalDue;
    setForm((cur) => ({ ...cur, rentalDue: due, items: cur.items.map((i) => i.key === key ? { ...i, pricing: mode, rate, days } : i) }));
  }

  const itemsSubtotal = form ? form.items.reduce((sum, i) => sum + quoteItemSubtotal(i), 0) : 0;
  const quoteTotal = form ? Math.max(0, itemsSubtotal - Number(form.discount || 0) + Number(form.addition || 0) + Number(form.delivery || 0)) : 0;

  async function resolveQuoteClient() {
    if (form.clientMode === 'registered') {
      const cl = data.clients.find((x) => x.id === form.clientId);
      if (!cl) throw new Error('CLIENT_REQUIRED');
      return { clientId: cl.id, clientName: cl.name, clientPhone: cl.phone || '', clientDocument: cl.document || '' };
    }
    let clientId = '';
    let clientName = String(form.walkInName || '').trim();
    let clientPhone = String(form.walkInPhone || '').trim();
    let clientDocument = String(form.walkInDocument || '').trim();
    if (!clientName) throw new Error('CLIENT_REQUIRED');
    if (form.saveClient) {
      const duplicate = findDuplicateClient(data.clients, clientDocument, clientPhone);
      if (duplicate) {
        clientId = duplicate.id;
        clientName = duplicate.name;
        clientPhone = duplicate.phone || clientPhone;
        clientDocument = duplicate.document || clientDocument;
      } else {
        const ref = await addDoc(collection(db, 'companies', CID, 'clients'), { name: clientName, phone: clientPhone, document: clientDocument, email: '', address: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        clientId = ref.id;
      }
    }
    return { clientId, clientName, clientPhone, clientDocument };
  }

  async function saveQuote(e) {
    e.preventDefault();
    if (!form.items.length || form.items.some((i) => !String(i.description || '').trim() || Number(i.qty || 0) < 1)) return alert('Revise os itens do orçamento. Todos precisam de descrição e quantidade.');
    if (form.validUntil && form.validUntil < form.issued) return alert('A validade não pode ser anterior à data de emissão.');

    try {
      const client = await resolveQuoteClient();
      const payload = {
        ...client,
        issued: form.issued || today(),
        validUntil: form.validUntil || '',
        rentalStart: form.rentalStart || '',
        rentalDue: form.rentalDue || '',
        items: form.items.map(({ key, ...i }) => ({ ...i, qty: Math.max(1, Number(i.qty || 1)), days: Math.max(1, Number(i.days || 1)), daily: Number(i.daily || 0), fortnightly: Number(i.fortnightly||0), monthly: Number(i.monthly||0), rate: Number(i.rate??i.daily??0), manualTotal: Number(i.manualTotal || 0), subtotal: quoteItemSubtotal(i) })),
        discount: Number(form.discount || 0),
        addition: Number(form.addition || 0),
        delivery: Number(form.delivery || 0),
        deposit: Number(form.deposit || 0),
        notes: String(form.notes || '').trim(),
        subtotal: itemsSubtotal,
        total: quoteTotal,
        equipmentName: form.items.map((i) => i.description).join(', '),
        updatedAt: serverTimestamp(),
        status: form.status || 'Aberto'
      };

      if (form.id) {
        await updateDoc(doc(db, 'companies', CID, 'quotes', form.id), payload);
        await logAudit(user, 'quote_updated', 'quote', form.id, { number: form.number, total: quoteTotal });
      } else {
        const ref = doc(collection(db, 'companies', CID, 'quotes'));
        const number = makeNumber('ORC', ref.id);
        await setDoc(ref, { ...payload, number, createdAt: serverTimestamp(), createdBy: user.uid });
        await logAudit(user, 'quote_created', 'quote', ref.id, { number, total: quoteTotal });
        setView({ id: ref.id, ...payload, number });
      }
      setForm(null);
    } catch (err) {
      console.error(err);
      if (err.message === 'CLIENT_REQUIRED') return alert('Selecione ou informe o cliente.');
      alert('Não foi possível salvar o orçamento.');
    }
  }

  async function convertQuote(e) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const start = fd.start, due = fd.due, status = fd.status || 'Ativa';
    if (!isValidPeriod(start, due)) return alert('A data de devolução não pode ser anterior à saída.');
    const items = (convert.items || []).length ? convert.items : [];
    if (!items.length || items.some((i) => !i.equipmentId)) return alert('Todos os itens precisam estar vinculados a equipamentos cadastrados para converter em locação.');
    const aggregates = new Map();
    for (const item of items) aggregates.set(item.equipmentId, (aggregates.get(item.equipmentId) || 0) + Math.max(1, Number(item.qty || 1)));
    const refs = [...aggregates.keys()].map((id) => ({ id, ref: doc(db, 'companies', CID, 'equipment', id), eq: data.equipment.find((x) => x.id === id) }));
    const rentalRef = doc(collection(db, 'companies', CID, 'rentals'));
    try {
      await runTransaction(db, async (tx) => {
        const snaps=[]; for(const x of refs) snaps.push({...x,snap:await tx.get(x.ref)});
        const quoteRef=doc(db,'companies',CID,'quotes',convert.id), quoteSnap=await tx.get(quoteRef);
        if(!quoteSnap.exists()) throw new Error('QUOTE_NOT_FOUND'); if(quoteSnap.data().status==='Convertido') throw new Error('ALREADY_CONVERTED');
        for(const x of snaps){if(!x.snap.exists()) throw new Error('EQUIPMENT_NOT_FOUND'); const fb=x.eq?deriveStock(x.eq,data.rentals,data.maintenance):deriveStock({id:x.id,...x.snap.data()},data.rentals,data.maintenance); const st=stockFromDocument(x.snap.data(),fb),needed=aggregates.get(x.id); if(st.inactive||needed>st.available) throw new Error(`NO_STOCK:${x.snap.data().name||x.id}`);}
        for(const x of snaps){const fb=x.eq?deriveStock(x.eq,data.rentals,data.maintenance):deriveStock({id:x.id,...x.snap.data()},data.rentals,data.maintenance); const st=stockFromDocument(x.snap.data(),fb),needed=aggregates.get(x.id); tx.update(x.ref,stockFields(st.total,st.rented+(status==='Ativa'?needed:0),st.reserved+(status==='Reservada'?needed:0),st.maintenance,false));}
        const rentalItems=items.map(i=>({...i,qty:Math.max(1,Number(i.qty||1)),days:daysBetween(start,due),daily:Number(i.daily||0),manualTotal:Number(i.manualTotal||0),subtotal:Number(i.subtotal??quoteItemSubtotal(i))}));
        tx.set(rentalRef,{number:makeNumber('LOC',rentalRef.id),issued:today(),sourceQuoteId:convert.id,sourceQuoteNumber:convert.number,clientId:convert.clientId||'',clientName:convert.clientName,clientPhone:convert.clientPhone||'',clientDocument:convert.clientDocument||'',items:rentalItems,equipmentName:rentalItems.map(i=>i.description).join(', '),start,due,days:daysBetween(start,due),subtotal:Number(convert.subtotal||0),discount:Number(convert.discount||0),addition:Number(convert.addition||0),delivery:Number(convert.delivery||0),deposit:Number(convert.deposit||0),value:Number(convert.total||0),total:Number(convert.total||0),status,createdAt:serverTimestamp(),createdBy:user.uid});
        tx.update(quoteRef,{status:'Convertido',convertedAt:serverTimestamp(),rentalId:rentalRef.id,rentalIds:[rentalRef.id]});
      });
      await logAudit(user,'quote_converted','quote',convert.id,{number:convert.number,rentalId:rentalRef.id}); setConvert(null); alert('Orçamento convertido em uma única locação e um único contrato.');
    } catch(err){console.error(err); if(String(err.message).startsWith('NO_STOCK:')) return alert(`Estoque insuficiente para ${String(err.message).split(':').slice(1).join(':')}.`); if(err.message==='ALREADY_CONVERTED') return alert('Este orçamento já foi convertido.'); alert('Não foi possível converter o orçamento em locação.');}
  }

  async function removeQuote(r) {
    if (r.status === 'Convertido') return alert('Orçamentos convertidos não podem ser excluídos, pois fazem parte do histórico das locações.');
    await deleteDoc(doc(db, 'companies', CID, 'quotes', r.id));
    await logAudit(user, 'quote_deleted', 'quote', r.id, { number: r.number });
  }

  return (
    <>
      <Title t="Orçamentos" s="Crie, edite, exporte e converta orçamentos em locações." action={<button className="primary" onClick={newQuote}><Plus /> Novo orçamento</button>} />
      {form && <Modal title={form.id ? 'Editar orçamento' : 'Novo orçamento'} close={() => setForm(null)} wide>
        <form onSubmit={saveQuote} className="quoteForm">
          <div className="form">
            <SelectControlled l="Tipo de cliente" value={form.clientMode} onChange={(v) => setForm({ ...form, clientMode: v })} opts={[["registered", "Cliente cadastrado"], ["guest", "Cliente avulso"]]} />
            {form.clientMode === 'registered' ? <SelectControlled l="Cliente cadastrado" value={form.clientId} onChange={(v) => setForm({ ...form, clientId: v })} opts={[["", "Selecione..."], ...data.clients.map((x) => [x.id, `${x.name}${x.phone ? ` - ${x.phone}` : ''}`])]} /> : <>
              <InputControlled l="Nome do cliente" value={form.walkInName} onChange={(v) => setForm({ ...form, walkInName: v })} required />
              <InputControlled l="Telefone" value={form.walkInPhone} onChange={(v) => setForm({ ...form, walkInPhone: v })} />
              <InputControlled l="CPF/CNPJ" value={form.walkInDocument} onChange={(v) => setForm({ ...form, walkInDocument: v })} />
              <label className="check"><input type="checkbox" checked={form.saveClient} onChange={(e) => setForm({ ...form, saveClient: e.target.checked })} /> Salvar cliente no cadastro</label>
            </>}
            <InputControlled l="Emissão" type="date" value={form.issued} onChange={(v) => setForm({ ...form, issued: v })} />
            <InputControlled l="Validade" type="date" min={form.issued} value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} />
            <InputControlled l="Início previsto da locação" type="date" value={form.rentalStart} onChange={(v) => { const fixed=form.items.find(i=>i.pricing==='fortnightly'||i.pricing==='monthly'); setForm({...form,rentalStart:v,rentalDue:fixed?addDaysISO(v,fixed.pricing==='fortnightly'?15:30):form.rentalDue}); }} />
            <InputControlled l="Devolução prevista" type="date" min={form.rentalStart} value={form.rentalDue} onChange={(v) => setForm({ ...form, rentalDue: v })} />
          </div>

          <div className="quoteItems">
            <div className="sectionhead"><div><h3>Itens</h3><p>Os dados podem ser alterados apenas neste orçamento sem mudar o cadastro do equipamento.</p></div><button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyQuoteItem()] })}><Plus /> Adicionar item</button></div>
            {form.items.map((item, index) => <div className="quoteItem" key={item.key}>
              <div className="quoteItemHead"><b>Item {index + 1}</b>{form.items.length > 1 && <button type="button" className="iconDanger" onClick={() => setForm({ ...form, items: form.items.filter((x) => x.key !== item.key) })}><Trash2 /></button>}</div>
              <label>Equipamento cadastrado<select value={item.equipmentId} onChange={(e) => chooseEquipment(item.key, e.target.value)}><option value="">Selecione...</option>{data.equipment.filter((x)=>x.kind!=='furniture_stock').map((x) => <option key={x.id} value={x.id}>{x.code ? `${x.code} - ` : ''}{x.name}</option>)}</select></label>
              <InputControlled l="Descrição no orçamento" value={item.description} onChange={(v) => updateItem(item.key, { description: v })} />
              <InputControlled l="Quantidade" type="number" min="1" value={item.qty} onChange={(v) => updateItem(item.key, { qty: Number(v || 1) })} />
              {item.pricing === 'manual' ? <MoneyControlled l="Valor combinado do item" value={item.manualTotal} onChange={(v) => updateItem(item.key, { manualTotal: v })} /> : <>
                <SelectControlled l="Modalidade" value={item.pricing} onChange={(v)=>changeQuotePricing(item.key,v)} opts={[["daily","Diária"],["fortnightly","Quinzenal"],["monthly","Mensal"]]} />
                <MoneyControlled l="Valor aplicado" value={item.rate} onChange={(v) => updateItem(item.key, { rate: v })} />
                {item.pricing==='daily'&&<InputControlled l="Dias" type="number" min="1" value={item.days} onChange={(v) => { const d=Math.max(1,Number(v||1)); updateItem(item.key,{days:d}); setForm(cur=>({...cur,rentalDue:addDaysISO(cur.rentalStart||today(),d)})); }} />}
              </>}
              <div className="quoteLineTotal">Subtotal: <b>{money(quoteItemSubtotal(item))}</b></div>
            </div>)}
          </div>

          <div className="form quoteAdjustments">
            <MoneyControlled l="Desconto" value={form.discount} onChange={(v) => setForm({ ...form, discount: v })} />
            <MoneyControlled l="Acréscimo" value={form.addition} onChange={(v) => setForm({ ...form, addition: v })} />
            <MoneyControlled l="Entrega / transporte" value={form.delivery} onChange={(v) => setForm({ ...form, delivery: v })} />
            <MoneyControlled l="Caução (informativa)" value={form.deposit} onChange={(v) => setForm({ ...form, deposit: v })} />
            <label className="full">Observações<textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <div className="quoteGrandTotal"><span>Subtotal {money(itemsSubtotal)}</span><strong>Total {money(quoteTotal)}</strong></div>
          <button className="primary"><Save /> Salvar orçamento</button>
        </form>
      </Modal>}
      {view && <DocumentModal item={view} cfg={cfg} type="quote" close={() => setView(null)} />}
      {convert && <Modal title={`Converter ${convert.number} em locação`} close={() => setConvert(null)}><form onSubmit={convertQuote} className="form">
        <Input n="start" l="Data de saída" type="date" v={convert.rentalStart || today()} required />
        <Input n="due" l="Previsão de devolução" type="date" v={convert.rentalDue || today()} required />
        <Select n="status" l="Status inicial" v="Ativa" opts={['Ativa', 'Reservada']} />
        <div className="full note">Será criada uma única locação e um único contrato com {convert.items?.length || 0} item(ns). O estoque de todos os itens é validado antes de qualquer alteração.</div>
        <button className="primary"><ArrowRightLeft /> Converter</button>
      </form></Modal>}
      <div className="card"><Table rows={sortNewest(data.quotes)} cols={[
        ['Nº', 'number'],
        ['Cliente', 'clientName'],
        ['Itens', 'items', (r) => r.items?.length || 1],
        ['Total', 'total', (r) => money(r.total)],
        ['Validade', 'validUntil', (r) => dateBR(r.validUntil)],
        ['Status', 'status', (r) => <StatusBadge status={r.status || 'Aberto'} />]
      ]} actions={(r) => <>
        <button onClick={() => setView(r)}>Abrir</button>
        {r.status !== 'Convertido' && <button onClick={() => editQuote(r)}><Pencil /> Editar</button>}
        {r.status !== 'Convertido' && <button onClick={() => setConvert(r)}><ArrowRightLeft /> Locação</button>}
        {role === 'admin' && <Del onClick={() => confirmDel('este orçamento', () => removeQuote(r))} />}
      </>} /></div>
    </>
  );
}

function DocumentModal({ item, cfg, type, close }) {
  const id = 'printdoc';
  const isQuote = type === 'quote';
  const items = Array.isArray(item.items) && item.items.length ? item.items : [{ description: item.equipmentName || '—', qty: item.qty || 1, daily: item.daily || 0, days: item.days || 1, pricing: item.pricing || 'daily', subtotal: item.total ?? item.value ?? 0 }];

  async function captureStory() {
    const el = document.getElementById(id);
    el.classList.add('story-export');
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(el, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false, width: 1080, height: 1920, windowWidth: 1080, windowHeight: 1920, scrollX: 0, scrollY: 0 });
      const a = document.createElement('a');
      a.download = `${type}-${item.number}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } finally {
      el.classList.remove('story-export');
    }
  }

  async function pdf() {
    const el = document.getElementById(id);
    el.classList.add('pdf-export');
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const p = new jsPDF('p', 'mm', 'a4');
      const w = 190;
      const h = canvas.height * 190 / canvas.width;
      if (h <= 277) p.addImage(img, 'JPEG', 10, 10, w, h);
      else {
        let offset = 0;
        let page = 0;
        while (offset < h) {
          if (page++) p.addPage();
          p.addImage(img, 'JPEG', 10, 10 - offset, w, h);
          offset += 277;
        }
      }
      p.save(`${type}-${item.number}.pdf`);
    } finally {
      el.classList.remove('pdf-export');
    }
  }

  return (
    <Modal title={isQuote ? 'Orçamento' : 'Contrato'} close={close} wide>
      <div id={id} className={`document ${isQuote ? 'quote-document' : 'contract-document'}`}>
        <div className="docTop">
          <img className="docLogo" src="/logo-source.png" alt="LOQ MAIS" />
          <div className="docTitleBox"><div className="docKind">{isQuote ? 'ORÇAMENTO' : 'CONTRATO DE LOCAÇÃO'}</div><div className="docNumber">Nº {item.number}</div>{item.issued && <div className="docIssue">Emissão: <b>{dateBR(item.issued)}</b></div>}</div>
        </div>
        <div className="docCompany">
          {cfg?.cnpj && <span><b>CNPJ:</b> {cfg.cnpj}</span>}
          {cfg?.phone && <span><b>Telefone:</b> {cfg.phone}</span>}
          {cfg?.email && <span><b>E-mail:</b> {cfg.email}</span>}
          {cfg?.address && <span><b>Endereço:</b> {cfg.address}</span>}
        </div>
        <div className="docSection">
          <div className="docSectionTitle">CLIENTE</div>
          <div className="docClientGrid">
            <div><small>Nome / Razão social</small><strong>{item.clientName || '—'}</strong></div>
            <div><small>CPF/CNPJ</small><strong>{item.clientDocument || '—'}</strong></div>
            <div><small>Telefone</small><strong>{item.clientPhone || '—'}</strong></div>
            {isQuote && item.validUntil && <div><small>Validade</small><strong>{dateBR(item.validUntil)}</strong></div>}
          </div>
        </div>
        {!isQuote && <div className="docDates"><div><small>Retirada</small><strong>{dateBR(item.start)}</strong></div><div><small>Devolução prevista</small><strong>{dateBR(item.due)}</strong></div></div>}
        <div className="docSection equipmentSection">
          <div className="docSectionTitle">ITENS</div>
          {items.map((i, index) => <div className="docItemCard" key={`${i.description}-${index}`}>
            <div className="docEquipmentName">{i.description || item.equipmentName || '—'}</div>
            <div className="docMetrics">
              <div><small>Quantidade</small><strong>{i.qty || 1}</strong></div>
              {i.pricing === 'manual' ? <div><small>Valor combinado</small><strong>{money(i.subtotal ?? i.manualTotal ?? item.total)}</strong></div> : <><div><small>Modalidade</small><strong>{i.pricing==='fortnightly'?'Quinzenal':i.pricing==='monthly'?'Mensal':'Diária'}</strong></div><div><small>Valor aplicado</small><strong>{money(i.rate ?? i.daily)}</strong></div>{i.pricing==='daily'&&<div><small>Período</small><strong>{i.days || item.days || 1} dia(s)</strong></div>}<div><small>Subtotal</small><strong>{money(i.subtotal ?? quoteItemSubtotal(i))}</strong></div></>}
            </div>
          </div>)}
        </div>
        <div className="docAdjustment neutral"><span>Subtotal dos itens</span><b>{money(item.subtotal ?? item.total ?? item.value)}</b></div>
        {Number(item.discount || 0) > 0 && <div className="docAdjustment"><span>Desconto{item.discountType==='percent' ? ` (${Number(item.discountInput||0)}%)` : ''}</span><b>- {money(item.discount)}</b></div>}
        {Number(item.addition || 0) > 0 && <div className="docAdjustment"><span>Acréscimo</span><b>+ {money(item.addition)}</b></div>}
        {Number(item.delivery || 0) > 0 && <div className="docAdjustment"><span>Frete</span><b>+ {money(item.delivery)}</b></div>}
        {Number(item.adjustment || 0) !== 0 && !item.discount && !item.addition && !item.delivery && <div className="docAdjustment"><span>Ajuste</span><b>{Number(item.adjustment)>0?'+ ':''}{money(item.adjustment)}</b></div>}
        {Number(item.deposit || 0) > 0 && <div className="docAdjustment neutral"><span>Caução</span><b>{money(item.deposit)}</b></div>}
        <div className="docTotal"><span>VALOR TOTAL</span><b>{money(item.total ?? item.value)}</b></div>
        {!isQuote && <><div className="docAdjustment neutral"><span>Pagamento</span><b>{item.paymentStatus||'Pendente'}</b></div>{Number(item.paidAmount||0)>0&&<div className="docAdjustment neutral"><span>Valor pago</span><b>{money(item.paidAmount)}</b></div>}{Number(item.balance||0)>0&&<div className="docAdjustment"><span>Saldo em aberto</span><b>{money(item.balance)}</b></div>}</>}
        {item.notes && <div className="docNotes"><b>Observações</b><p>{item.notes}</p></div>}
        {type === 'contract' && <div className="docTerms"><div className="docSectionTitle">TERMOS E CONDIÇÕES</div><pre>{cfg?.terms || baseTerms}</pre></div>}
        <div className="sign"><span>Responsável / LOQ MAIS</span><span>Cliente</span></div>
      </div>
      <div className="actions"><button onClick={pdf}><Download /> PDF / Imprimir</button><button onClick={captureStory}><ImageIcon /> Imagem 9:16</button></div>
    </Modal>
  );
}

function Maintenance({ data, role, user }) {
  const [form, setForm] = useState(false);

  async function createMaintenance(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const eq = data.equipment.find((x) => x.id === f.equipmentId);
    if (!eq) return alert('Selecione o equipamento.');
    const qty = Math.max(1, Number(f.qty || 1));
    const fallback = deriveStock(eq, data.rentals, data.maintenance);
    const maintenanceRef = doc(collection(db, 'companies', CID, 'maintenance'));

    try {
      await runTransaction(db, async (tx) => {
        const eqRef = doc(db, 'companies', CID, 'equipment', eq.id);
        const snap = await tx.get(eqRef);
        if (!snap.exists()) throw new Error('NOT_FOUND');
        const s = stockFromDocument(snap.data(), fallback);
        if (s.inactive) throw new Error('INACTIVE');
        if (qty > s.available) throw new Error('NO_STOCK');
        tx.update(eqRef, stockFields(s.total, s.rented, s.reserved, s.maintenance + qty, false));
        tx.set(maintenanceRef, {
          equipmentId: eq.id,
          equipmentName: eq.name,
          code: eq.code || '',
          qty,
          start: f.start || today(),
          end: '',
          reason: String(f.reason || '').trim(),
          notes: String(f.notes || '').trim(),
          status: 'Em manutenção',
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      });
      await logAudit(user, 'maintenance_created', 'maintenance', maintenanceRef.id, { equipment: eq.name, qty });
      setForm(false);
    } catch (err) {
      console.error(err);
      if (err.message === 'NO_STOCK') return alert('A quantidade enviada para manutenção é maior que o estoque disponível. Unidades alugadas ou reservadas não podem entrar em manutenção.');
      alert('Não foi possível registrar a manutenção.');
    }
  }

  async function finish(m) {
    if (!window.confirm(`Finalizar a manutenção de ${m.qty || 1} unidade(s) de "${m.equipmentName}"?`)) return;
    const eq = data.equipment.find((x) => x.id === m.equipmentId);
    const fallback = eq ? deriveStock(eq, data.rentals, data.maintenance) : null;
    try {
      await runTransaction(db, async (tx) => {
        const mRef = doc(db, 'companies', CID, 'maintenance', m.id);
        const eqRef = doc(db, 'companies', CID, 'equipment', m.equipmentId);
        const mSnap = await tx.get(mRef);
        const eqSnap = await tx.get(eqRef);
        if (!mSnap.exists() || !eqSnap.exists()) throw new Error('NOT_FOUND');
        if (mSnap.data().status === 'Finalizada') throw new Error('ALREADY_FINISHED');
        const s = stockFromDocument(eqSnap.data(), fallback || deriveStock({ id: m.equipmentId, ...eqSnap.data() }, data.rentals, data.maintenance));
        const q = Math.max(1, Number(mSnap.data().qty || 1));
        tx.update(eqRef, stockFields(s.total, s.rented, s.reserved, Math.max(0, s.maintenance - q), s.inactive));
        tx.update(mRef, { status: 'Finalizada', end: today(), finishedAt: serverTimestamp() });
      });
      await logAudit(user, 'maintenance_finished', 'maintenance', m.id, { equipment: m.equipmentName, qty: m.qty || 1 });
    } catch (err) {
      console.error(err);
      if (err.message === 'ALREADY_FINISHED') return alert('Esta manutenção já foi finalizada.');
      alert('Não foi possível finalizar a manutenção.');
    }
  }

  async function removeMaintenance(m) {
    if (m.status !== 'Finalizada' && m.status !== 'Cancelada') return alert('Finalize a manutenção antes de excluir o registro.');
    await deleteDoc(doc(db, 'companies', CID, 'maintenance', m.id));
    await logAudit(user, 'maintenance_deleted', 'maintenance', m.id, { equipment: m.equipmentName });
  }

  const availableEquipment = data.equipment.filter((eq)=>eq.kind!=='furniture_stock').filter((eq) => deriveStock(eq, data.rentals, data.maintenance).available > 0 && eq.status !== 'Inativo');
  const rows = [...data.maintenance].sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));

  return (
    <>
      <Title t="Manutenção" s="Histórico e quantidade de unidades em manutenção." action={<button className="primary" onClick={() => setForm(true)}><Plus /> Nova manutenção</button>} />
      {form && <Modal title="Registrar manutenção" close={() => setForm(false)}><form className="form" onSubmit={createMaintenance}>
        <Select n="equipmentId" l="Equipamento" opts={[["", "Selecione..."], ...availableEquipment.map((x) => { const s = deriveStock(x, data.rentals, data.maintenance); return [x.id, `${x.code || ''} - ${x.name} (${s.available} disponível(is))`]; })]} />
        <Input n="qty" l="Quantidade" type="number" min="1" v="1" required />
        <Input n="start" l="Data de entrada" type="date" v={today()} required />
        <Input n="reason" l="Motivo" required />
        <Input n="notes" l="Observações" />
        <button className="primary">Registrar manutenção</button>
      </form></Modal>}
      <div className="card"><Table rows={rows} cols={[
        ['Equipamento', 'equipmentName'], ['Qtd.', 'qty'], ['Entrada', 'start', (r) => dateBR(r.start)], ['Saída', 'end', (r) => dateBR(r.end)], ['Motivo', 'reason'], ['Status', 'status', (r) => <StatusBadge status={r.status} />]
      ]} actions={(r) => <>{r.status !== 'Finalizada' && <button onClick={() => finish(r)}>Finalizar</button>}{role === 'admin' && <Del onClick={() => confirmDel('este registro de manutenção', () => removeMaintenance(r))} />}</>} /></div>
    </>
  );
}

function Reports({ data, cfg }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [from, setFrom] = useState(localISO(monthStart));
  const [to, setTo] = useState(localISO(monthEnd));
  const [preset, setPreset] = useState('month');

  function applyPreset(v) {
    setPreset(v);
    const n = new Date();
    const y = n.getFullYear();
    const m = n.getMonth();
    if (v === 'today') { setFrom(today()); setTo(today()); }
    if (v === 'week') {
      const d = new Date(y, m, n.getDate());
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      setFrom(localISO(d));
      setTo(today());
    }
    if (v === 'month') { setFrom(localISO(new Date(y, m, 1))); setTo(localISO(new Date(y, m + 1, 0))); }
    if (v === 'prev') { setFrom(localISO(new Date(y, m - 1, 1))); setTo(localISO(new Date(y, m, 0))); }
    if (v === 'year') { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
  }

  const inRange = (v) => v && v >= from && v <= to;
  const rentals = data.rentals.filter((r) => inRange(r.start));
  const maint = data.maintenance.filter((m) => inRange(m.start));
  const revenue = rentals.reduce((a, r) => a + Number(r.total ?? r.value ?? 0), 0);
  const ticket = rentals.length ? revenue / rentals.length : 0;
  const late = rentals.filter((r) => rentalStatus(r) === 'Atrasada').length;
  const customers = new Set(rentals.map((r) => r.clientId || r.clientName).filter(Boolean)).size;
  // Financeiro: pagamentos são filtrados pela data em que o dinheiro foi recebido,
  // enquanto saldo/pendência considera as locações iniciadas no período selecionado.
  const periodPayments = data.rentals.flatMap((r) => (Array.isArray(r.payments) ? r.payments : []).filter((p) => inRange(p.date)).map((p) => ({ ...p, rental: r })));
  const received = periodPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paymentMethods = ['Pix','Dinheiro','Débito','Crédito'].map((method) => {
    const rows = periodPayments.filter((p) => p.method === method);
    return { method, count: rows.length, total: rows.reduce((sum, p) => sum + Number(p.amount || 0), 0) };
  }).filter((x) => x.count > 0);
  const paidRentals = rentals.filter((r) => (r.paymentStatus || (Number(r.paidAmount||0) >= Number(r.total??r.value??0) ? 'Pago' : 'Pendente')) === 'Pago').length;
  const partialRentals = rentals.filter((r) => (r.paymentStatus || '') === 'Parcial').length;
  const pendingRentals = rentals.filter((r) => Number(r.balance ?? Math.max(0, Number(r.total??r.value??0)-Number(r.paidAmount||0))) > 0.001).length;
  const outstanding = rentals.reduce((sum, r) => sum + Number(r.balance ?? Math.max(0, Number(r.total??r.value??0)-Number(r.paidAmount||0))), 0);
  const debtors = rentals.filter((r) => Number(r.balance ?? Math.max(0, Number(r.total??r.value??0)-Number(r.paidAmount||0))) > 0.001).map((r) => ({
    id:r.id, number:r.number, clientName:r.clientName || 'Cliente', total:Number(r.total??r.value??0), paid:Number(r.paidAmount||0), balance:Number(r.balance ?? Math.max(0, Number(r.total??r.value??0)-Number(r.paidAmount||0))), status:r.paymentStatus || 'Pendente'
  })).sort((a,b)=>b.balance-a.balance);
  const renewalEvents = data.rentals.flatMap((r) => (Array.isArray(r.renewals) ? r.renewals : []).filter((x) => inRange(x.date)).map((x) => ({...x, rental:r})));
  const renewedClients = new Set(renewalEvents.map((x) => x.rental.clientId || x.rental.clientName).filter(Boolean)).size;
  const renewedRentals = new Set(renewalEvents.map((x) => x.rental.id || x.rental.number).filter(Boolean)).size;
  const renewalRevenue = renewalEvents.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const byEquipment = {};
  rentals.forEach((r) => {
    const ris = rentalItemsOf(r);
    const itemBase = ris.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
    ris.forEach((i) => {
      const k = i.equipmentId || i.description || r.equipmentName || 'Sem nome';
      const name = i.description || r.equipmentName || 'Sem nome';
      if (!byEquipment[k]) byEquipment[k] = { name, count: 0, days: 0, revenue: 0 };
      byEquipment[k].count += 1;
      byEquipment[k].days += Number(r.days || daysBetween(r.start, r.due)) * Math.max(1, Number(i.qty || 1));
      const share = itemBase > 0 ? Number(i.subtotal || 0) / itemBase : 1 / Math.max(1, ris.length);
      byEquipment[k].revenue += Number(r.total ?? r.value ?? 0) * share;
    });
  });
  const ranking = Object.values(byEquipment).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const maxCount = Math.max(1, ...ranking.map((x) => x.count));
  const byClient = {};
  rentals.forEach((r) => {
    const k = r.clientName || 'Cliente';
    if (!byClient[k]) byClient[k] = { name: k, count: 0, total: 0 };
    byClient[k].count += 1;
    byClient[k].total += Number(r.total ?? r.value ?? 0);
  });
  const clients = Object.values(byClient).sort((a, b) => b.total - a.total);
  const statusCounts = { total: 0, available: 0, rented: 0, reserved: 0, maintenance: 0, inactive: 0 };
  data.equipment.filter((eq)=>eq.kind!=='furniture_stock').forEach((eq) => {
    const s = deriveStock(eq, data.rentals, data.maintenance);
    statusCounts.total += s.total;
    statusCounts.available += s.available;
    statusCounts.rented += s.rented;
    statusCounts.reserved += s.reserved;
    statusCounts.maintenance += s.maintenance;
    if (s.inactive) statusCounts.inactive += s.total;
  });

  async function exportPDF() {
    const el = document.getElementById('report-print');
    el.classList.add('report-pdf');
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff', useCORS: true, logging: false });
      const img = canvas.toDataURL('image/jpeg', 0.94);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = 190;
      const ph = 277;
      const ih = canvas.height * pw / canvas.width;
      let offset = 0;
      let page = 0;
      while (offset < ih) {
        if (page++) pdf.addPage();
        pdf.addImage(img, 'JPEG', 10, 10 - offset, pw, ih);
        offset += ph;
      }
      pdf.save(`relatorio-loqmais-${from}-a-${to}.pdf`);
    } finally {
      el.classList.remove('report-pdf');
    }
  }

  return (
    <>
      <Title t="Relatórios" s="Indicadores operacionais e financeiros por período." />
      <div className="reportFilters card">
        <label>Período<select value={preset} onChange={(e) => applyPreset(e.target.value)}><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option><option value="prev">Mês anterior</option><option value="year">Este ano</option><option value="custom">Personalizado</option></select></label>
        <label>De<input type="date" value={from} onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }} /></label>
        <label>Até<input type="date" value={to} onChange={(e) => { setPreset('custom'); setTo(e.target.value); }} /></label>
        <button className="primary" onClick={exportPDF}><Download /> Exportar PDF</button>
        <button onClick={() => window.print()}>Imprimir</button>
      </div>
      <div id="report-print" className="reportPrint">
        <div className="reportPrintHead"><img src="/logo-source.png" alt="LOQ MAIS" /><div><h2>RELATÓRIO GERENCIAL</h2><p>{dateBR(from)} a {dateBR(to)}</p></div></div>
        <div className="reportKpis">
          <div className="reportKpi blue"><span>Locações</span><b>{rentals.length}</b><small>no período</small></div>
          <div className="reportKpi green"><span>Valor em locações</span><b>{money(revenue)}</b><small>total registrado</small></div>
          <div className="reportKpi orange"><span>Ticket médio</span><b>{money(ticket)}</b><small>por locação</small></div>
          <div className="reportKpi red"><span>Atrasadas</span><b>{late}</b><small>do período</small></div>
          <div className="reportKpi purple"><span>Manutenções</span><b>{maint.reduce((n, m) => n + Math.max(1, Number(m.qty || 1)), 0)}</b><small>unidades no período</small></div>
          <div className="reportKpi teal"><span>Clientes atendidos</span><b>{customers}</b><small>clientes diferentes</small></div>
          <div className="reportKpi green"><span>Recebido</span><b>{money(received)}</b><small>pagamentos no período</small></div>
          <div className="reportKpi red"><span>A receber</span><b>{money(outstanding)}</b><small>saldo das locações do período</small></div>
          <div className="reportKpi purple"><span>Clientes que renovaram</span><b>{renewedClients}</b><small>{renewedRentals} locação(ões) renovada(s)</small></div>
        </div>
        <div className="reportGrid">
          <div className="card reportPanel"><h3>Equipamentos mais alugados</h3>{ranking.length ? ranking.slice(0, 8).map((x, i) => <div className="rankRow" key={x.name}><span className="rankNo">{i + 1}</span><div className="rankBody"><div><b>{x.name}</b><span>{x.count} locação(ões)</span></div><div className="rankTrack"><i style={{ width: `${x.count / maxCount * 100}%` }} /></div></div></div>) : <p className="emptyReport">Sem locações neste período.</p>}</div>
          <div className="card reportPanel"><h3>Situação atual do estoque</h3><div className="statusGrid"><div><span>Total cadastrado</span><b>{statusCounts.total}</b></div><div><span>Disponível</span><b>{statusCounts.available}</b></div><div><span>Alugado</span><b>{statusCounts.rented}</b></div><div><span>Reservado</span><b>{statusCounts.reserved}</b></div><div><span>Manutenção</span><b>{statusCounts.maintenance}</b></div><div><span>Inativo</span><b>{statusCounts.inactive}</b></div></div></div>
        </div>
        <div className="reportGrid">
          <div className="card reportPanel"><h3>Financeiro / Pagamentos</h3><div className="statusGrid"><div><span>Pagas</span><b>{paidRentals}</b></div><div><span>Parciais</span><b>{partialRentals}</b></div><div><span>Com saldo</span><b>{pendingRentals}</b></div><div><span>Recebido</span><b>{money(received)}</b></div><div><span>A receber</span><b>{money(outstanding)}</b></div><div><span>Renovações</span><b>{renewalEvents.length}</b></div></div></div>
          <div className="card reportPanel"><h3>Formas de pagamento</h3><div className="reportTable"><table><thead><tr><th>Forma</th><th>Pagamentos</th><th>Valor</th></tr></thead><tbody>{paymentMethods.length ? paymentMethods.map((x)=><tr key={x.method}><td>{x.method}</td><td>{x.count}</td><td>{money(x.total)}</td></tr>) : <tr><td colSpan="3">Nenhum pagamento registrado no período.</td></tr>}</tbody></table></div></div>
        </div>
        <div className="card reportPanel"><h3>Clientes com saldo em aberto</h3><div className="reportTable"><table><thead><tr><th>Cliente</th><th>Locação</th><th>Total</th><th>Pago</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{debtors.length ? debtors.map((x)=><tr key={x.id}><td>{x.clientName}</td><td>{x.number||'-'}</td><td>{money(x.total)}</td><td>{money(x.paid)}</td><td>{money(x.balance)}</td><td>{x.status}</td></tr>) : <tr><td colSpan="6">Nenhum saldo em aberto nas locações do período.</td></tr>}</tbody></table></div></div>
        <div className="card reportPanel"><h3>Renovações no período</h3><div className="statusGrid"><div><span>Clientes que renovaram</span><b>{renewedClients}</b></div><div><span>Locações renovadas</span><b>{renewedRentals}</b></div><div><span>Total de renovações</span><b>{renewalEvents.length}</b></div><div><span>Valor acrescentado</span><b>{money(renewalRevenue)}</b></div></div></div>
        <div className="card reportPanel"><h3>Desempenho dos equipamentos</h3><div className="reportTable"><table><thead><tr><th>Equipamento</th><th>Locações</th><th>Unidade-dias</th><th>Valor</th></tr></thead><tbody>{ranking.length ? ranking.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.count}</td><td>{x.days}</td><td>{money(x.revenue)}</td></tr>) : <tr><td colSpan="4">Sem dados no período.</td></tr>}</tbody></table></div></div>
        <div className="reportGrid">
          <div className="card reportPanel"><h3>Clientes no período</h3><div className="reportTable"><table><thead><tr><th>Cliente</th><th>Locações</th><th>Valor</th></tr></thead><tbody>{clients.length ? clients.slice(0, 10).map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.count}</td><td>{money(x.total)}</td></tr>) : <tr><td colSpan="3">Sem dados.</td></tr>}</tbody></table></div></div>
          <div className="card reportPanel"><h3>Manutenções no período</h3><div className="reportTable"><table><thead><tr><th>Equipamento</th><th>Qtd.</th><th>Entrada</th><th>Status</th></tr></thead><tbody>{maint.length ? maint.map((x) => <tr key={x.id}><td>{x.equipmentName}</td><td>{x.qty || 1}</td><td>{dateBR(x.start)}</td><td>{x.status}</td></tr>) : <tr><td colSpan="4">Nenhuma manutenção registrada.</td></tr>}</tbody></table></div></div>
        </div>
        <div className="reportFooter">Emitido em {new Date().toLocaleString('pt-BR')} • {cfg?.name || 'LOQ MAIS'}</div>
      </div>
    </>
  );
}

function isStandaloneApp() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.__loqPwa?.installed === true
  );
}

function InstallApp() {
  const [promptEvent, setPromptEvent] = useState(() => window.__loqPwa?.prompt || null);
  const [installed, setInstalled] = useState(() => isStandaloneApp());
  const [diagnostics, setDiagnostics] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installState, setInstallState] = useState('idle');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const android = /android/i.test(navigator.userAgent);
  const host = window.location.hostname;
  const previewHost = host.endsWith('.loqmais.pages.dev') && host !== 'loqmais.pages.dev';

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const updateStandalone = () => {
      if (isStandaloneApp()) {
        setInstalled(true);
        setInstallState('installed');
      }
    };
    const updatePrompt = () => {
      setPromptEvent(window.__loqPwa?.prompt || null);
      setInstallState('ready');
    };
    const installedHandler = () => {
      setInstalled(true);
      setPromptEvent(null);
      setInstallState('installed');
    };

    updateStandalone();
    window.addEventListener('loq-pwa-prompt', updatePrompt);
    window.addEventListener('loq-pwa-installed', installedHandler);
    media?.addEventListener?.('change', updateStandalone);
    return () => {
      window.removeEventListener('loq-pwa-prompt', updatePrompt);
      window.removeEventListener('loq-pwa-installed', installedHandler);
      media?.removeEventListener?.('change', updateStandalone);
    };
  }, []);

  async function runDiagnostics() {
    const secure = window.isSecureContext;
    const manifestLink = Boolean(document.querySelector('link[rel="manifest"]'));
    let manifestOk = false;
    let swRegistered = false;
    const swControlled = Boolean(navigator.serviceWorker?.controller);
    let icon192 = false;
    let icon512 = false;
    try {
      const res = await fetch('/manifest.webmanifest', { cache: 'no-store' });
      const manifest = res.ok ? await res.json() : null;
      manifestOk = Boolean(res.ok && manifest?.name && manifest?.start_url && manifest?.display === 'standalone');
      const icons = manifest?.icons || [];
      icon192 = icons.some((i) => String(i.sizes || '').includes('192x192'));
      icon512 = icons.some((i) => String(i.sizes || '').includes('512x512'));
    } catch (_) {}
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        swRegistered = Boolean(reg?.active || reg?.waiting || reg?.installing);
      }
    } catch (_) {}
    const d = {
      secure,
      manifestLink,
      manifestOk,
      swRegistered,
      swControlled,
      icon192,
      icon512,
      prompt: Boolean(window.__loqPwa?.prompt || promptEvent),
      installed: isStandaloneApp(),
      officialHost: host === 'loqmais.pages.dev'
    };
    setDiagnostics(d);
    return d;
  }

  async function install() {
    if (isStandaloneApp()) {
      setInstalled(true);
      return;
    }

    // Cloudflare cria um endereço diferente para cada implantação de teste.
    // A instalação definitiva deve partir do endereço principal para não ficar presa a um preview antigo.
    if (previewHost) {
      window.location.assign('https://loqmais.pages.dev/?install=1');
      return;
    }

    const p = window.__loqPwa?.prompt || promptEvent;
    if (p) {
      try {
        setInstallState('prompting');
        await p.prompt();
        const choice = await p.userChoice;
        window.__loqPwa.prompt = null;
        setPromptEvent(null);
        if (choice?.outcome === 'accepted') {
          // Não marcamos como instalado apenas porque o usuário aceitou o prompt.
          // O estado só muda com appinstalled/display-mode standalone.
          setInstallState('accepted');
          setShowHelp(true);
          setTimeout(() => runDiagnostics(), 1200);
        } else {
          setInstallState('dismissed');
          setShowHelp(true);
          await runDiagnostics();
        }
        return;
      } catch (err) {
        console.error('Falha no prompt de instalação:', err);
      }
    }

    setInstallState('manual');
    await runDiagnostics();
    setShowHelp(true);
  }

  return (
    <div className="card installCard">
      <div className="installMain">
        <div><h2><Smartphone /> Instalar LOQ MAIS</h2><p>Instale o sistema no telefone para abrir em tela própria, como aplicativo.</p></div>
        {installed ? <span className="installedBadge"><CheckCircle2 /> Aplicativo instalado</span> : <button className="primary" onClick={install}><Smartphone /> Instalar aplicativo</button>}
      </div>

      {!installed && installState === 'accepted' && <div className="installInfo"><CheckCircle2 /><span>Solicitação de instalação aceita. Aguarde a confirmação do navegador. O sistema só será marcado como instalado quando a instalação realmente terminar.</span></div>}

      {showHelp && !installed && <div className="installHelpPanel">
        {previewHost ? <div className="installInfo"><Smartphone /><span>Este é um endereço temporário de implantação. Toque em <b>Instalar aplicativo</b> novamente para abrir automaticamente o endereço principal do sistema.</span></div> : ios ? <p><b>iPhone/iPad:</b> abra no Safari → Compartilhar → Adicionar à Tela de Início.</p> : android ? <p><b>Android:</b> se o Chrome não abrir a janela de instalação, toque em ⋮ → <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p> : <p>Abra o menu do navegador e procure por <b>Instalar aplicativo</b>.</p>}
        <div className="installHelpActions">
          <button type="button" onClick={runDiagnostics}><RefreshCw /> Verificar instalação</button>
          {!previewHost && <button type="button" onClick={() => window.location.reload()}><RefreshCw /> Recarregar página</button>}
        </div>
        {diagnostics && <div className="pwaDiagnostics">
          <Diagnostic ok={diagnostics.secure} label="HTTPS / contexto seguro" />
          <Diagnostic ok={diagnostics.manifestLink && diagnostics.manifestOk} label="Manifest reconhecido" />
          <Diagnostic ok={diagnostics.icon192 && diagnostics.icon512} label="Ícones 192 e 512" />
          <Diagnostic ok={diagnostics.swRegistered} label="Service Worker registrado" />
          <Diagnostic ok={diagnostics.swControlled} label="Página controlada pelo Service Worker" />
          <Diagnostic ok={diagnostics.prompt} label="Prompt nativo liberado pelo navegador" />
          <Diagnostic ok={diagnostics.officialHost} label="Endereço principal loqmais.pages.dev" />
        </div>}
      </div>}
    </div>
  );
}

function Diagnostic({ ok, label }) {
  return <div className={ok ? 'diagOk' : 'diagBad'}>{ok ? <CheckCircle2 /> : <AlertTriangle />}<span>{label}</span></div>;
}

function Config({ cfg, setCfg, role, data, user }) {
  const [local, setLocal] = useState(cfg);
  const [newUser, setNewUser] = useState(false);
  const [googleAdminEmail, setGoogleAdminEmail] = useState('');

  useEffect(() => setLocal(cfg), [cfg]);

  async function save() {
    await updateDoc(doc(db, 'companies', CID), { settings: local });
    setCfg(local);
    await logAudit(user, 'settings_updated', 'company', CID);
    alert('Configurações salvas.');
  }

  async function addGoogleAdmin(e) {
    e.preventDefault();
    const email = googleAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return alert('Informe um e-mail Google válido.');
    try {
      await setDoc(doc(db, 'companies', CID, 'adminInvites', email), { email, role: 'admin', active: true, createdBy: user.uid, createdAt: serverTimestamp() });
      setGoogleAdminEmail('');
      await logAudit(user, 'admin_invited', 'adminInvite', email, { email });
      alert('E-mail autorizado. A pessoa deve entrar pelo botão Google usando exatamente esse e-mail.');
    } catch (err) {
      console.error(err);
      alert('Não foi possível autorizar o administrador.');
    }
  }

  async function revokeInvite(invite) {
    await deleteDoc(doc(db, 'companies', CID, 'adminInvites', invite.id));
    await logAudit(user, 'admin_invite_revoked', 'adminInvite', invite.id);
  }

  async function createMember(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const email = userEmail(f.username);
    const secondary = initializeApp(auth.app.options, `create-user-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, f.password);
      await setDoc(doc(db, 'companies', CID, 'members', cred.user.uid), {
        name: String(f.name || '').trim(),
        username: String(f.username || '').trim().toLowerCase(),
        email,
        provider: 'password',
        role: f.role || 'employee',
        active: true,
        createdAt: serverTimestamp()
      });
      await signOut(secondaryAuth);
      setNewUser(false);
      await logAudit(user, 'member_created', 'member', cred.user.uid, { name: f.name, role: f.role });
      alert('Usuário criado com sucesso.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') alert('Este nome de usuário já existe.');
      else if (err.code === 'auth/operation-not-allowed') alert('Ative o método E-mail/Senha em Firebase Authentication → Método de login.');
      else alert(`Não foi possível criar: ${err.message}`);
    } finally {
      try { await deleteApp(secondary); } catch (_) {}
    }
  }

  async function removeMember(m) {
    if (m.id === user.uid) return alert('Você não pode excluir seu próprio usuário enquanto está conectado.');
    confirmDel(`o usuário "${m.name}"`, async () => {
      await deleteDoc(doc(db, 'companies', CID, 'members', m.id));
      await logAudit(user, 'member_deleted', 'member', m.id, { name: m.name });
    });
  }

  async function clearTests() {
    if (!window.confirm('ATENÇÃO: apagar TODOS os equipamentos, clientes, locações, orçamentos e manutenções? Usuários e configurações serão preservados.')) return;
    if (!window.confirm('Confirme novamente: esta ação não pode ser desfeita.')) return;
    for (const key of ['equipment', 'clients', 'rentals', 'quotes', 'maintenance']) {
      let batch = writeBatch(db);
      let count = 0;
      for (const r of data[key]) {
        batch.delete(doc(db, 'companies', CID, key, r.id));
        count += 1;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count) await batch.commit();
    }
    await logAudit(user, 'test_data_cleared', 'company', CID);
    alert('Dados operacionais apagados. Usuários e configurações foram preservados.');
  }

  const activeInvites = data.adminInvites.filter((x) => x.active !== false);
  const auditRows = sortNewest(data.audit).slice(0, 20);

  return (
    <>
      <Title t="Configurações" s="Dados da empresa e acessos." />
      {role === 'admin' && <div className="card adminGoogleCard">
        <div><h2>Administradores Google</h2><p>Somente e-mails autorizados aqui conseguem criar acesso administrativo pelo Google. O administrador atual continua funcionando normalmente.</p></div>
        <form onSubmit={addGoogleAdmin} className="adminEmailForm"><input type="email" value={googleAdminEmail} onChange={(e) => setGoogleAdminEmail(e.target.value)} placeholder="empresa@gmail.com" required /><button className="primary">Autorizar administrador</button></form>
        <div className="adminList">
          {data.members.filter((m) => m.role === 'admin').map((m) => <div key={m.id}><span><b>{m.name || 'Administrador'}</b><small>{m.email || 'Sem e-mail'}</small></span><span className="installedBadge">Administrador ativo</span></div>)}
          {activeInvites.map((i) => <div key={i.id}><span><b>{i.email}</b><small>Aguardando primeiro login Google</small></span><button className="danger ghostDanger" onClick={() => revokeInvite(i)}>Revogar</button></div>)}
        </div>
      </div>}
      <div className="card form config">
        <div className="full note">A logo do sistema é carregada diretamente do projeto e não usa Firebase Storage.</div>
        <Input l="Nome da empresa" v={local.name} disabled={role !== 'admin'} change={(v) => setLocal({ ...local, name: v })} />
        <Input l="CNPJ" v={local.cnpj} disabled={role !== 'admin'} change={(v) => setLocal({ ...local, cnpj: v })} />
        <Input l="Telefone" v={local.phone} disabled={role !== 'admin'} change={(v) => setLocal({ ...local, phone: v })} />
        <Input l="E-mail" v={local.email} disabled={role !== 'admin'} change={(v) => setLocal({ ...local, email: v })} />
        <Input l="Endereço" v={local.address} disabled={role !== 'admin'} change={(v) => setLocal({ ...local, address: v })} />
        <label className="full">Termos do contrato<textarea rows="14" value={local.terms || ''} disabled={role !== 'admin'} onChange={(e) => setLocal({ ...local, terms: e.target.value })} /></label>
        {role === 'admin' && <button className="primary" onClick={save}><Save /> Salvar configurações</button>}
      </div>
      {role === 'admin' && <>
        <div className="card admincard"><div className="sectionhead"><div><h2><Shield /> Usuários</h2><p>Funcionários podem operar o sistema, mas não podem excluir registros ou alterar configurações administrativas.</p></div><button className="primary" onClick={() => setNewUser(true)}><UserPlus /> Novo usuário</button></div><Table rows={data.members} cols={[["Nome", "name"], ["Usuário", "username"], ["Perfil", "role", (m) => m.role === 'admin' ? 'Administrador' : 'Funcionário']]} actions={(m) => <>{m.id !== user.uid && <Del onClick={() => removeMember(m)} />}</>} /></div>
        <div className="card admincard"><div className="sectionhead"><div><h2><History /> Auditoria recente</h2><p>Últimas ações administrativas e operacionais registradas.</p></div></div><Table rows={auditRows} cols={[["Ação", "action"], ["Entidade", "entity"], ["Usuário", "actorEmail"], ["Data", "createdAt", (r) => r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString('pt-BR') : '—']]} /></div>
        <div className="card dangerzone"><h2>Limpeza de testes</h2><p>Apaga equipamentos, clientes, locações, orçamentos e manutenções. Usuários, auditoria e configurações permanecem.</p><button className="danger" onClick={clearTests}><Trash2 /> Limpar dados de teste</button></div>
      </>}
      {newUser && <Modal title="Novo usuário" close={() => setNewUser(false)}><form onSubmit={createMember} className="form">
        <Input n="name" l="Nome" required />
        <Input n="username" l="Usuário" required />
        <Input n="password" l="Senha" type="password" minLength="6" required />
        <Select n="role" l="Perfil" v="employee" opts={[["employee", "Funcionário"], ["admin", "Administrador"]]} />
        <p className="full note">A senha é armazenada pelo Firebase Authentication e não fica salva no Firestore.</p>
        <button className="primary">Criar usuário</button>
      </form></Modal>}
    </>
  );
}

function Input({ n, l, v = '', type = 'text', change, ...p }) {
  return <label>{l}<input name={n} type={type} defaultValue={change ? undefined : v} value={change ? v : undefined} onChange={change ? (e) => change(e.target.value) : undefined} {...p} /></label>;
}

function InputControlled({ l, value = '', onChange, type = 'text', ...p }) {
  return <label>{l}<input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...p} /></label>;
}

function MoneyInput({ n, l, v = 0 }) {
  const [val, setVal] = useState(money(v));
  useEffect(() => setVal(money(v)), [v]);
  return <label>{l}<input name={n} inputMode="decimal" value={val} onFocus={(e) => e.target.select()} onChange={(e) => setVal(e.target.value)} onBlur={() => setVal(money(parseMoney(val)))} /></label>;
}

function MoneyControlled({ l, value = 0, onChange }) {
  const [text, setText] = useState(money(value));
  useEffect(() => setText(money(value)), [value]);
  function commit() {
    const parsed = parseMoney(text);
    setText(money(parsed));
    onChange(parsed);
  }
  return <label>{l}<input inputMode="decimal" value={text} onFocus={(e) => e.target.select()} onChange={(e) => setText(e.target.value)} onBlur={commit} /></label>;
}

function Select({ n, l, v = '', opts = [] }) {
  return <label>{l}<select name={n} defaultValue={v}>{opts.map((x) => Array.isArray(x) ? <option key={x[0]} value={x[0]}>{x[1]}</option> : <option key={x} value={x}>{x}</option>)}</select></label>;
}

function SelectControlled({ l, value = '', onChange, opts = [] }) {
  return <label>{l}<select value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((x) => Array.isArray(x) ? <option key={x[0]} value={x[0]}>{x[1]}</option> : <option key={x} value={x}>{x}</option>)}</select></label>;
}

function Modal({ title, close, children, wide }) {
  return <div className="overlay"><div className={`modal ${wide ? 'wide' : ''}`}><div className="modalhead"><h2>{title}</h2><button onClick={close}><X /></button></div>{children}</div></div>;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => reg.update().catch(() => {}))
    .catch((err) => console.error('Service Worker:', err));
}

createRoot(document.getElementById('root')).render(<App />);
