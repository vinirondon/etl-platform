const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../models/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

router.get('/', authenticate, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const rows = await allAsync(
      'SELECT id, name, email, role, status, last_login, created_at FROM etl.users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await getAsync(
      'SELECT id, name, email, role, status, last_login, created_at FROM etl.users WHERE id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await getAsync('SELECT id FROM etl.users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const id   = uuidv4();
    const hash = bcrypt.hashSync(password, 12);
    await runAsync(
      'INSERT INTO etl.users (id, name, email, password_hash, role, status) VALUES (?,?,?,?,?,?)',
      [id, name, email, hash, role || 'operator', status || 'active']
    );
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_USER', resourceType: 'user', resourceId: id, ip: req.ip });
    res.status(201).json({ id, name, email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    await runAsync(
      `UPDATE etl.users SET
         name   = COALESCE(?, name),
         email  = COALESCE(?, email),
         role   = COALESCE(?, role),
         status = COALESCE(?, status),
         updated_at = GETDATE()
       WHERE id = ?`,
      [name, email, role, status, req.params.id]
    );
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_USER', resourceType: 'user', resourceId: req.params.id, ip: req.ip });
    res.json({ message: 'User updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('superadmin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await runAsync('DELETE FROM etl.users WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE_USER', resourceType: 'user', resourceId: req.params.id, ip: req.ip });
    res.json({ message: 'User deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
