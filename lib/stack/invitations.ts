import { StackAuthError } from '@/lib/stack/client';
import { createStackServerApp } from '@/lib/stack/stack-server';

// TeamInvitation type based on Stack Auth SDK documentation
type StackTeamInvitation = {
  id: string;
  email: string;
  expiresAt: Date;
};

export type TeamInvitation = StackTeamInvitation & { teamId: string };

export interface CreateInvitationInput {
  teamId: string;
  email: string;
  role: string;
  expiresInDays?: number;
}

async function withTeam(teamId: string) {
  const app = createStackServerApp('memory');
  const team = await app.getTeam(teamId);
  if (!team) {
    throw new StackAuthError('Team not found', 404);
  }
  return team;
}

function decorateInvitation(teamId: string, invitation: StackTeamInvitation): TeamInvitation {
  return Object.assign({ teamId }, invitation);
}

export async function createTeamInvitation(input: CreateInvitationInput): Promise<TeamInvitation> {
  const team = await withTeam(input.teamId);
  await (team as any).inviteUser({ email: input.email });
  const invitations = await (team as any).listInvitations() as StackTeamInvitation[];
  const created = invitations
    .filter((inv: StackTeamInvitation) => inv.email?.toLowerCase() === input.email.toLowerCase())
    .sort((a: StackTeamInvitation, b: StackTeamInvitation) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];

  if (!created) {
    throw new StackAuthError('Failed to create Stack Auth invitation');
  }

  return decorateInvitation(team.id, created);
}

export async function acceptTeamInvitation(): Promise<void> {
  throw new StackAuthError('Accepting invitations must be handled via the Stack Auth SDK on the client.');
}

export async function declineTeamInvitation(): Promise<void> {
  throw new StackAuthError('Declining invitations must be handled via the Stack Auth SDK on the client.');
}

export async function getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  const team = await withTeam(teamId);
  const invitations = await (team as any).listInvitations() as StackTeamInvitation[];
  return invitations.map((invitation: StackTeamInvitation) => decorateInvitation(team.id, invitation));
}

export async function getUserInvitations(email: string): Promise<TeamInvitation[]> {
  const app = createStackServerApp('memory');
  const teams = await app.listTeams();
  const results: TeamInvitation[] = [];

  for (const team of teams) {
    const invitations = await (team as any).listInvitations() as StackTeamInvitation[];
    invitations
      .filter((inv: StackTeamInvitation) => inv.email?.toLowerCase() === email.toLowerCase())
      .forEach((inv: StackTeamInvitation) => results.push(decorateInvitation(team.id, inv)));
  }

  return results;
}

export async function revokeTeamInvitation(invitationId: string): Promise<void> {
  const app = createStackServerApp('memory');
  const teams = await app.listTeams();

  for (const team of teams) {
    const invitations = await (team as any).listInvitations() as StackTeamInvitation[];
    const match = invitations.find((inv: StackTeamInvitation) => inv.id === invitationId);
    if (match) {
      await (match as any).revoke();
      return;
    }
  }

  throw new StackAuthError('Invitation not found', 404);
}

export async function resendTeamInvitation(invitationId: string): Promise<TeamInvitation> {
  throw new StackAuthError('Resending invitations is not yet supported via the Stack Auth SDK.');
}

export function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INV-${result}`;
}

export function isValidInvitationCode(code: string): boolean {
  return /^INV-[A-Z0-9]{8}$/.test(code);
}
