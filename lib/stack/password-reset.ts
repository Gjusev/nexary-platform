import { StackAuthError } from '@/lib/stack/client';
import { createStackServerApp } from '@/lib/stack/stack-server';

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface PasswordResetRequest {
  email: string;
  redirectUrl?: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export async function requestPasswordReset(input: PasswordResetRequest): Promise<void> {
  const app = createStackServerApp('memory');
  const result = await app.sendForgotPasswordEmail(input.email);

  // Stack Auth's Result type: either { status: 'ok' } or { status: 'error', error: ... }
  if (result && 'status' in result && result.status === 'error') {
    throw new StackAuthError((result as any).error?.message || 'Failed to send password reset email');
  }
}

export async function confirmPasswordReset(input: PasswordResetConfirm): Promise<void> {
  const app = createStackServerApp('memory');
  const result = await (app as any).resetPassword({
    code: input.token,
    password: input.newPassword,
  });

  if (result && result.status === 'error') {
    throw new StackAuthError(result.error?.message || 'Failed to reset password');
  }
}

export async function validatePasswordResetToken(token: string): Promise<boolean> {
  const app = createStackServerApp('memory');
  const result = await (app as any).verifyPasswordResetCode(token);
  return result && result.status === 'ok';
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('La contrase\u00f1a debe tener al menos 12 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe incluir al menos una letra may\u00fascula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Debe incluir al menos una letra min\u00fascula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Debe incluir al menos un n\u00famero');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Debe incluir al menos un car\u00e1cter especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function generatePasswordResetUrl(token: string): string {
  return `${process.env.NEXTAUTH_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

export function isPasswordResetTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
