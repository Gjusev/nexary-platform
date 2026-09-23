import { randomUUID } from 'crypto';

import { addUserToTeam } from '@/lib/stack/client';

export type JoinRequest = {
  id: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  userId: string;
  email: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
};

const joinRequests = new Map<string, JoinRequest>();

export async function createJoinRequest(input: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  userId: string;
  email: string;
  name: string;
}) {
  const request: JoinRequest = {
    id: randomUUID(),
    teamId: input.teamId,
    teamSlug: input.teamSlug,
    teamName: input.teamName,
    userId: input.userId,
    email: input.email,
    name: input.name,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  joinRequests.set(request.id, request);
  return request;
}

export async function listJoinRequests(teamSlug: string) {
  return Array.from(joinRequests.values()).filter(
    (request) => request.teamSlug === teamSlug && request.status === 'pending'
  );
}

export async function resolveJoinRequest(input: {
  requestId: string;
  action: 'approve' | 'reject';
  decisionBy: string;
}) {
  const request = joinRequests.get(input.requestId);
  if (!request) {
    throw new Error('Join request not found');
  }

  if (request.status !== 'pending') {
    return request;
  }

  if (input.action === 'approve') {
    await addUserToTeam({ userId: request.userId, teamId: request.teamId, role: 'team-member' });
    request.status = 'approved';
  } else {
    request.status = 'rejected';
  }

  request.resolvedAt = new Date().toISOString();
  joinRequests.set(request.id, request);
  return request;
}
