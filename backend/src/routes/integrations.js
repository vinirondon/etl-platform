const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { encrypt, decrypt } = require('../utils/encrypt');
const mssql = require('mssql');

// ── Integrations CRUD ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
    try {
        const { company_id, status } = req.query;
        let query = `
      SELECT i.*,
             c.trade_name  AS company_name,
             dt.name       AS db_target_name,
             s.cron_expression,
             s.is_active   AS schedule_active,
             s.last_run,
             s.next_run,
             s.last_status AS schedule_last_status
      FROM etl.integrations i
      LEFT JOIN etl.companies       c  ON c.id  = i.company_id
      LEFT JOIN etl.database_targets dt ON dt.id = i.db_target_id
      LEFT JOIN etl.schedules        s  ON s.integration_id = i.id
      WHERE 1=1`;
        const params = [];
        if (company_id) { query += ' AND i.company_id = ?'; params.push(company_id); }
        if (status) { query += ' AND i.status = ?'; params.push(status); }
        query += ' ORDER BY i.created_at DESC';
        res.json(await allAsync(query, params));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const row = await getAsync(`
      SELECT i.*, c.trade_name AS company_name, dt.name AS db_target_name
      FROM etl.integrations i
      LEFT JOIN etl.companies        c  ON c.id  = i.company_id
      LEFT JOIN etl.database_targets dt ON dt.id = i.db_target_id
      WHERE i.id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Integration not found' });

        // Parse JSON fields
        ['headers', 'query_params', 'field_mappings', 'auth_config'].forEach(f => {
            if (row[f]) try { row[f] = JSON.parse(row[f]); } catch { }
        });
        const schedule = await getAsync('SELECT * FROM etl.schedules WHERE integration_id = ?', [req.params.id]);
        res.json({ ...row, schedule });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin', 'admin', 'operator'), async (req, res) => {
    try {
        const {
            company_id, name, description, base_url, endpoint, method,
            auth_type, auth_config, headers, query_params, body_template,
            response_format, timeout, db_target_id, target_table,
            field_mappings, root_path, dedup_field, delete_before_insert
        } = req.body;

        if (!company_id || !name || !base_url)
            return res.status(400).json({ error: 'company_id, name and base_url required' });

        const id = uuidv4();
        await runAsync(`
      INSERT INTO etl.integrations
        (id, company_id, name, description, base_url, endpoint, method,
         auth_type, auth_config, headers, query_params, body_template,
         response_format, timeout, db_target_id, target_table,
         field_mappings, root_path, dedup_field, delete_before_insert, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, company_id, name, description || null, base_url, endpoint || '', method || 'GET',
                auth_type || 'none',
                auth_config ? JSON.stringify(auth_config) : null,
                headers ? JSON.stringify(headers) : null,
                query_params ? JSON.stringify(query_params) : null,
                body_template || null,
                response_format || 'json',
                timeout || 30000,
                db_target_id || null,
                target_table || null,
                field_mappings ? JSON.stringify(field_mappings) : null,
                root_path || null,
                dedup_field || null,
                delete_before_insert ? 1 : 0,
                req.user.id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_INTEGRATION', resourceType: 'integration', resourceId: id, ip: req.ip });
        res.status(201).json({ id, name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin', 'admin', 'operator'), async (req, res) => {
    try {
        const f = req.body;
        // Stringify JSON fields if they came in as objects
        ['auth_config', 'headers', 'query_params', 'field_mappings'].forEach(k => {
            if (f[k] && typeof f[k] === 'object') f[k] = JSON.stringify(f[k]);
        });
        await runAsync(`
      UPDATE etl.integrations SET
        name                 = COALESCE(?, name),
        description          = COALESCE(?, description),
        base_url             = COALESCE(?, base_url),
        endpoint             = COALESCE(?, endpoint),
        method               = COALESCE(?, method),
        auth_type            = COALESCE(?, auth_type),
        auth_config          = COALESCE(?, auth_config),
        headers              = COALESCE(?, headers),
        query_params         = COALESCE(?, query_params),
        body_template        = COALESCE(?, body_template),
        response_format      = COALESCE(?, response_format),
        timeout              = COALESCE(?, timeout),
        status               = COALESCE(?, status),
        db_target_id         = COALESCE(?, db_target_id),
        target_table         = COALESCE(?, target_table),
        field_mappings       = COALESCE(?, field_mappings),
        root_path            = COALESCE(?, root_path),
        dedup_field          = COALESCE(?, dedup_field),
        delete_before_insert = ?,
        updated_at           = GETDATE()
      WHERE id = ?`,
            [f.name, f.description, f.base_url, f.endpoint, f.method,
            f.auth_type, f.auth_config, f.headers, f.query_params, f.body_template,
            f.response_format, f.timeout, f.status, f.db_target_id,
            f.target_table, f.field_mappings, f.root_path, f.dedup_field,
            f.delete_before_insert ? 1 : 0,
            req.params.id]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_INTEGRATION', resourceType: 'integration', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Integration updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin', 'admin'), async (req, res) => {
    try {
        await runAsync('DELETE FROM etl.integrations WHERE id = ?', [req.params.id]);
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE_INTEGRATION', resourceType: 'integration', resourceId: req.params.id, ip: req.ip });
        res.json({ message: 'Integration deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Database Targets ─────────────────────────────────────────────────────────

router.get('/targets/all', authenticate, async (req, res) => {
    try {
        const { company_id } = req.query;
        let q = 'SELECT id, company_id, name, type, host, port, database_name, username, status FROM etl.database_targets WHERE 1=1';
        const params = [];
        if (company_id) { q += ' AND company_id = ?'; params.push(company_id); }
        q += ' ORDER BY name';
        res.json(await allAsync(q, params));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/targets', authenticate, requireRole('superadmin', 'admin'), async (req, res) => {
    try {
        const { company_id, name, type, host, port, database_name, username, password, options } = req.body;
        if (!company_id || !name || !host || !database_name || !username || !password)
            return res.status(400).json({ error: 'All connection fields required' });

        const id = uuidv4();
        const encPwd = encrypt(password);
        await runAsync(
            'INSERT INTO etl.database_targets (id, company_id, name, type, host, port, database_name, username, password_encrypted, options) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [id, company_id, name, type || 'mssql', host, port || 1433, database_name, username, encPwd,
                options ? JSON.stringify(options) : null]
        );
        await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_DB_TARGET', resourceType: 'database_target', resourceId: id, ip: req.ip });
        res.status(201).json({ id, name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/targets/:id', authenticate, requireRole('superadmin', 'admin'), async (req, res) => {
    try {
        await runAsync('DELETE FROM etl.database_targets WHERE id = ?', [req.params.id]);
        res.json({ message: 'Target deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Test SQL Server connection ────────────────────────────────────────────────

router.post('/targets/:id/test', authenticate, async (req, res) => {
    const target = await getAsync('SELECT * FROM etl.database_targets WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'Database target not found' });

    const start = Date.now();
    let testPool = null;
    try {
        const password = decrypt(target.password_encrypted);
        const config = {
            server: target.host,
            port: target.port || 1433,
            database: target.database_name,
            user: target.username,
            password,
            options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
            connectionTimeout: 12000,
            requestTimeout: 12000,
        };
        testPool = await mssql.connect(config);
        const result = await testPool.request().query(`
      SELECT @@VERSION AS server_version, DB_NAME() AS current_database,
             SYSTEM_USER AS connected_user, GETDATE() AS server_time,
             (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE') AS table_count`);
        const row = result.recordset[0];
        const vm = row.server_version.match(/Microsoft SQL Server (\d+)/);
        res.json({
            success: true,
            duration_ms: Date.now() - start,
            server_version: vm ? `SQL Server ${vm[1]}` : 'SQL Server',
            full_version: row.server_version.split('\n')[0].trim(),
            current_database: row.current_database,
            connected_user: row.connected_user,
            server_time: row.server_time,
            table_count: row.table_count,
        });
    } catch (err) {
        let msg = err.message;
        if (err.code === 'ETIMEOUT' || msg.includes('timeout')) msg = `Timeout ao conectar em ${target.host}:${target.port || 1433}.`;
        else if (msg.includes('Login failed')) msg = `Autenticação falhou para "${target.username}".`;
        else if (msg.includes('Cannot open database')) msg = `Banco "${target.database_name}" não encontrado ou sem permissão.`;
        else if (err.code === 'ECONNREFUSED') msg = `Conexão recusada em ${target.host}:${target.port || 1433}.`;
        else if (err.code === 'ENOTFOUND' || msg.includes('ENOTFOUND')) msg = `Host "${target.host}" não encontrado.`;
        res.json({ success: false, duration_ms: Date.now() - start, error: msg });
    } finally {
        if (testPool) try { await testPool.close(); } catch { }
    }
});

module.exports = router;