const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { getAsync, runAsync } = require('../models/database');
const { authenticate } = require('../middleware/auth');

const SECRET     = process.env.JWT_SECRET     || 'etl_platform_secret_change_me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await getAsync('SELECT * FROM etl.users WHERE email = ? AND status = ?', [email, 'active']);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await runAsync('UPDATE etl.users SET last_login = GETDATE() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      SECRET,
      { expiresIn: EXPIRES_IN }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getAsync(
      'SELECT id, name, email, role, status, last_login, created_at FROM etl.users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await getAsync('SELECT * FROM etl.users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

    const hash = bcrypt.hashSync(new_password, 12);
    await runAsync('UPDATE etl.users SET password_hash = ?, updated_at = GETDATE() WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password changed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
