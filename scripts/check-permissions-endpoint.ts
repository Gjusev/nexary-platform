/**
 * Script to verify permissions endpoint response
 */

async function checkPermissions() {
  // Get role_permissions for team-leader
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  // Get permissions for team-leader role
  const rolePerms = await client.query(`
    SELECT rp.role, rp.permission
    FROM projectnexus.role_permissions rp
    WHERE rp.role = 'team-leader'
    ORDER BY rp.permission
  `);

  console.log('Role permissions for team-leader:');
  console.table(rolePerms.rows);

  // Get a team-leader's team and check their permissions
  const teamLeader = await client.query(`
    SELECT
      tm.user_id,
      tm.role,
      t.slug as team_slug,
      t.name as team_name
    FROM projectnexus.team_members tm
    JOIN projectnexus.teams t ON tm.team_id = t.id
    WHERE tm.role = 'team-leader' AND tm.status = 'active'
    LIMIT 1
  `);

  if (teamLeader.rows.length > 0) {
    const leader = teamLeader.rows[0];
    console.log('\nSample team-leader:', leader);

    // Get the actual permissions this user should have
    const userPerms = await client.query(`
      SELECT DISTINCT rp.permission
      FROM projectnexus.role_permissions rp
      JOIN projectnexus.team_members tm ON tm.role = rp.role
      JOIN projectnexus.teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
        AND t.slug = $2
        AND tm.status = 'active'
      ORDER BY rp.permission
    `, [leader.user_id, leader.team_slug]);

    console.log('\nPermissions for this team-leader:');
    console.table(userPerms.rows);

    // Check if RAG_QUERY and RAG_INGEST are present
    const hasRagQuery = userPerms.rows.some(r => r.permission === 'rag.query');
    const hasRagIngest = userPerms.rows.some(r => r.permission === 'rag.ingest');
    const hasTeamView = userPerms.rows.some(r => r.permission === 'team.view');

    console.log('\nPermission checks:');
    console.log('- RAG_QUERY:', hasRagQuery);
    console.log('- RAG_INGEST:', hasRagIngest);
    console.log('- TEAM_VIEW:', hasTeamView);
  }

  await client.end();
}

checkPermissions().catch(console.error);
