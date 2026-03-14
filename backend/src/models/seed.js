const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seedAdmin({ runAsync, getAsync }) {
  const email    = process.env.ADMIN_EMAIL    || 'admin@etlplatform.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const hash     = bcrypt.hashSync(password, 12);
  const id       = uuidv4();
  const now      = new Date().toISOString();

  await runAsync(
    `INSERT INTO etl.users (id, name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'Super Admin', email, hash, 'superadmin', 'active', now, now]
  );
  console.log(`✅ Admin user created: ${email} / ${password}`);
}

module.exports = { seedAdmin };
