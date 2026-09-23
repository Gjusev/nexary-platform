import { NextRequest, NextResponse } from 'next/server';
import { validateInvitationLink } from '@/lib/team-invitation-links';
import { checkAuthRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limiting check
  const rateLimitResponse = checkAuthRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Token de invitación requerido' }, { status: 400 });
    }

    const validation = await validateInvitationLink(token);

    if (validation.success) {
      // Redirect to registration page with the invitation token
      const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const redirectUrl = `${baseUrl}/register?inviteLink=${token}&teamSlug=${validation.teamSlug}`;

      return NextResponse.redirect(redirectUrl);
    } else {
      // Redirect to an error page or login with error message
      const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const redirectUrl = `${baseUrl}/login?error=${encodeURIComponent(validation.error || 'Enlace inválido')}`;

      return NextResponse.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('Error processing invitation link:', error);
    const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const redirectUrl = `${baseUrl}/login?error=${encodeURIComponent('Error interno del servidor')}`;

    return NextResponse.redirect(redirectUrl);
  }
}
