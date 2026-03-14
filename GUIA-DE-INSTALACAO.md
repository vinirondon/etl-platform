# ETL Platform — Guia Completo de Instalação e Uso

## Pré-requisitos

| Ferramenta | Versão mínima | Download |
|---|---|---|
| Node.js | 18 ou superior | https://nodejs.org |
| npm | Incluído com Node.js | — |
| Git (opcional) | Qualquer | https://git-scm.com |

> **Importante:** Não é necessário instalar Visual Studio, Python, ou qualquer compilador.
> O banco de dados interno (SQLite) funciona 100% em JavaScript puro.

---

## Instalação Local (Recomendado para começar)

### Passo 1 — Extrair o projeto

Extraia o arquivo `.tar.gz` em uma pasta de sua escolha.

**Windows:** clique com botão direito → "Extrair aqui"
(ou use 7-Zip / WinRAR)

**Mac/Linux:**
```bash
tar -xzf etl-platform-v3.tar.gz
```

Você terá a seguinte estrutura:
```
etl-platform/
├── backend/        ← API Node.js
├── frontend/       ← Interface React
├── docker-compose.yml
└── GUIA-DE-INSTALACAO.md
```

---

### Passo 2 — Instalar e iniciar o Backend

Abra um terminal e execute:

```bash
cd etl-platform/backend
npm install
npm run dev
```

Você verá:
```
✅ Database initialized (sql.js - no native compilation required)
✅ Admin user created: admin@etlplatform.com / Admin@123456
🚀 ETL Platform API running on http://localhost:3001
```

> **Mantenha este terminal aberto.** O backend precisa ficar rodando.

---

### Passo 3 — Instalar e iniciar o Frontend

Abra **um segundo terminal** e execute:

```bash
cd etl-platform/frontend
npm install
npm run dev
```

Você verá:
```
  VITE v5.x.x  ready in 500ms
  ➜  Local:   http://localhost:5173/
```

---

### Passo 4 — Acessar a plataforma

Abra o navegador em: **http://localhost:5173**

**Credenciais iniciais:**
- E-mail: `admin@etlplatform.com`
- Senha: `Admin@123456`

> **Recomendação:** Troque a senha após o primeiro acesso em
> Usuários → editar seu perfil.

---

## Como usar a plataforma

### Fluxo principal (faça nesta ordem)

```
1. Criar Empresa
      ↓
2. Configurar Banco de Dados (SQL Server de destino)
      ↓
3. Criar Integração (API externa)
      ↓
4. Testar a API (aba ⚡ Testar API)
      ↓
5. Configurar Destino e Mapeamentos
      ↓
6. Criar Agendamento (execução automática)
      ↓
7. Monitorar no Dashboard e Logs
```

---

### 1. Cadastrar uma Empresa

1. Clique em **Empresas** no menu lateral
2. Clique em **Nova Empresa**
3. Preencha Nome Fantasia e Razão Social (obrigatórios)
4. Salve

---

### 2. Configurar o Banco de Dados de Destino (SQL Server)

1. Clique em **Bancos de Dados** no menu lateral
2. Clique em **Nova Conexão**
3. Preencha:
   - **Empresa:** selecione a empresa criada
   - **Nome:** um nome descritivo (ex: "SQL Server Produção")
   - **Host/IP:** endereço do servidor SQL Server
   - **Porta:** 1433 (padrão)
   - **Database:** nome do banco de dados
   - **Usuário e Senha:** credenciais do SQL Server

> A senha é criptografada antes de ser salva.

---

### 3. Criar uma Integração

1. Clique em **Integrações** → **Nova Integração**
2. Preencha as abas:

**Aba Geral:**
- Empresa, Nome, Base URL, Endpoint, Método HTTP, Formato (JSON/XML)

**Aba Autenticação:**
- Selecione o tipo (Sem auth, Bearer Token, Basic Auth, API Key)
- Preencha as credenciais

**Aba Parâmetros:**
- Headers customizados e Query Parameters se necessário

---

### 4. Testar a API (⚡)

1. Com o formulário preenchido, clique na aba **⚡ Testar API**
2. Clique em **Executar Teste da API**
3. O sistema mostrará:
   - Status da conexão (verde = sucesso)
   - Tempo de resposta
   - **Caminhos detectados** — arrays encontrados na resposta (clique para selecionar)
   - **Campos detectados** — todos os campos disponíveis
   - **Preview dos registros** em formato tabela ou JSON

> O teste **não grava nada** no banco. É apenas uma prévia.

---

### 5. Configurar Destino e Mapeamentos

**Aba Destino:**
- Selecione o Banco de Dados configurado no Passo 2
- Informe a **Tabela de Destino** (ex: `dbo.vendas`)
- O **root_path** é preenchido automaticamente ao selecionar um caminho no teste
- Informe o **Campo de Deduplicação** (ex: `id`) para evitar duplicatas

**Aba Mapeamentos (opcional):**
- Se os campos da API tiverem nomes diferentes das colunas do banco, configure aqui
- Use **Auto-preencher** para criar mapeamentos automáticos com os campos detectados
- Ou clique em cada campo detectado para adicioná-lo individualmente

> Se não configurar mapeamentos, **todos os campos são gravados com o nome original** da API.

---

### 6. Criar um Agendamento

1. Clique em **Agendamentos** → **Novo Agendamento**
2. Selecione a integração
3. Escolha a frequência:
   - A cada 5, 15 ou 30 minutos
   - A cada 1, 6 ou 12 horas
   - Diário, Semanal ou Mensal
   - Ou insira uma **expressão cron personalizada**
4. Salve — a integração passará a rodar automaticamente

**Para pausar/retomar:** clique no botão **Pausar/Ativar** na lista de agendamentos.

---

### 7. Executar manualmente

Na tela de **Integrações**, clique no botão ▶ (play) ao lado de qualquer integração para executar imediatamente, sem esperar o agendamento.

---

### 8. Monitorar logs

1. Clique em **Logs & Execuções**
2. Veja todas as execuções com status, duração e quantidade de registros
3. Clique em qualquer linha para ver os detalhes completos:
   - Mensagem de erro (se houver)
   - Preview da resposta da API
   - Quantidade de registros inseridos/atualizados/pulados
   - Batch ID para rastreabilidade

---

## O que é gravado automaticamente no SQL Server

Para cada registro inserido, a plataforma adiciona automaticamente estas colunas de controle:

| Coluna | Descrição |
|---|---|
| `_etl_id_empresa` | ID da empresa no ETL Platform |
| `_etl_id_integracao` | ID da integração |
| `_etl_batch_id` | ID único do lote de execução |
| `_etl_data_execucao` | Timestamp da execução |
| `_etl_data_insercao` | Timestamp da inserção no banco |
| `_etl_hash` | Hash MD5 do registro (para detectar mudanças) |
| `_etl_origem` | Origem (sempre "api") |
| `_etl_data_update` | Timestamp da última atualização (se deduplicação ativa) |

---

## Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Super Admin** | Tudo, incluindo gerenciar outros admins |
| **Administrador** | Gerenciar empresas, integrações, agendamentos e usuários comuns |
| **Operador** | Criar e editar integrações, executar manualmente, criar agendamentos |
| **Visualizador** | Somente leitura — ver dashboard, logs e configurações |

---

## Alterar senha padrão do admin

1. Faça login com `admin@etlplatform.com` / `Admin@123456`
2. Vá em **Usuários** no menu lateral
3. Clique em editar no seu usuário
4. Ou use a opção de troca de senha via API: `POST /api/auth/change-password`

---

## Configurações avançadas (arquivo .env)

Edite o arquivo `backend/.env` para personalizar:

```env
# Porta do servidor backend
PORT=3001

# Chave secreta JWT (MUDE em produção!)
JWT_SECRET=sua_chave_secreta_muito_segura

# Validade do token de login
JWT_EXPIRES_IN=24h

# Caminho do banco de dados SQLite interno
SQLITE_PATH=./data/etl_platform.db

# Chave de criptografia das senhas dos bancos (MUDE em produção!)
ENCRYPTION_KEY=chave_de_32_caracteres_exatamente!

# Credenciais do admin inicial
ADMIN_EMAIL=admin@etlplatform.com
ADMIN_PASSWORD=Admin@123456

# URL permitida para o frontend (CORS)
FRONTEND_URL=http://localhost:5173
```

> **Importante em produção:** sempre troque `JWT_SECRET` e `ENCRYPTION_KEY`
> por valores aleatórios e longos. Nunca use os valores padrão em ambiente público.

---

## Instalação com Docker (para servidor/cloud)

Se tiver Docker instalado:

```bash
cd etl-platform
docker-compose up --build
```

Acesse: **http://localhost:5173**

Para rodar em background:
```bash
docker-compose up -d --build
```

Para parar:
```bash
docker-compose down
```

---

## Resolução de Problemas

### ❌ Erro `EADDRINUSE: address already in use :::3001`
A porta 3001 já está em uso. Mude no `.env`:
```env
PORT=3002
```
E atualize o proxy no `frontend/vite.config.js`:
```js
target: 'http://localhost:3002'
```

### ❌ Frontend mostra tela em branco
Verifique se o backend está rodando (`http://localhost:3001/health` deve retornar `{"status":"ok"}`).

### ❌ Erro ao conectar no SQL Server
- Verifique se o host/IP está correto
- Verifique se a porta 1433 está aberta no firewall
- Confirme que o usuário tem permissão de INSERT na tabela de destino
- Teste com `telnet SEU_HOST 1433` para verificar conectividade

### ❌ `npm install` demora muito
Normal na primeira vez. O `sql.js` (~3MB de WASM) precisa ser baixado.

### ❌ Dados não aparecem no SQL Server após execução
1. Verifique os **Logs** — clique na execução com erro para ver a mensagem
2. Confira se a tabela existe no SQL Server e se as colunas correspondem
3. Verifique as permissões do usuário do banco

---

## Estrutura de pastas do projeto

```
etl-platform/
│
├── backend/
│   ├── src/
│   │   ├── index.js              ← Entrada do servidor
│   │   ├── models/
│   │   │   ├── database.js       ← SQLite (sql.js) — configurações da plataforma
│   │   │   └── seed.js           ← Criação do admin inicial
│   │   ├── routes/
│   │   │   ├── auth.js           ← Login, /me, trocar senha
│   │   │   ├── companies.js      ← CRUD de empresas
│   │   │   ├── integrations.js   ← CRUD de integrações e banco destino
│   │   │   ├── schedules.js      ← CRUD de agendamentos
│   │   │   ├── logs.js           ← Logs de execução e auditoria
│   │   │   ├── dashboard.js      ← Estatísticas do dashboard
│   │   │   ├── users.js          ← CRUD de usuários
│   │   │   └── execute.js        ← Executar / Testar integração
│   │   ├── scheduler/
│   │   │   └── cronManager.js    ← Gerencia os cron jobs
│   │   ├── workers/
│   │   │   └── integrationRunner.js ← Motor ETL: lê API → grava SQL Server
│   │   ├── middleware/
│   │   │   └── auth.js           ← Verificação JWT
│   │   └── utils/
│   │       ├── encrypt.js        ← Criptografia AES das senhas
│   │       └── audit.js          ← Registro de ações no audit_log
│   ├── data/                     ← Banco SQLite (criado automaticamente)
│   ├── .env                      ← Configurações (edite aqui)
│   └── package.json
│
├── frontend/
│   └── src/
│       ├── App.jsx               ← Rotas da aplicação
│       ├── pages/                ← Telas principais
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Companies.jsx
│       │   ├── Integrations.jsx
│       │   ├── Schedules.jsx
│       │   ├── Logs.jsx
│       │   ├── Databases.jsx
│       │   └── Users.jsx
│       ├── components/
│       │   ├── forms/
│       │   │   ├── IntegrationForm.jsx  ← Formulário completo de integração
│       │   │   └── ApiTestPanel.jsx     ← Painel de teste de API
│       │   ├── layout/           ← Sidebar, Layout, PageHeader
│       │   └── ui/               ← Modal, Badge, Spinner, EmptyState
│       ├── services/api.js       ← Cliente HTTP (axios)
│       ├── contexts/AuthContext  ← Estado de autenticação
│       └── utils/helpers.js      ← Formatadores de data, duração, etc.
│
└── docker-compose.yml
```

---

## Suporte e próximos passos

Melhorias sugeridas para versões futuras:
- Suporte a OAuth2 como tipo de autenticação
- Paginação automática de APIs com múltiplas páginas
- Notificações por e-mail em caso de falha
- Importação/exportação de configurações de integração
- Suporte a outros bancos de destino (PostgreSQL, MySQL)
- Dashboard com gráficos históricos de execuções
