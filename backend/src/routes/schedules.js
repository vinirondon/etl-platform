const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const rows = await allAsync(`
      SELECT s.*, i.name AS integration_name, i.company_id,
             c.trade_name AS company_name
      FROM etl.schedules s
      JOIN etl.integrations i ON i.id = s.integration_id
      LEFT JOIN etl.companies c ON c.id = i.company_id
      ORDER BY s.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
  try {
    const { integration_id, cron_expression } = req.body;
    if (!integration_id || !cron_expression)
      return res.status(400).json({ error: 'integration_id and cron_expression required' });

    // Upsert: update if exists, insert if not
    const existing = await getAsync('SELECT id FROM etl.schedules WHERE integration_id = ?', [integration_id]);
    if (existing) {
      await runAsync(
        `UPDATE etl.schedules SET cron_expression=?, is_active=1, updated_at=GETDATE() WHERE integration_id=?`,
        [cron_expression, integration_id]
      );
      res.json({ id: existing.id, message: 'Schedule updated' });
    } else {
      const id = uuidv4();
      await runAsync(
        `INSERT INTO etl.schedules (id, integration_id, cron_expression, is_active) VALUES (?,?,?,1)`,
        [id, integration_id, cron_expression]
      );
      res.status(201).json({ id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
  try {
    const { cron_expression, is_active } = req.body;
    await runAsync(
      `UPDATE etl.schedules SET
         cron_expression = COALESCE(?, cron_expression),
         is_active       = COALESCE(?, is_active),
         updated_at      = GETDATE()
       WHERE id = ?`,
      [cron_expression ?? null, is_active ?? null, req.params.id]
    );
    res.json({ message: 'Schedule updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', authenticate, requireRole('superadmin','admin','operator'), async (req, res) => {
  try {
    await runAsync(
      `UPDATE etl.schedules SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=GETDATE() WHERE id=?`,
      [req.params.id]
    );
    const updated = await getAsync('SELECT is_active FROM etl.schedules WHERE id=?', [req.params.id]);
    res.json({ is_active: updated?.is_active });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
  try {
    await runAsync('DELETE FROM etl.schedules WHERE id = ?', [req.params.id]);
    res.json({ message: 'Schedule deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
