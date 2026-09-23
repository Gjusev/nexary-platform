import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/stack-server';

export async function GET(request: NextRequest) {
  try {
    // Handle Stack Auth callback
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    // The Stack Auth library should handle the callback automatically
    // This route is here to ensure the callback URL is accessible

    // Redirect to the main page or the state parameter if provided
    const redirectUrl = state ? decodeURIComponent(state) : '/dashboard';
    
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('❌ [Stack Auth Callback] Error handling callback:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests if needed
  return NextResponse.json({ message: 'Stack Auth callback endpoint' }, { status: 200 });
}
