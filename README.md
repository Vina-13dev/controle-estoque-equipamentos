# Controle de Estoque — Assistência Social

Sistema simples para substituir planilhas de estoque, com **unidades separadas**, **usuários e permissões**, **login Google ou usuário/senha**, **histórico imutável de movimentações** e interface responsiva.

## O que esta versão faz

- Painel simples
- Unidades separadas: Abrigo, CRAS, CREAS etc.
- Estoque independente por unidade
- Itens com nome, categoria, unidade de medida, quantidade, mínimo e observação
- Entrada, saída e ajuste de estoque
- Bloqueio de estoque negativo
- Histórico de movimentações sem edição/exclusão
- Exportação do histórico para CSV
- Login com Google
- Login simples com usuário/senha (`maria` + senha definida pelo admin)
- Área administrativa
- Criação de usuários pelo próprio painel
- Aprovação de contas Google pelo admin
- Permissões por unidade
- Administrador vê todas as unidades
- Operador vê somente unidades liberadas
- Firestore Security Rules protegendo os dados por unidade
- Deploy automático no GitHub Pages

## Estrutura de dados

```text
stockUsers/{uid}
stockUnits/{unitId}
stockItems/{itemId}
stockMovements/{movementId}
stockSystem/bootstrap
```

Cada `item` e cada `movement` possui `unitId`.

## 1. Firebase Authentication

No Firebase Console:

**Authentication → Método de login**

Ative:

- Google
- E-mail/senha

Depois vá em:

**Authentication → Configurações → Domínios autorizados**

Adicione:

```text
vina-13dev.github.io
```

## 2. Firestore

Crie/ative o Firestore no projeto `controle-estoques-pmml`.

Depois abra:

**Firestore → Regras**

Copie todo o conteúdo do arquivo `firestore.rules` deste projeto e clique em **Publicar**.

> Importante: essas regras fazem parte do funcionamento do sistema. Não use regras abertas como `allow read, write: if true`.

## 3. Primeiro administrador

Não é necessário criar o primeiro administrador manualmente no Firestore.

Com o banco novo:

1. Abra o site.
2. Clique em **Continuar com Google**.
3. A primeira conta autenticada cria automaticamente o `stockSystem/bootstrap` e recebe:

```text
role: admin
active: true
allowedUnitIds: ["*"]
```

Esta versão usa coleções novas (`stockUsers`, `stockUnits`, `stockItems` e `stockMovements`) para não misturar os dados do projeto antigo. Por isso, o primeiro login nesta nova versão cria um administrador novo dentro dessa estrutura.

**Faça o primeiro login administrativo antes de divulgar o endereço do sistema.**

## 4. Criar unidades

Entre como administrador e abra:

**Unidades → Nova unidade**

Exemplos:

- Unidade de Acolhimento
- CRAS
- CREAS
- Almoxarifado

Os estoques ficam independentes.

## 5. Criar usuário simples

Abra:

**Usuários → Novo usuário**

Exemplo:

```text
Nome: Maria Silva
Usuário: maria
Senha inicial: Mar123
Tipo: Operador
Unidade: Unidade de Acolhimento
```

Maria entra na tela de login com:

```text
Usuário: maria
Senha: Mar123
```

Internamente, o Firebase usa um e-mail técnico como `maria@estoque.local`, mas o funcionário não precisa saber disso.

### Observação sobre troca de senha

A criação de contas simples funciona no painel sem deslogar o administrador. Nesta V1, redefinir a senha de outra pessoa ainda deve ser feito pelo Firebase Authentication. Isso evita adicionar um backend/Cloud Function só para essa tarefa.

## 6. Aprovar alguém que entrou com Google

Quando uma pessoa nova entra com Google:

- o perfil é criado automaticamente como `operator`
- `active: false`
- sem unidade liberada

Ela verá **Aguardando autorização**.

No painel do administrador:

1. Abra **Usuários**.
2. Edite essa pessoa.
3. Marque **Usuário ativo**.
4. Escolha a(s) unidade(s).
5. Salve.

Ela poderá então clicar em **Verificar novamente** e acessar.

## 7. Como funciona o estoque

Um item novo sempre começa com saldo `0`.

Para informar o estoque inicial, faça uma **Entrada**.

Exemplo:

```text
Arroz 5 kg
Entrada: 20
Observação: Estoque inicial
```

Depois o sistema ficará com saldo 20.

### Tipos de movimentação

- **Entrada:** soma ao estoque
- **Saída:** diminui o estoque e não permite saldo negativo
- **Ajuste:** define o saldo correto após uma contagem física

As movimentações não podem ser editadas nem apagadas.

## 8. GitHub Pages

O projeto já contém:

```text
.github/workflows/deploy.yml
```

No GitHub:

1. Suba todos os arquivos para o repositório `controle-estoque-equipamentos`.
2. Vá em **Settings → Pages**.
3. Em **Source**, escolha **GitHub Actions**.
4. Aguarde o workflow `Deploy React Vite` ficar verde.

O endereço esperado é:

```text
https://vina-13dev.github.io/controle-estoque-equipamentos/
```

O projeto usa `HashRouter`, portanto páginas internas ficam no formato:

```text
https://vina-13dev.github.io/controle-estoque-equipamentos/#/estoque
```

Isso evita erro 404 do GitHub Pages.

## 9. Rodar localmente

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## 10. Segurança implementada

As regras do Firestore impedem, entre outras coisas:

- usuário bloqueado acessar estoque
- operador ler estoque de unidade não autorizada
- operador alterar `unitId` de um item
- estoque ficar negativo
- alterar/apagar movimentações antigas
- apagar itens diretamente
- operador gerenciar usuários ou unidades
- operador se transformar em administrador

A atualização de quantidade e a criação da movimentação são feitas na mesma transação do Firestore.

## Firebase usado neste projeto

O frontend já está configurado em `src/firebase/config.js` para o projeto Firebase informado durante a criação deste sistema.

A configuração web do Firebase (`apiKey`, `projectId` etc.) não é tratada como senha; a proteção real está no Authentication e nas Security Rules.
