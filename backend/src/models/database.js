const mssql = require('mssql');

const config = {
    server: process.env.DB_SERVER || 'dbdataweb.database.windows.net',
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_DATABASE || 'dbmetabase',
    user: process.env.DB_USER || 'vinirondon',
    password: process.env.DB_PASSWORD || 'Rmdsvdor.123',
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
    },
    pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 15000,
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
};

let pool = null;

// Sempre retorna pool válido — reconecta se necessário
async function getPool() {
    if (pool && pool.connected) return pool;
    if (pool) {
        try { await pool.close(); } catch { }
    }
    pool = await new mssql.ConnectionPool(config).connect();
    pool.on('error', err => {
        console.error('Pool error (will reconnect on next request):', err.message);
        pool = null;
    });
    return pool;
}

async function runAsync(sql, params = []) {
    const p = await getPool();
    const req = p.request();
    params.forEach((v, i) => req.input(`p${i}`, v === undefined ? null : v));
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `@p${idx++}`);
    const result = await req.query(replaced);
    return result.rowsAffected[0] || 0;
}

async function getAsync(sql, params = []) {
    const p = await getPool();
    const req = p.request();
    params.forEach((v, i) => req.input(`p${i}`, v === undefined ? null : v));
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `@p${idx++}`);
    const result = await req.query(replaced);
    return result.recordset[0] || null;
}

async function allAsync(sql, params = []) {
    const p = await getPool();
    const req = p.request();
    params.forEach((v, i) => req.input(`p${i}`, v === undefined ? null : v));
    let idx = 0;
    const replaced = sql.replace(/\?/g, () => `@p${idx++}`);
    const result = await req.query(replaced);
    return result.recordset;
}

// DDL usa conexão separada e descartável para não contaminar o pool principal
async function execOne(sql) {
    const tempPool = await new mssql.ConnectionPool(config).connect();
    try {
        await tempPool.request().batch(sql);
    } finally {
        try { await tempPool.close(); } catch { }
    }
}

async function createSchema() {
    const tables = [
        `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'etl') EXEC('CREATE SCHEMA etl')`,
        `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Educacao') EXEC('CREATE SCHEMA Educacao')`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='users' AND s.name='etl')
     CREATE TABLE etl.users (
       id            NVARCHAR(36) PRIMARY KEY,
       name          NVARCHAR(200) NOT NULL,
       email         NVARCHAR(200) NOT NULL,
       password_hash NVARCHAR(200) NOT NULL,
       role          NVARCHAR(50)  NOT NULL DEFAULT 'operator',
       status        NVARCHAR(20)  NOT NULL DEFAULT 'active',
       last_login    DATETIME2,
       created_at    DATETIME2 DEFAULT GETDATE(),
       updated_at    DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='companies' AND s.name='etl')
     CREATE TABLE etl.companies (
       id         NVARCHAR(36) PRIMARY KEY,
       trade_name NVARCHAR(200) NOT NULL,
       legal_name NVARCHAR(200) NOT NULL,
       cnpj       NVARCHAR(20),
       email      NVARCHAR(200),
       phone      NVARCHAR(50),
       status     NVARCHAR(20) NOT NULL DEFAULT 'active',
       notes      NVARCHAR(MAX),
       created_at DATETIME2 DEFAULT GETDATE(),
       updated_at DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='company_users' AND s.name='etl')
     CREATE TABLE etl.company_users (
       company_id NVARCHAR(36) NOT NULL,
       user_id    NVARCHAR(36) NOT NULL,
       PRIMARY KEY (company_id, user_id)
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='database_targets' AND s.name='etl')
     CREATE TABLE etl.database_targets (
       id                 NVARCHAR(36) PRIMARY KEY,
       company_id         NVARCHAR(36) NOT NULL,
       name               NVARCHAR(200) NOT NULL,
       type               NVARCHAR(50) NOT NULL DEFAULT 'mssql',
       host               NVARCHAR(200) NOT NULL,
       port               INT DEFAULT 1433,
       database_name      NVARCHAR(200) NOT NULL,
       username           NVARCHAR(200) NOT NULL,
       password_encrypted NVARCHAR(MAX) NOT NULL,
       options            NVARCHAR(MAX),
       status             NVARCHAR(20) DEFAULT 'active',
       created_at         DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='integrations' AND s.name='etl')
     CREATE TABLE etl.integrations (
       id              NVARCHAR(36) PRIMARY KEY,
       company_id      NVARCHAR(36) NOT NULL,
       name            NVARCHAR(200) NOT NULL,
       description     NVARCHAR(MAX),
       base_url        NVARCHAR(500) NOT NULL,
       endpoint        NVARCHAR(500) DEFAULT '',
       method          NVARCHAR(10) NOT NULL DEFAULT 'GET',
       auth_type       NVARCHAR(50) NOT NULL DEFAULT 'none',
       auth_config     NVARCHAR(MAX),
       headers         NVARCHAR(MAX),
       query_params    NVARCHAR(MAX),
       body_template   NVARCHAR(MAX),
       response_format NVARCHAR(20) NOT NULL DEFAULT 'json',
       timeout         INT DEFAULT 30000,
       status          NVARCHAR(20) NOT NULL DEFAULT 'active',
       db_target_id    NVARCHAR(36),
       target_table    NVARCHAR(200),
       field_mappings  NVARCHAR(MAX),
       root_path       NVARCHAR(500),
       dedup_field     NVARCHAR(200),
       created_by      NVARCHAR(36),
       created_at      DATETIME2 DEFAULT GETDATE(),
       updated_at      DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='schedules' AND s.name='etl')
     CREATE TABLE etl.schedules (
       id              NVARCHAR(36) PRIMARY KEY,
       integration_id  NVARCHAR(36) NOT NULL,
       cron_expression NVARCHAR(100) NOT NULL,
       is_active       BIT NOT NULL DEFAULT 1,
       last_run        DATETIME2,
       next_run        DATETIME2,
       last_status     NVARCHAR(20),
       run_count       INT DEFAULT 0,
       created_at      DATETIME2 DEFAULT GETDATE(),
       updated_at      DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='execution_logs' AND s.name='etl')
     CREATE TABLE etl.execution_logs (
       id               NVARCHAR(36) PRIMARY KEY,
       integration_id   NVARCHAR(36) NOT NULL,
       company_id       NVARCHAR(36) NOT NULL,
       batch_id         NVARCHAR(36) NOT NULL,
       status           NVARCHAR(20) NOT NULL,
       trigger_type     NVARCHAR(50) DEFAULT 'scheduled',
       triggered_by     NVARCHAR(36),
       started_at       DATETIME2 NOT NULL,
       finished_at      DATETIME2,
       duration_ms      INT,
       records_fetched  INT DEFAULT 0,
       records_inserted INT DEFAULT 0,
       records_updated  INT DEFAULT 0,
       records_skipped  INT DEFAULT 0,
       error_message    NVARCHAR(MAX),
       request_url      NVARCHAR(MAX),
       response_status  INT,
       raw_response     NVARCHAR(MAX),
       created_at       DATETIME2 DEFAULT GETDATE()
     )`,
        `IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.name='audit_logs' AND s.name='etl')
     CREATE TABLE etl.audit_logs (
       id            NVARCHAR(36) PRIMARY KEY,
       user_id       NVARCHAR(36),
       user_email    NVARCHAR(200),
       action        NVARCHAR(100) NOT NULL,
       resource_type NVARCHAR(100),
       resource_id   NVARCHAR(36),
       details       NVARCHAR(MAX),
       ip_address    NVARCHAR(100),
       created_at    DATETIME2 DEFAULT GETDATE()
     )`,
    ];

    for (const sql of tables) {
        await execOne(sql);
    }
}

async function initializeDatabase() {
    console.log('🔌 Connecting to SQL Server...');
    // Força criação do pool principal
    await getPool();
    console.log(`✅ Connected to SQL Server: ${config.server}/${config.database}`);

    await createSchema();
    console.log('✅ Schema etl.* verified');

    // Reconecta pool principal (pode ter sido afetado pelo DDL)
    pool = null;
    await getPool();
    console.log('✅ Pool reconnected after schema setup');

    const adminExists = await getAsync("SELECT id FROM etl.users WHERE role = 'superadmin'");
    if (!adminExists) {
        await require('./seed').seedAdmin({ runAsync, getAsync });
    }

    console.log('✅ Database ready\n');
}

module.exports = { initializeDatabase, getPool, runAsync, getAsync, allAsync, execOne };