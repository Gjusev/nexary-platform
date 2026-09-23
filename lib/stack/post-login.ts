
import { ServerUser } from '@stackframe/stack';
import { createTeam, addUserToTeam } from '@/lib/stack/client';
import { ensureTeamExists } from '@/lib/ensure-team-sync';
import { query } from '@/lib/db';

/**
 * Ensures that a logged-in user has at least one team.
 * If the user has no teams (common with new SSO signups), creates a personal team for them.
 */
export async function ensureUserHasTeam(user: ServerUser) {
    try {
        const teams = await user.listTeams();

        // If user already has teams, do nothing
        if (teams.length > 0) {
            return;
        }

        // Create a personal team
        const teamName = `${user.displayName || 'Personal'}'s Team`;
        const newTeam = await createTeam(teamName, user.id);

        // Add user as owner in Stack Auth
        // Note: createTeam might not automatically add the creator if using ServerApp, checks needed.
        // We explicitly add to be sure.
        await addUserToTeam({
            userId: user.id,
            teamId: newTeam.id,
            role: 'team-owner'
        });

        // 1. Sync Team to Postgres
        await ensureTeamExists(newTeam.id, newTeam.name, 'ensureUserHasTeam');

        // 2. Sync Membership to Postgres
        // This is crucial so the query lookup in permissions/RLS works
        await query(
            `INSERT INTO team_members (team_id, user_id, email, name, role, status, joined_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
       ON CONFLICT (team_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         status = 'active',
         updated_at = NOW()`,
            [
                newTeam.id,
                user.id,
                user.primaryEmail || '',
                user.displayName || 'User',
                'team-owner'
            ]
        );

        } catch (error) {
        console.error('[ensureUserHasTeam] Failed to ensure user team:', error);
        // We don't throw here to avoid blocking the whole UI if this fails, 
        // though the user might be in a broken state without a team.
    }
}
