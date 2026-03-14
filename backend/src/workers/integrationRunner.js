/**
 * Integration Runner — fetches data from an API and upserts into SQL Server.
 *
 * FIXES:
 *  - company_id bug: integration and database_targets are fetched separately
 *    to avoid column-name collisions from JOIN that were nullifying company_id.
 *  - Table auto-creation: if the target table doesn't exist, it is created
 *    automatically based on the fields found in the first batch of records.
 */
const axios   = require('axios');
const xml2js  = require('xml2js');
const crypto  = require('crypto');
const https   = require('https');
const { v4: uuidv4 } = require('uuid');
const { getAsync, allAsync, runAsync, getPool } = require('../models/database');
const { decrypt } = require('../utils/encrypt');
const mssql = require('mssql');  // ← adicione esta linha

// ── XML helper ───────────────────────────────────────────────────────────────
function parseXml(xmlString) {
  return new Promise((resolve, reject) =>
    xml2js.parseString(xmlString, { explicitArray: false, mergeAttrs: true },
      (err, result) => err ? reject(err) : resolve(result)
    )
  );
}

// ── Records extraction ───────────────────────────────────────────────────────
function extractRecords(data, rootPath) {
  if (!rootPath) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const val of Object.values(data)) {
        if (Array.isArray(val)) return val;
      }
      return [data];
    }
    return [];
  }
  let current = data;
  for (const part of rootPath.split('.')) {
    if (current == null) return [];
    current = current[part];
  }
  return Array.isArray(current) ? current : (current != null ? [current] : []);
}

// ── Auth headers ─────────────────────────────────────────────────────────────
function buildAuthHeaders(authType, authConfig) {
  if (!authType || authType === 'none') return {};
  try {
    const cfg = typeof authConfig === 'string' ? JSON.parse(authConfig) : (authConfig || {});
    if (authType === 'bearer' && cfg.token)
      return { Authorization: `Bearer ${cfg.token}` };
    if (authType === 'basic' && cfg.username)
      return { Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password || ''}`).toString('base64')}` };
    if (authType === 'apikey' && cfg.api_key)
      return { [cfg.header_name || 'X-API-Key']: cfg.api_key };
  } catch {}
  return {};
}

// ── Open a dedicated connection pool to the target SQL Server ────────────────
async function openTargetPool(target) {
  const mssql   = require('mssql');
  const password = decrypt(target.password_encrypted);
  const config = {
    server:   target.host,
    port:     target.port || 1433,
    database: target.database_name,
    user:     target.username,
    password,
    options:  { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 20000,
    requestTimeout:    60000,
  };
  return mssql.connect(config);
}

// ── Parse schema and table name from "[Schema].[Table]" or "Schema.Table" ────
function parseTableName(raw) {
  if (!raw) return { schema: 'dbo', table: 'etl_data' };
  // Remove brackets
  const clean = raw.replace(/\[|\]/g, '');
  const parts = clean.split('.');
  if (parts.length >= 2) return { schema: parts[0], table: parts[1] };
  return { schema: 'dbo', table: parts[0] };
}

// ── Ensure target table exists (auto-create if needed) ───────────────────────
async function ensureTable(targetPool, tableName, sampleRecord) {
  const { schema, table } = parseTableName(tableName);

  // Create schema if needed
  await targetPool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${schema}')
      EXEC('CREATE SCHEMA [${schema}]')
  `);

  // Check if table exists
  const exists = await targetPool.request()
    .input('schema', schema)
    .input('table',  table)
    .query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`);

  if (exists.recordset[0].cnt > 0) {
    // Table exists — ensure ETL meta-columns are present
    await addMissingColumns(targetPool, schema, table, sampleRecord);
    return;
  }

  // Build CREATE TABLE from sample record fields
  const cols = Object.keys(sampleRecord).map(k =>
    `[${k.replace(/[^\w]/g, '_')}] NVARCHAR(MAX)`
  );

  // ETL metadata columns
  const metaCols = [
    `[_etl_id_empresa]    NVARCHAR(36)`,
    `[_etl_id_integracao] NVARCHAR(36)`,
    `[_etl_batch_id]      NVARCHAR(36)`,
    `[_etl_data_execucao] DATETIME2`,
    `[_etl_data_insercao] DATETIME2 DEFAULT GETDATE()`,
    `[_etl_data_update]   DATETIME2`,
    `[_etl_hash]          NVARCHAR(32)`,
    `[_etl_origem]        NVARCHAR(50)`,
  ];

  const allCols = [...cols, ...metaCols];
  await targetPool.request().query(
    `CREATE TABLE [${schema}].[${table}] (${allCols.join(', ')})`
  );
  console.log(`✅ Auto-created table [${schema}].[${table}]`);
}

async function addMissingColumns(targetPool, schema, table, sampleRecord) {
  const existing = await targetPool.request()
    .input('schema', schema)
    .input('table',  table)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`);
  const existingSet = new Set(existing.recordset.map(r => r.COLUMN_NAME.toLowerCase()));

  const metaNames = ['_etl_id_empresa','_etl_id_integracao','_etl_batch_id',
    '_etl_data_execucao','_etl_data_insercao','_etl_data_update','_etl_hash','_etl_origem'];

  const allNeeded = [...Object.keys(sampleRecord), ...metaNames];
  for (const col of allNeeded) {
    const safe = col.replace(/[^\w]/g, '_');
    if (!existingSet.has(safe.toLowerCase())) {
      try {
        await targetPool.request().query(
          `ALTER TABLE [${schema}].[${table}] ADD [${safe}] NVARCHAR(MAX)`
        );
        console.log(`  + Added column [${safe}] to [${schema}].[${table}]`);
      } catch (e) {
        console.warn(`  ! Could not add column [${safe}]: ${e.message}`);
      }
    }
  }
}

// ── Upsert records into target SQL Server table ──────────────────────────────

async function upsertRecords(targetPool, tableName, records, dedupField, integrationId, companyId, batchId, deleteBeforeInsert = false) {
    if (!records.length) return { inserted: 0, updated: 0, skipped: 0 };
    const { schema, table } = parseTableName(tableName);
    const now = new Date().toISOString();

    // 1. Prepara todos os registros em memória
    const metaRecords = records.map(record => {
        const hash = crypto.createHash('md5').update(JSON.stringify(record)).digest('hex');
        const sanitized = {};
        Object.entries(record).forEach(([k, v]) => {
            sanitized[k.replace(/[^\w]/g, '_')] = v != null ? String(v) : null;
        });
        return {
            ...sanitized,
            _etl_id_empresa: String(companyId),
            _etl_id_integracao: String(integrationId),
            _etl_batch_id: String(batchId),
            _etl_data_execucao: now,
            _etl_hash: hash,
            _etl_origem: 'api',
        };
    });

    const allCols = [...new Set(metaRecords.flatMap(r => Object.keys(r)))];
    const dedupSafe = dedupField ? dedupField.replace(/[^\w]/g, '_') : null;
    const stagingTable = `#etl_staging_${batchId.replace(/-/g, '')}`;

    // 2. DELETE por empresa antes de inserir (se ativado)
    if (deleteBeforeInsert) {
        await targetPool.request()
            .input('companyId', mssql.NVarChar, String(companyId))
            .query(`DELETE FROM [${schema}].[${table}] WHERE [_etl_id_empresa] = @companyId`);
        console.log(`  🗑️  Deleted existing records for company ${companyId} from [${schema}].[${table}]`);
    }

    // 3. Cria tabela temporária de staging
    const colDefs = allCols.map(c => `[${c}] NVARCHAR(MAX)`).join(', ');
    await targetPool.request().batch(
        `IF OBJECT_ID('tempdb..${stagingTable}') IS NOT NULL DROP TABLE ${stagingTable};
     CREATE TABLE ${stagingTable} (${colDefs});`
    );

    // 4. BulkLoad para o staging (sem limite de parâmetros, usa protocolo TDS)
    const bulkTable = new mssql.Table(stagingTable);
    bulkTable.create = false;

    allCols.forEach(col => {
        bulkTable.columns.add(col, mssql.NVarChar(mssql.MAX), { nullable: true });
    });

    metaRecords.forEach(row => {
        bulkTable.rows.add(...allCols.map(col => row[col] ?? null));
    });

    await targetPool.request().bulk(bulkTable);

    // 5. INSERT ou MERGE do staging para a tabela final
    let inserted = 0, updated = 0;

    if (deleteBeforeInsert || !dedupSafe) {
        // Após delete, só insere — não precisa de MERGE
        const insertCols = allCols.map(c => `[${c}]`).join(', ');
        const result = await targetPool.request().query(
            `INSERT INTO [${schema}].[${table}] (${insertCols})
       SELECT ${insertCols} FROM ${stagingTable};
       SELECT @@ROWCOUNT AS cnt;`
        );
        inserted = result.recordset?.[0]?.cnt ?? metaRecords.length;
    } else {
        // MERGE com deduplicação (quando não usa delete)
        const updateCols = allCols.filter(c => c !== dedupSafe);
        const updateSet = updateCols.map(c => `t.[${c}] = s.[${c}]`).join(', ');
        const insertCols = allCols.map(c => `[${c}]`).join(', ');
        const insertVals = allCols.map(c => `s.[${c}]`).join(', ');

        const mergeResult = await targetPool.request().batch(`
      DECLARE @counts TABLE (action NVARCHAR(10));

      MERGE [${schema}].[${table}] AS t
      USING ${stagingTable} AS s ON t.[${dedupSafe}] = s.[${dedupSafe}]
      WHEN MATCHED THEN
        UPDATE SET ${updateSet}, t.[_etl_data_update] = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (${insertCols}) VALUES (${insertVals})
      OUTPUT $action INTO @counts;

      SELECT action, COUNT(*) AS cnt FROM @counts GROUP BY action;
    `);

        mergeResult.recordset?.forEach(row => {
            if (row.action === 'INSERT') inserted = row.cnt;
            if (row.action === 'UPDATE') updated = row.cnt;
        });
    }

    // 6. Limpa staging
    await targetPool.request().batch(`DROP TABLE IF EXISTS ${stagingTable}`);

    return { inserted, updated, skipped: 0 };
}


// ── Main runner ──────────────────────────────────────────────────────────────
async function runIntegration(integrationId, triggeredBy = null, triggerType = 'scheduled') {

  // FIX: Fetch integration and target SEPARATELY to avoid column-name collision
  const integration = await getAsync(
    'SELECT * FROM etl.integrations WHERE id = ?', [integrationId]
  );
  if (!integration) throw new Error('Integration not found');

  // company_id is now guaranteed to be the integration's own company_id
  const companyId = integration.company_id;

  const batchId   = uuidv4();
  const logId     = uuidv4();
  const startedAt = new Date().toISOString();

  // Create execution log entry
  await runAsync(
    `INSERT INTO etl.execution_logs
      (id, integration_id, company_id, batch_id, status, trigger_type, triggered_by, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, integrationId, companyId, batchId, 'running', triggerType, triggeredBy || null, startedAt]
  );

  let status = 'success', errorMessage = null, responseStatus = null, rawResponse = null;
  let recordsFetched = 0, recordsInserted = 0, recordsUpdated = 0, recordsSkipped = 0;

  try {
    // Build request config
    const customHeaders = integration.headers
      ? (() => {
          const h = JSON.parse(integration.headers);
          if (Array.isArray(h)) {
            const obj = {};
            h.filter(x => x.key).forEach(x => { obj[x.key] = x.value; });
            return obj;
          }
          return h;
        })()
      : {};

    const authHeaders = buildAuthHeaders(integration.auth_type, integration.auth_config);

    const rawQp = integration.query_params ? JSON.parse(integration.query_params) : [];
    const queryParams = Array.isArray(rawQp)
      ? rawQp.reduce((acc, p) => { if (p.key) acc[p.key] = p.value; return acc; }, {})
      : rawQp;

    const url = `${integration.base_url.replace(/\/$/, '')}${integration.endpoint || ''}`;

    const response = await axios({
      method:      integration.method || 'GET',
      url,
      headers:     { ...customHeaders, ...authHeaders },
      params:      Object.keys(queryParams).length ? queryParams : undefined,
      data:        integration.body_template || undefined,
      timeout:     integration.timeout || 30000,
      responseType:'text',
      httpsAgent:  new https.Agent({ rejectUnauthorized: false }),
    });

    responseStatus = response.status;
    rawResponse    = String(response.data || '').substring(0, 5000);

    // Parse response
    let parsedData;
    if (integration.response_format === 'xml') {
      parsedData = await parseXml(response.data);
    } else {
      parsedData = typeof response.data === 'string'
        ? JSON.parse(response.data) : response.data;
    }

    // Extract records
    const records = extractRecords(parsedData, integration.root_path);
    recordsFetched = records.length;

    if (recordsFetched === 0) {
      console.warn(`Integration ${integrationId}: 0 records extracted (root_path="${integration.root_path}")`);
    }

    // Apply field mappings
    let processedRecords = records;
    if (integration.field_mappings) {
      const mappings = JSON.parse(integration.field_mappings);
      if (Array.isArray(mappings) && mappings.length > 0) {
        processedRecords = records.map(r => {
          const mapped = {};
          mappings.forEach(m => {
            if (m.source && m.target) mapped[m.target] = r[m.source];
          });
          // If no mappings match, fall back to original record
          return Object.keys(mapped).length > 0 ? mapped : r;
        });
      }
    }

    // Persist to SQL Server if configured
    if (integration.db_target_id && integration.target_table && processedRecords.length > 0) {
      const dbTarget = await getAsync(
        'SELECT * FROM etl.database_targets WHERE id = ?', [integration.db_target_id]
      );
      if (dbTarget) {
        const targetPool = await openTargetPool(dbTarget);
        try {
          // Auto-create or update table structure
          await ensureTable(targetPool, integration.target_table, processedRecords[0]);

        const result = await upsertRecords(
                targetPool, integration.target_table, processedRecords,
                integration.dedup_field, integrationId, companyId, batchId,
                integration.delete_before_insert === 1 || integration.delete_before_insert === true
        );;
          recordsInserted = result.inserted;
          recordsUpdated  = result.updated;
          recordsSkipped  = result.skipped;
        } finally {
          try { await targetPool.close(); } catch {}
        }
      }
    }

  } catch (err) {
    status       = 'error';
    errorMessage = err.message;
    console.error(`❌ Integration ${integrationId} failed: ${err.message}`);
  }

  const finishedAt = new Date().toISOString();
  const duration   = new Date(finishedAt) - new Date(startedAt);

  // Update execution log
  await runAsync(`
    UPDATE etl.execution_logs SET
      status           = ?,
      finished_at      = ?,
      duration_ms      = ?,
      records_fetched  = ?,
      records_inserted = ?,
      records_updated  = ?,
      records_skipped  = ?,
      error_message    = ?,
      response_status  = ?,
      raw_response     = ?
    WHERE id = ?`,
    [status, finishedAt, duration, recordsFetched, recordsInserted,
     recordsUpdated, recordsSkipped, errorMessage, responseStatus, rawResponse, logId]
  );

  // Update schedule
  await runAsync(
    'UPDATE etl.schedules SET last_run=?, last_status=?, run_count=run_count+1 WHERE integration_id=?',
    [finishedAt, status, integrationId]
  );

  return {
    logId, batchId, status, recordsFetched, recordsInserted,
    recordsUpdated, recordsSkipped, errorMessage, duration,
  };
}

module.exports = { runIntegration };
