'use client';

import { useMemo, useRef, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit2, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function getInitials(name: string, email: string) {
  if (name && name.trim() !== '') {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const user = useUser({ or: 'redirect' });
  const { toast } = useToast();
  const t = useTranslations('settings.profile');
  const common = useTranslations('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

  const email = user.primaryEmail || t('fallbackEmail');
  const initials = useMemo(
    () => getInitials(user.displayName || '', email),
    [user.displayName, email]
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await user.update({ displayName });
      setIsEditing(false);
      toast({
        title: t('toast.profileUpdated.title'),
        description: t('toast.profileUpdated.description'),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.profileUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compress image to meet Stack Auth 100KB limit
  const compressImage = (file: File, maxSizeKB: number = 90): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          // Calculate dimensions (max 256x256 for profile)
          let { width, height } = img;
          const maxDimension = 256;

          if (width > height) {
            if (width > maxDimension) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels until under limit
          let quality = 0.8;
          let result = canvas.toDataURL('image/jpeg', quality);

          while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }

          if (result.length > maxSizeKB * 1024 * 1.37) {
            reject(new Error('Image too large even after compression'));
            return;
          }

          resolve(result);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.invalidFileType'),
        variant: 'destructive',
      });
      return;
    }

    // Increased limit since we'll compress
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t('toast.errorTitle'),
        description: t('toast.fileTooLarge'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);

      // Compress image to under 100KB
      const compressedBase64 = await compressImage(file);

      await user.update({ profileImageUrl: compressedBase64 } as any);

      toast({
        title: t('toast.photoUpdated.title'),
        description: t('toast.photoUpdated.description'),
      });

      // Reload page to refresh user data from Stack Auth
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error updating photo:', error);
      toast({
        title: t('toast.errorTitle'),
        description: error instanceof Error ? error.message : t('toast.photoUpdateError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail !== email) {
      toast({
        title: t('dangerZone.toast.emailMismatch.title'),
        description: t('dangerZone.toast.emailMismatch.description'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsDeleting(true);
      // Stack Auth provides a delete method
      await user.delete();

      toast({
        title: t('dangerZone.toast.accountDeleted.title'),
        description: t('dangerZone.toast.accountDeleted.description'),
      });

      // Redirect to home after deletion
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('dangerZone.toast.deleteError.title'),
        description: t('dangerZone.toast.deleteError.description'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('title')}
        </h2>
      </div>

      <div className="space-y-10">
        {/* Profile image actions */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                variant="outline"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('photo.uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {t('photo.upload')}
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('photo.supportedFormats')}
              </p>
            </div>
          </div>
        </div>

        {/* User name */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">{t('name.label')}</Label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('name.description')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {user.displayName || t('name.empty')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing((value) => !value)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 mt-4">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('name.placeholder')}
                className="max-w-md"
              />
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('name.saving')}
                  </>
                ) : (
                  t('name.save')
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setDisplayName(user.displayName || '');
                }}
                size="sm"
              >
                {common('cancel')}
              </Button>
            </div>
          )}
        </div>

        {/* Profile image preview */}
        <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">{t('photo.title')}</Label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('photo.description')}
              </p>
            </div>
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <Label className="text-base font-medium">{t('email.label')}</Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('email.description')}
            </p>
          </div>
          <div className="text-slate-900 dark:text-slate-100">{email}</div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4 pt-6 border-t-2 border-red-200 dark:border-red-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                {t('dangerZone.title')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('dangerZone.description')}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4">
                {t('dangerZone.deleteButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 dark:text-red-400">
                  {t('dangerZone.dialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('dangerZone.dialog.description')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
                  <p className="text-sm text-red-900 dark:text-red-300">
                    {t('dangerZone.dialog.warning')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm-email">
                    {t('dangerZone.dialog.confirmLabel')}
                  </Label>
                  <Input
                    id="delete-confirm-email"
                    type="email"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={email}
                    className="max-w-md"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('dangerZone.dialog.confirmHint')}
                  </p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmEmail('')}>
                  {common('cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmEmail !== email}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('dangerZone.dialog.deleting')}
                    </>
                  ) : (
                    t('dangerZone.dialog.confirmButton')
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
