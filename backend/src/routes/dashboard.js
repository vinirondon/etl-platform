const router = require('express').Router();
const { getAsync, allAsync } = require('../models/database');
const { authenticate } = require('../middleware/auth');

router.get('/stats', authenticate, async (req, res) => {
  try {
    const [coRow, intRow, errRow, todayRow, recRow] = await Promise.all([
      getAsync("SELECT COUNT(*) AS total FROM etl.companies WHERE status='active'"),
      getAsync("SELECT COUNT(*) AS total FROM etl.integrations WHERE status='active'"),
      getAsync(`SELECT COUNT(*) AS total FROM etl.execution_logs WHERE status='error'
                AND started_at >= DATEADD(hour,-24,GETDATE())`),
      getAsync(`SELECT COUNT(*) AS total FROM etl.execution_logs
                WHERE CAST(started_at AS DATE) = CAST(GETDATE() AS DATE)`),
      getAsync(`SELECT ISNULL(SUM(records_inserted),0)+ISNULL(SUM(records_updated),0) AS total
                FROM etl.execution_logs WHERE CAST(started_at AS DATE) = CAST(GETDATE() AS DATE)
                AND status='success'`),
    ]);

    const recentLogs = await allAsync(`
      SELECT TOP 10 l.id, l.status, l.started_at, l.duration_ms,
             l.records_inserted, l.records_updated, l.error_message,
             i.name AS integration_name, c.trade_name AS company_name
      FROM etl.execution_logs l
      LEFT JOIN etl.integrations i ON i.id = l.integration_id
      LEFT JOIN etl.companies    c ON c.id = l.company_id
      ORDER BY l.started_at DESC`);

    const upcomingSchedules = await allAsync(`
      SELECT TOP 5 s.cron_expression, s.last_run, s.run_count,
             i.name AS integration_name, c.trade_name AS company_name
      FROM etl.schedules s
      JOIN etl.integrations i ON i.id = s.integration_id
      LEFT JOIN etl.companies c ON c.id = i.company_id
      WHERE s.is_active = 1
      ORDER BY s.last_run ASC`);

    const todayOk = await getAsync(`
      SELECT COUNT(*) AS total FROM etl.execution_logs
      WHERE status='success' AND CAST(started_at AS DATE)=CAST(GETDATE() AS DATE)`);

    res.json({
      active_companies:   coRow?.total  || 0,
      active_integrations:intRow?.total || 0,
      errors_24h:         errRow?.total || 0,
      executions_today:   todayRow?.total || 0,
      success_today:      todayOk?.total || 0,
      records_today:      recRow?.total || 0,
      recent_logs:        recentLogs,
      upcoming_schedules: upcomingSchedules,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
