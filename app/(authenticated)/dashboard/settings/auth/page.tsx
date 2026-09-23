'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@stackframe/stack';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Lock, Loader2, Check, AlertCircle, KeyRound, Shield, AlertTriangle, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  generateTOTPSecret,
  generateTOTPQRCodeURL,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode
} from '@/lib/auth/totp';

export default function AuthPage() {
  const user = useUser({ or: 'redirect' });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations('settings.auth');
  const common = useTranslations('common');

  // Get callback URL from search params
  const callbackUrl = searchParams.get('callbackUrl');

  // Password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // MFA state
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isTogglingMfa, setIsTogglingMfa] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaRequiredWarning, setShowMfaRequiredWarning] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Check if MFA is required from URL params
  useEffect(() => {
    // Check if MFA is already enabled from user metadata
    const isMfaEnabled = (user.clientMetadata as any)?.mfaEnabled === true;
    setMfaEnabled(isMfaEnabled);

    const mfaRequired = searchParams.get('mfaRequired') === 'true';
    if (mfaRequired && !isMfaEnabled) {
      setShowMfaRequiredWarning(true);
      // Don't auto-open the dialog - user needs to click "Enable MFA" to see QR
      // Scroll to MFA section for better UX
      const mfaSection = document.getElementById('mfa-section');
      if (mfaSection) {
        mfaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [searchParams, user]);

  const primaryEmail = user.primaryEmail || t('emails.fallback');
  const isEmailVerified = user.primaryEmailVerified;
  const hasPassword = user.hasPassword;

  // Handle password change for users with existing password
  const handlePasswordChange = async () => {
    if (!currentPassword) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.currentPasswordRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      await user.updatePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
      });

      toast({
        title: t('toast.passwordUpdated.title'),
        description: t('toast.passwordUpdated.description'),
      });

      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: t('toast.errorTitle'),
        description: error instanceof Error ? error.message : t('toast.passwordUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle setting password for OAuth users
  const handleSetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsChangingPassword(true);

      // For OAuth users without password, use setPassword
      await (user as any).setPassword({ password: newPassword });

      toast({
        title: t('toast.passwordUpdated.title'),
        description: t('toast.passwordUpdated.description'),
      });

      setShowSetPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error setting password:', error);
      toast({
        title: t('toast.errorTitle'),
        description: error instanceof Error ? error.message : t('toast.passwordUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle MFA toggle
  const handleToggleMfa = async () => {
    if (mfaEnabled) {
      // Disable MFA
      try {
        setIsTogglingMfa(true);
        // Update user metadata to disable MFA
        await user.update({
          clientMetadata: {
            ...((user.clientMetadata as Record<string, unknown>) ?? {}),
            mfaEnabled: false,
            totpSecret: null,
          }
        });
        setMfaEnabled(false);
        toast({
          title: t('toast.mfaDisabled.title'),
          description: t('toast.mfaDisabled.description'),
        });
      } catch (error) {
        console.error('Error disabling MFA:', error);
        toast({
          title: t('toast.errorTitle'),
          description: t('toast.mfaDisableError'),
          variant: 'destructive',
        });
      } finally {
        setIsTogglingMfa(false);
      }
    } else {
      // Enable MFA - generate TOTP secret and show QR code
      try {
        setIsTogglingMfa(true);
        setShowBackupCodes(false);

        // Generate new TOTP secret
        const secret = generateTOTPSecret();
        setTotpSecret(secret);

        console.log('[MFA] Generated secret:', secret);

        // Generate QR code URL
        const totpUrl = generateTOTPQRCodeURL(
          user.primaryEmail || 'user',
          secret,
          'Nexary'
        );

        console.log('[MFA] TOTP URL:', totpUrl);

        // Generate QR code image
        const qrCodeDataUrl = await QRCode.toDataURL(totpUrl);
        setQrCodeUrl(qrCodeDataUrl);

        console.log('[MFA] QR Code generated successfully');

        setShowMfaDialog(true);
      } catch (error) {
        console.error('[MFA] Error creating TOTP secret:', error);
        toast({
          title: t('toast.errorTitle'),
          description: t('toast.mfaEnableError'),
          variant: 'destructive',
        });
      } finally {
        setIsTogglingMfa(false);
      }
    }
  };

  // Handle MFA code verification
  const handleVerifyMfaCode = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.mfaCodeInvalid'),
        variant: 'destructive',
      });
      return;
    }

    if (!totpSecret) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.mfaEnableError'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsTogglingMfa(true);

      // Debug logs
      console.log('[MFA] Verifying code:', mfaCode);
      console.log('[MFA] Secret:', totpSecret);
      console.log('[MFA] Current time:', new Date().toISOString());

      // Verify the TOTP code
      const isValid = verifyTOTP(totpSecret, mfaCode);

      console.log('[MFA] Code valid:', isValid);

      if (!isValid) {
        toast({
          title: t('toast.errorTitle'),
          description: t('toast.mfaCodeInvalid'),
          variant: 'destructive',
        });
        setIsTogglingMfa(false);
        return;
      }

      // Generate backup codes
      const codes = generateBackupCodes(10);
      setBackupCodes(codes);

      // Save hashed backup codes to user metadata
      const hashedCodes = codes.map(hashBackupCode);

      console.log('[MFA] Updating user metadata...');

      // Enable MFA on the user account
      await user.update({
        clientMetadata: {
          ...((user.clientMetadata as Record<string, unknown>) ?? {}),
          mfaEnabled: true,
          totpSecret: totpSecret,
          backupCodes: hashedCodes,
        }
      });

      console.log('[MFA] User metadata updated successfully');

      setMfaEnabled(true);
      setShowBackupCodes(true);
      toast({
        title: t('toast.mfaEnabled.title'),
        description: t('toast.mfaEnabled.description'),
      });
    } catch (error) {
      console.error('[MFA] Error verifying MFA code:', error);
      console.error('[MFA] Error details:', JSON.stringify(error, null, 2));
      toast({
        title: t('toast.errorTitle'),
        description: error instanceof Error ? error.message : t('toast.mfaEnableError'),
        variant: 'destructive',
      });
    } finally {
      setIsTogglingMfa(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('title')}
        </h2>
      </div>

      {/* MFA Required Warning Banner */}
      {showMfaRequiredWarning && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Two-factor authentication required
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              To access this secure area, you need to enable two-factor authentication (2FA) for your account. Please enable it below.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Email Addresses */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('emails.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('emails.description')}
            </p>
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEmailVerified
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-amber-100 dark:bg-amber-900'
                  }`}>
                  {isEmailVerified ? (
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {primaryEmail}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded">
                      {t('emails.primaryBadge')}
                    </span>
                  </div>
                  <p className={`text-xs ${isEmailVerified
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-600 dark:text-amber-400'
                    }`}>
                    {isEmailVerified ? t('emails.verified') : t('emails.notVerified')}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Password */}
        <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('password.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('password.description')}
            </p>
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPassword
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                  {hasPassword ? (
                    <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <KeyRound className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {hasPassword ? t('password.statusLabel') : t('password.noPassword')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {hasPassword
                      ? t('password.lastChanged')
                      : t('password.oauthOnly')
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => hasPassword
                  ? setShowPasswordDialog(true)
                  : setShowSetPasswordDialog(true)
                }
              >
                {hasPassword ? t('password.changeButton') : t('password.setButton')}
              </Button>
            </div>
          </Card>
        </div>

        {/* Two-Factor Authentication (2FA) */}
        <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('mfa.title')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('mfa.description')}
            </p>
          </div>
          <Card className="p-4" id="mfa-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mfaEnabled}
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                  <Shield className={`w-5 h-5 ${mfaEnabled
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-600 dark:text-slate-400'
                    }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t('mfa.method')}
                  </p>
                  <p className={`text-xs ${mfaEnabled
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {mfaEnabled ? t('mfa.status.enabled') : t('mfa.status.disabled')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleMfa}
                disabled={isTogglingMfa}
              >
                {isTogglingMfa ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('mfaDialog.submitting')}
                  </>
                ) : mfaEnabled ? (
                  t('passwordDialog.submit') // Disable
                ) : (
                  t('mfaDialog.submit') // Enable
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Connected Accounts Info */}
        {!hasPassword && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('password.oauthInfo')}
            </p>
          </div>
        )}
      </div>

      {/* Password Change Dialog (for users with password) */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('passwordDialog.title')}</DialogTitle>
            <DialogDescription>{t('passwordDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current">{t('passwordDialog.currentLabel')}</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('passwordDialog.placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">{t('passwordDialog.newLabel')}</Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('passwordDialog.placeholder')}
              />
              <p className="text-xs text-slate-500">
                {t('passwordDialog.requirements')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('passwordDialog.confirmLabel')}</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('passwordDialog.placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
            >
              {common('cancel')}
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('passwordDialog.submitting')}
                </>
              ) : (
                t('passwordDialog.submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog (for OAuth users without password) */}
      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('setPasswordDialog.title')}</DialogTitle>
            <DialogDescription>{t('setPasswordDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPass">{t('passwordDialog.newLabel')}</Label>
              <Input
                id="newPass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('passwordDialog.placeholder')}
              />
              <p className="text-xs text-slate-500">
                {t('passwordDialog.requirements')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPass">{t('passwordDialog.confirmLabel')}</Label>
              <Input
                id="confirmPass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('passwordDialog.placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSetPasswordDialog(false)}
            >
              {common('cancel')}
            </Button>
            <Button onClick={handleSetPassword} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('passwordDialog.submitting')}
                </>
              ) : (
                t('setPasswordDialog.submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Dialog - Custom Implementation */}
      <Dialog open={showMfaDialog} onOpenChange={(open) => {
        setShowMfaDialog(open);
        if (!open) {
          setMfaCode('');
          setQrCodeUrl('');
          setTotpSecret('');
          setBackupCodes([]);
          setShowBackupCodes(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showBackupCodes ? 'Save Your Backup Codes' : t('mfaDialog.title')}</DialogTitle>
            <DialogDescription>
              {showBackupCodes
                ? 'Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.'
                : t('mfaDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            {showBackupCodes ? (
              /* Backup Codes View */
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    Important: Save these codes now
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {`You won't be able to see these codes again after closing this dialog. Make sure to save them in a secure location.`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <code
                      key={index}
                      className="text-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded select-all"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* QR Code */}
                {qrCodeUrl && (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <img src={qrCodeUrl} alt="QR Code for TOTP" className="w-48 h-48" />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <QrCode className="w-4 h-4" />
                        <span>Scan with your authenticator app</span>
                      </div>
                      {totpSecret && (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Or enter this code manually:</p>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded block select-all">
                            {totpSecret}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">{t('mfaDialog.inputLabel')}</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            {showBackupCodes ? (
              <Button
                onClick={() => {
                  setShowMfaDialog(false);
                  setMfaCode('');
                  setQrCodeUrl('');
                  setTotpSecret('');
                  setBackupCodes([]);
                  setShowBackupCodes(false);

                  // Redirect to callback URL if provided
                  if (callbackUrl) {
                    router.push(callbackUrl);
                  }
                }}
              >
                I Have Saved My Codes
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMfaDialog(false);
                    setMfaCode('');
                    setQrCodeUrl('');
                    setTotpSecret('');
                    setBackupCodes([]);
                    setShowBackupCodes(false);
                  }}
                >
                  {common('cancel')}
                </Button>
                <Button
                  onClick={handleVerifyMfaCode}
                  disabled={isTogglingMfa || mfaCode.length !== 6}
                >
                  {isTogglingMfa ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('mfaDialog.verifying')}
                    </>
                  ) : (
                    t('mfaDialog.submit')
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
