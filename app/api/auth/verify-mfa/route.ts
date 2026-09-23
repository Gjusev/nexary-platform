import { NextRequest, NextResponse } from 'next/server';
import { StackServerApp } from '@stackframe/stack';
import { verifyTOTP, hashBackupCode } from '@/lib/auth/totp';
import { cookies } from 'next/headers';

const stackServerApp = new StackServerApp({
    tokenStore: 'nextjs-cookie',
});

// Cookie name for MFA verification session
const MFA_VERIFIED_COOKIE = 'mfa_verified';
// Cookie expires after 24 hours (same as typical session)
const MFA_COOKIE_MAX_AGE = 60 * 60 * 24;

interface VerifyMfaRequest {
    code: string;
    isBackupCode?: boolean;
}

/**
 * POST /api/auth/verify-mfa
 * Verify TOTP code for MFA-enabled user during login
 */
export async function POST(request: NextRequest) {
    try {
        const user = await stackServerApp.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized - not logged in' },
                { status: 401 }
            );
        }

        const body = await request.json() as VerifyMfaRequest;
        const { code, isBackupCode = false } = body;

        if (!code || typeof code !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Code is required' },
                { status: 400 }
            );
        }

        // Get MFA settings from user metadata
        const clientMetadata = user.clientMetadata as Record<string, unknown> | null;
        const mfaEnabled = clientMetadata?.mfaEnabled === true;
        const totpSecret = clientMetadata?.totpSecret as string | undefined;
        const backupCodes = clientMetadata?.backupCodes as string[] | undefined;

        if (!mfaEnabled) {
            return NextResponse.json(
                { success: false, error: 'MFA is not enabled for this user' },
                { status: 400 }
            );
        }

        if (!totpSecret) {
            return NextResponse.json(
                { success: false, error: 'MFA is misconfigured - no secret found' },
                { status: 500 }
            );
        }

        let isValid = false;

        if (isBackupCode) {
            // Verify backup code
            const hashedInput = hashBackupCode(code.toUpperCase().trim());
            const codeIndex = backupCodes?.findIndex(bc => bc === hashedInput) ?? -1;

            if (codeIndex >= 0 && backupCodes) {
                isValid = true;

                // Remove used backup code
                const updatedBackupCodes = [...backupCodes];
                updatedBackupCodes.splice(codeIndex, 1);

                // Update user metadata to remove used backup code
                await user.update({
                    clientMetadata: {
                        ...clientMetadata,
                        backupCodes: updatedBackupCodes,
                    }
                });
            }
        } else {
            // Verify TOTP code
            const sanitizedCode = code.replace(/\s/g, '').trim();
            isValid = verifyTOTP(totpSecret, sanitizedCode);
        }

        if (!isValid) {
            return NextResponse.json(
                { success: false, error: 'Invalid verification code' },
                { status: 401 }
            );
        }

        // Set MFA verified cookie
        const cookieStore = await cookies();

        // Create a unique session identifier by hashing user ID + timestamp
        const sessionId = `${user.id}-${Math.floor(Date.now() / 1000)}`;

        cookieStore.set(MFA_VERIFIED_COOKIE, sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: MFA_COOKIE_MAX_AGE,
        });

        console.log('[MFA Verify] Success for user:', user.id);

        return NextResponse.json({
            success: true,
            message: 'MFA verification successful',
        });

    } catch (error) {
        console.error('[MFA Verify] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Verification failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/verify-mfa
 * Check if current user needs MFA and if it's verified
 */
export async function GET() {
    try {
        const user = await stackServerApp.getUser();

        if (!user) {
            return NextResponse.json({
                authenticated: false,
                mfaRequired: false,
                mfaVerified: false,
            });
        }

        const clientMetadata = user.clientMetadata as Record<string, unknown> | null;
        const mfaEnabled = clientMetadata?.mfaEnabled === true;

        // Check if MFA cookie exists
        const cookieStore = await cookies();
        const mfaCookie = cookieStore.get(MFA_VERIFIED_COOKIE);
        const mfaVerified = !!mfaCookie?.value;

        return NextResponse.json({
            authenticated: true,
            mfaRequired: mfaEnabled,
            mfaVerified: mfaEnabled ? mfaVerified : true, // Non-MFA users are always "verified"
        });

    } catch (error) {
        console.error('[MFA Check] Error:', error);
        return NextResponse.json(
            { error: 'Failed to check MFA status' },
            { status: 500 }
        );
    }
}
