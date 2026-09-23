import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { authLogger } from '@/lib/stack/logging';
import { getTeamJoinRequests } from '@/lib/team-management';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  
  try {
    // TODO: Get user from session and verify they are team admin
    // For now, we'll use a placeholder team slug
    const teamSlug = 'demo-team'; // This should come from user session
    
    const requests = await getTeamJoinRequests(teamSlug);
    
    authLogger.info('Join requests retrieved', { 
      teamSlug,
      count: requests.length,
      ip: clientIp 
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    authLogger.error('Error retrieving join requests', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: clientIp 
    });
    
    return NextResponse.json(
      { success: false, error: 'Error retrieving requests' },
      { status: 500 }
    );
  }
}