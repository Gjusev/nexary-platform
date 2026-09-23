import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  addUserToTeam,
  createTeamWithOwner,
  createUserAccount,
  findTeamBySlug,
  StackAuthError,
} from '@/lib/stack/client';
import { createJoinRequest } from '@/lib/teams';
import { registrationRateLimiter, teamCreationRateLimiter, getClientIp } from '@/lib/rate-limit';
import { authLogger } from '@/lib/stack/logging';
import { logAudit } from '@/lib/audit/logger';

const payloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create'),
    name: z.string().min(3),
    email: z.string().email(),
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayÃºscula')
      .regex(/[a-z]/, 'Debe incluir al menos una minÃºscula')
      .regex(/[0-9]/, 'Debe incluir al menos un nÃºmero'),
    teamName: z.string().min(3),
    notes: z.string().optional(),
  }),

  z.object({
    mode: z.literal('join-request'),
    name: z.string().min(3),
    email: z.string().email(),
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayÃºscula')
      .regex(/[a-z]/, 'Debe incluir al menos una minÃºscula')
      .regex(/[0-9]/, 'Debe incluir al menos un nÃºmero'),
    teamSlug: z.string().min(3),
    message: z.string().optional(),
  }),
  z.object({
    mode: z.literal('join'),
    name: z.string().min(3),
    email: z.string().email(),
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayÃºscula')
      .regex(/[a-z]/, 'Debe incluir al menos una minÃºscula')
      .regex(/[0-9]/, 'Debe incluir al menos un nÃºmero'),
    teamName: z.string().min(3),
    inviteCode: z.string().min(6),
    notes: z.string().optional(),
  }),
  z.object({
    mode: z.literal('join-link'),
    name: z.string().min(3),
    email: z.string().email(),
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número'),
    inviteToken: z.string().min(1),
    teamSlug: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  try {
    // Apply rate limiting (5 per hour for registration attempts per IP to prevent spam)
    const { success: isAllowed } = await registrationRateLimiter.check(clientIp, 5);
    if (!isAllowed) {
      authLogger.warn('Rate limit exceeded', { ip: clientIp });
      return NextResponse.json(
        {
          success: false,
          error: 'RateLimitExceeded',
          message: 'Demasiadas solicitudes. Por favor, intÃ©ntalo mÃ¡s tarde.',
        },
        { status: 429 }
      );
    }

    // Additional rate limiting for team creation
    const body = await request.clone().json();
    if (body.mode === 'create') {
      // 2 team creations per hour per IP
      const { success: isTeamCreationAllowed } = await teamCreationRateLimiter.check(clientIp, 2);
      if (!isTeamCreationAllowed) {
        authLogger.warn('Team creation limit exceeded', { ip: clientIp });
        return NextResponse.json(
          {
            success: false,
            error: 'TeamCreationLimitExceeded',
            message: 'Has alcanzado el lÃ­mite de creaciÃ³n de equipos. IntÃ©ntalo mÃ¡s tarde.',
          },
          { status: 429 }
        );
      }
    }

    const payload = payloadSchema.parse(body);
    authLogger.info('Registration attempt', {
      mode: payload.mode,
      email: payload.email,
      ip: clientIp
    });

    if (payload.mode === 'create') {
      const { team, owner } = await createTeamWithOwner({
        teamName: payload.teamName,
        ownerName: payload.name,
        ownerEmail: payload.email,
        ownerPassword: payload.password,
      });

      authLogger.logRegistration(owner.userId, payload.email, team.id, clientIp);

      await logAudit({
        action: 'REGISTER',
        userId: owner.userId,
        teamSlug: team.slug || undefined,
        targetType: 'team',
        targetId: team.id,
        ipAddress: clientIp,
        metadata: { email: payload.email, role: 'owner' }
      });

      return NextResponse.json({ success: true, team });

    } else if (payload.mode === 'join-request') {
      // Handle join request
      const team = await findTeamBySlug(payload.teamSlug);
      if (!team) {
        authLogger.warn('Team not found for join request', { teamSlug: payload.teamSlug, ip: clientIp });
        return NextResponse.json({ success: false, error: 'Equipo no encontrado' }, { status: 404 });
      }

      const user = await createUserAccount({
        email: payload.email,
        password: payload.password,
        name: payload.name,
      });

      const requestRecord = await createJoinRequest({
        teamId: team.id,
        teamSlug: team.slug ?? team.id,
        teamName: team.name,
        userId: user.userId,
        email: payload.email,
        name: payload.name,
      });

      authLogger.info('Join request created', {
        userId: user.userId,
        teamId: team.id,
        email: payload.email,
        ip: clientIp
      });

      await logAudit({
        action: 'REGISTER', // Consolidate join request as register/request
        userId: user.userId,
        teamSlug: team.slug || undefined,
        targetType: 'join_request',
        targetId: requestRecord.id,
        ipAddress: clientIp,
        metadata: { email: payload.email, type: 'join_request' }
      });

      return NextResponse.json({
        success: true,
        message: 'Solicitud enviada. Un administrador revisará tu acceso.',
        request: requestRecord,
      }, { status: 202 });
    } else if (payload.mode === 'join-link') {
      // Handle invitation link
      const { useInvitationLink: validateAndUseInvitationLink } = await import('@/lib/team-invitation-links');
      const result = await validateAndUseInvitationLink(payload.inviteToken, payload.email);

      if (!result.success) {
        authLogger.warn('Invalid invitation link', { token: payload.inviteToken, ip: clientIp });
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
      }

      const user = await createUserAccount({
        email: payload.email,
        password: payload.password,
        name: payload.name,
      });

      // Find the team and add the user to it
      const team = await findTeamBySlug(result.teamSlug!);
      if (!team) {
        authLogger.error('Team not found after invitation link validation', {
          teamSlug: result.teamSlug,
          userId: user.userId
        });
        return NextResponse.json({
          success: false,
          error: 'Error interno: equipo no encontrado'
        }, { status: 500 });
      }

      // Add user to team as member in Stack Auth
      await addUserToTeam({
        userId: user.userId,
        teamId: team.id,
        role: 'member'
      });

      // Sync to PostgreSQL immediately with correct role
      try {
        const { query } = await import('@/lib/db');

        // Ensure team exists in PostgreSQL
        await query(
          `INSERT INTO teams (id, slug, name, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [team.id, team.id, team.name]
        );

        // Add user to team_members as member
        await query(
          `INSERT INTO team_members (team_id, user_id, email, name, role, status, joined_at)
           VALUES ($1, $2, $3, $4, 'member', 'active', NOW())
           ON CONFLICT (team_id, user_id) DO UPDATE SET
             status = 'active',
             updated_at = NOW()`,
          [team.id, user.userId, payload.email, payload.name]
        );

        } catch (dbError) {
        console.error('Failed to sync team member to PostgreSQL:', dbError);
        // Don't throw - user was added to Stack Auth successfully
      }

      authLogger.info('User joined team via invitation link', {
        teamSlug: result.teamSlug,
        teamId: team.id,
        email: payload.email,
        userId: user.userId,
        ip: clientIp
      });

      await logAudit({
        action: 'TEAM_INVITE_ACCEPT',
        userId: user.userId,
        teamSlug: team.slug || undefined,
        targetType: 'team',
        targetId: team.id,
        ipAddress: clientIp,
        metadata: { email: payload.email, token: payload.inviteToken }
      });

      return NextResponse.json({ success: true, team: result.teamSlug, user });
    } else {
      // Legacy join flow
      const team = await findTeamBySlug(payload.teamName);
      if (!team) {
        authLogger.warn('Team not found', { teamName: payload.teamName, ip: clientIp });
        return NextResponse.json(
          { success: false, error: 'TeamNotFound', message: 'El equipo no existe.' },
          { status: 404 }
        );
      }

      const user = await createUserAccount({
        email: payload.email,
        password: payload.password,
        name: payload.name,
      });

      const requestRecord = await createJoinRequest({
        teamId: team.id,
        teamSlug: team.slug ?? team.id,
        teamName: team.name,
        userId: user.userId,
        email: payload.email,
        name: payload.name,
      });

      authLogger.info('Join request created', {
        userId: user.userId,
        teamId: team.id,
        email: payload.email,
        ip: clientIp
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Solicitud enviada. Un administrador revisará tu acceso.',
          request: requestRecord,
        },
        { status: 202 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      authLogger.warn('Validation error', { error: error.flatten(), ip: clientIp });
      return NextResponse.json(
        {
          success: false,
          error: 'ValidationError',
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    if (error instanceof StackAuthError) {
      authLogger.error('Stack Auth error', {
        message: error.message,
        statusCode: error.statusCode,
        ip: clientIp
      });
      return NextResponse.json(
        {
          success: false,
          error: error.name,
          message: error.message,
          details: error.details,
        },
        { status: error.statusCode || 500 }
      );
    }

    authLogger.logError(error as Error, 'registration', undefined, undefined, clientIp);
    return NextResponse.json(
      {
        success: false,
        error: 'StackAuthRegistrationError',
        message:
          error instanceof Error ? error.message : 'Error inesperado durante el registro.',
      },
      { status: 500 }
    );
  }
}



