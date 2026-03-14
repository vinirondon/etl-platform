# ETL Platform

Plataforma de gerenciamento de integrações ETL via API.

## Início Rápido (Local)

```bash
# Opção 1 - Script automático
chmod +x start-local.sh
./start-local.sh

# Opção 2 - Manual
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Acesse: **http://localhost:5173**
Login: `admin@etlplatform.com` / `Admin@123456`

## Com Docker

```bash
docker-compose up --build
```

Acesse: **http://localhost:5173**

## Estrutura do Projeto

```
etl-platform/
├── backend/          # API Node.js + Express
│   ├── src/
│   │   ├── models/   # SQLite schema + seed
│   │   ├── routes/   # Endpoints REST
│   │   ├── workers/  # ETL runner (lê API, grava SQL Server)
│   │   ├── scheduler/# Cron jobs automáticos
│   │   ├── utils/    # Criptografia, auditoria
│   │   └── middleware/ # Auth JWT
│   └── data/         # SQLite (criado automaticamente)
└── frontend/         # React + Vite + Tailwind
    └── src/
        ├── pages/    # Dashboard, Empresas, Integrações, etc.
        ├── components/ # UI components
        ├── services/ # API client
        └── contexts/ # Auth context
```

## Fluxo Principal

1. Login → cadastrar **Empresa** → cadastrar **Banco de Dados** (SQL Server destino)
2. Criar **Integração** (configurar API URL, auth, mapeamentos, tabela destino)
3. Criar **Agendamento** (frequência de execução automática)
4. Acompanhar no **Dashboard** e **Logs**

## Perfis de Acesso

| Perfil | Acesso |
|--------|--------|
| Super Admin | Tudo |
| Administrador | Gerenciar empresas, integrações, agendamentos |
| Operador | Criar/editar integrações, executar manualmente |
| Visualizador | Somente leitura |

## Campos ETL automáticos (gravados com cada registro)

- `_etl_id_empresa` — ID da empresa
- `_etl_id_integracao` — ID da integração
- `_etl_batch_id` — ID do lote de execução
- `_etl_data_execucao` — Timestamp da execução
- `_etl_data_insercao` — Timestamp de inserção
- `_etl_hash` — Hash MD5 do registro
- `_etl_origem` — Origem (api)


-- ''testestestets

oioioi