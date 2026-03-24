const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const db = new PrismaClient();
const NEW_PASSWORD = 'Admin123!';

bcrypt.hash(NEW_PASSWORD, 12).then(hash =>
  db.adminAccount.updateMany({ data: { passwordHash: hash } })
).then(r => {
  console.log(`✅ Password reset for ${r.count} account(s).`);
  console.log(`   Email:    admin@indiethis.com`);
  console.log(`   Password: ${NEW_PASSWORD}`);
  db.$disconnect();
}).catch(e => { console.error(e); db.$disconnect(); });
