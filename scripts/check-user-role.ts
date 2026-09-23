import { Client } from 'pg';

async function checkUserRole() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  // First, get all tables in the schema
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'projectnexus'
  `);

  console.log('Tables in projectnexus schema:');
  console.table(tables.rows);

  // Get team members
  const teamMembers = await client.query(`
    SELECT
      tm.user_id,
      tm.role,
      tm.status,
      t.slug as team_slug,
      t.name as team_name
    FROM projectnexus.team_members tm
    JOIN projectnexus.teams t ON tm.team_id = t.id
  `);

  console.log('\nAll team members:');
  console.table(teamMembers.rows);

  await client.end();
}

checkUserRole().catch(console.error);
