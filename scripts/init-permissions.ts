/**
 * Initialize role permissions in the database
 */

import { ROLE_PERMISSIONS_MAP } from '../lib/permissions-config';

async function initializePermissions() {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  console.log('Clearing existing role_permissions...');
  await client.query('DELETE FROM projectnexus.role_permissions');

  console.log('Populating role_permissions...');

  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    console.log(`\nRole: ${role}`);
    for (const permission of permissions) {
      await client.query(
        'INSERT INTO projectnexus.role_permissions (role, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [role, permission]
      );
      console.log(`  - ${permission}`);
    }
  }

  // Verify the permissions were inserted
  const result = await client.query('SELECT role, permission FROM projectnexus.role_permissions ORDER BY role, permission');

  console.log('\n\nPermissions initialized successfully!');
  console.log('\nAll role permissions in database:');
  console.table(result.rows);

  await client.end();
}

initializePermissions().catch(console.error);
