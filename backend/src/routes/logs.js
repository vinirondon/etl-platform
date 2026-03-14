const router = require('express').Router();
const { getAsync, allAsync } = require('../models/database');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { company_id, integration_id, status, limit = 100, offset = 0 } = req.query;
    let q = `
      SELECT l.*, i.name AS integration_name, c.trade_name AS company_name
      FROM etl.execution_logs l
      LEFT JOIN etl.integrations i ON i.id = l.integration_id
      LEFT JOIN etl.companies    c ON c.id = l.company_id
      WHERE 1=1`;
    const params = [];
    if (company_id)    { q += ' AND l.company_id = ?';    params.push(company_id); }
    if (integration_id){ q += ' AND l.integration_id = ?'; params.push(integration_id); }
    if (status)        { q += ' AND l.status = ?';        params.push(status); }
    q += ` ORDER BY l.started_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(parseInt(offset), parseInt(limit));
    const rows = await allAsync(q, params);

    // Count total for pagination
    let cq = 'SELECT COUNT(*) AS total FROM etl.execution_logs WHERE 1=1';
    const cp = [];
    if (company_id)    { cq += ' AND company_id = ?';    cp.push(company_id); }
    if (integration_id){ cq += ' AND integration_id = ?'; cp.push(integration_id); }
    if (status)        { cq += ' AND status = ?';        cp.push(status); }
    const countRow = await getAsync(cq, cp);
    // "logs" key keeps frontend compatible (Logs.jsx uses l.data.logs)
    res.json({ logs: rows, rows, total: countRow?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const log = await getAsync(`
      SELECT l.*, i.name AS integration_name, c.trade_name AS company_name
      FROM etl.execution_logs l
      LEFT JOIN etl.integrations i ON i.id = l.integration_id
      LEFT JOIN etl.companies    c ON c.id = l.company_id
      WHERE l.id = ?`, [req.params.id]);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json(log);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
