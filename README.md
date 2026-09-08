# Controle de Estoque de Equipamentos

Aplicativo web para controle de estoque de equipamentos: cadastro, movimentações (entrada/saída/devolução/baixa/ajuste), correções vinculadas, responsáveis, manutenção, histórico e auditoria.

Stack: **React + Vite + Tailwind CSS + Firebase (Auth, Firestore, Storage)**.

---

## 1. Arquivos criados

```
estoque-app/
├── firestore.rules              # Regras de segurança (admin/operador, imutabilidade)
├── .env.example                 # Modelo de variáveis do Firebase
├── package.json / vite.config.js / tailwind.config.js / postcss.config.js
├── index.html
└── src/
    ├── main.jsx, App.jsx, index.css
    ├── firebase/config.js       # Inicialização do Firebase
    ├── contexts/                # AuthContext, ToastContext
    ├── services/                # equipments, responsibles, movements, maintenance, users, audit
    ├── components/
    │   ├── layout/               # Sidebar, Header, Layout
    │   └── ui/                   # Button, Badge, Card, Modal, Table, Field, Loading
    ├── routes/                  # ProtectedRoute, AdminRoute
    ├── utils/                   # constants.js, formatters.js
    └── pages/
        ├── Login.jsx, Dashboard.jsx, NotFound.jsx
        ├── Equipamentos/ (lista + formulário)
        ├── Responsaveis/ (lista + formulário)
        ├── Movimentacoes/ (lista, formulário com confirmação, correção, Movimentação Rápida mobile)
        ├── Manutencao/ (lista + formulário)
        ├── Historico/ (filtros)
        ├── Auditoria/ (somente leitura, admin)
        ├── Relatorios/ (visualização + exportação CSV)
        └── Usuarios/ (gerenciar permissões, admin)
```

---

## 2. Como instalar

Pré-requisito: Node.js 18+ instalado.

```bash
cd estoque-app
npm install
```

---

## 3. Como configurar o Firebase

1. Crie um projeto em https://console.firebase.google.com
2. Ative **Authentication** → método "E-mail/senha".
3. Ative **Firestore Database** (modo produção).
4. Ative **Storage** (já usado pelo app apenas como preparação para o futuro; nenhuma tela usa upload ainda).
5. Em "Configurações do projeto → Geral → Seus apps", crie um app Web e copie as chaves.
6. Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Nunca coloque essas chaves diretamente no código-fonte nem faça commit do `.env` (ele já está no `.gitignore`).

### Publicar as regras de segurança

Instale a Firebase CLI (uma vez): `npm install -g firebase-tools`

```bash
firebase login
firebase init firestore   # aponte para o projeto criado; aceite usar firestore.rules existente
firebase deploy --only firestore:rules
```

---

## 4. Como criar o primeiro administrador

O app **não** cria contas de autenticação pelo frontend (isso exige o Admin SDK, que roda em backend). Para o primeiro admin:

1. No Firebase Console → Authentication → Users → "Add user". Crie com e-mail/senha e copie o **UID** gerado.
2. No Firebase Console → Firestore Database → crie manualmente a coleção `users` com um documento cujo **ID do documento seja exatamente esse UID**, com os campos:

```json
{
  "name": "Seu Nome",
  "email": "voce@empresa.com",
  "role": "admin",
  "active": true
}
```

3. Pronto — ao fazer login com esse e-mail/senha no app, você entrará como administrador.

Para os próximos usuários, um admin já pode usar a tela **Usuários** para gerenciar papel/status — mas a criação da conta de login em si (Authentication) ainda precisa ser feita no Firebase Console (ou por um fluxo de convite futuro), depois o admin cadastra o perfil em `/users/{uid}` com o mesmo UID.

---

## 5. Como rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:5173`.

---

## 6. Como testar

- Faça login com o admin criado no passo 4.
- Cadastre um equipamento (aba **Equipamentos**) e um responsável (aba **Responsáveis**).
- Registre uma **Entrada** em Movimentações para ter estoque.
- Registre uma **Saída** para um responsável e confirme que o estoque diminui.
- Tente uma saída maior que o estoque disponível: deve aparecer "Quantidade indisponível em estoque."
- Clique em **Corrigir** em uma movimentação: confirme que a original continua igual e uma nova movimentação de correção aparece referenciando o número da original.
- Crie um segundo usuário com perfil **Operador** (veja passo 4) e confirme que ele não vê os menus **Auditoria** e **Usuários**, e não consegue editar equipamentos/responsáveis.
- Teste a tela **Movimentação rápida** pelo celular (ou reduzindo a janela do navegador).

---

## 7. Como testar as Firebase Security Rules

Use o simulador do Firebase Console (Firestore → Regras → "Simulador de regras") ou o emulador local:

```bash
firebase emulators:start --only firestore
```

Casos importantes para simular:
- Um usuário com `role: operador` tentando `update` em `/equipments/{id}` alterando o campo `name` → deve ser **negado**.
- Qualquer usuário tentando `update` ou `delete` em `/movements/{id}` já existente → deve ser **sempre negado**.
- Um usuário com `active: false` tentando `create` em `/movements` → deve ser **negado**.
- Um usuário não-admin tentando `read` em `/auditLogs` → deve ser **negado**.
- Um usuário não-admin tentando `create`/`update` em `/users` → deve ser **negado**.

---

## 8. Como fazer build

```bash
npm run build
```

Os arquivos finais ficam em `dist/`. Para conferir localmente antes de publicar:

```bash
npm run preview
```

---

## 9. Como publicar no GitHub

```bash
git init
git add .
git commit -m "Primeira versão do controle de estoque"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

## 10. Como hospedar (GitHub Pages)

1. Em `vite.config.js`, ajuste `base: '/NOME_DO_REPO/'` para o nome exato do seu repositório.
2. Instale a dependência de deploy (já está no `package.json`) e publique:

```bash
npm run deploy
```

Isso builda o projeto e envia a pasta `dist/` para a branch `gh-pages`. Depois, em Settings → Pages do repositório, selecione a branch `gh-pages` como fonte. O site ficará em `https://SEU_USUARIO.github.io/NOME_DO_REPO/`.

> Alternativa mais simples de hospedagem, se preferir não usar GitHub Pages: `firebase deploy --only hosting` (requer `firebase init hosting` apontando para a pasta `dist`).

---

## 11. O que ficou pendente

Conforme priorizado no briefing, a primeira versão cobre: login, dashboard, equipamentos, responsáveis, entrada/saída/devolução/baixa/ajuste, correções vinculadas, histórico com filtros, auditoria, manutenção básica, relatórios e movimentação rápida mobile. Ficou pendente para as próximas versões:

- **Exportação em PDF e Excel formatados** — hoje os relatórios exportam em CSV (funcional e abre em Excel), mas a geração de PDF/planilha estilizada ainda não foi implementada.
- **QR Code** — a rota `/equipamentos/:id` não foi criada ainda; a estrutura de dados já suporta adicionar isso depois sem migração.
- **Upload de imagens** — o Firebase Storage está inicializado e pronto (`src/firebase/config.js`), mas nenhuma tela usa upload de fotos de equipamento ainda.
- **Notificações automáticas** (ex: alerta de estoque crítico por e-mail) — a coleção `notifications` existe nas regras, mas não há lógica de disparo automático (isso exigiria Cloud Functions).
- **Convite de novos usuários pelo próprio app** — hoje a criação da conta de login precisa ser feita manualmente no Firebase Console, pois criar usuários do Authentication a partir do frontend não é seguro (precisa do Admin SDK/backend).
- **Regra fina de "quem pode alterar quantidade de equipamento fora de uma movimentação"** — as regras atuais permitem que qualquer usuário ativo altere apenas os campos `quantity`/`status` do equipamento (para viabilizar a transação da movimentação), mas isso tecnicamente permite que um operador altere a quantidade diretamente sem passar por uma movimentação. Uma versão futura pode restringir isso ainda mais com Cloud Functions validando a transação no backend.
