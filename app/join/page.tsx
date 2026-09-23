'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';
import Link from 'next/link';

type InvitationData = {
  teamSlug: string;
  inviterEmail: string;
  inviteeEmail: string;
  expiresAt: string;
  createdAt: string;
};

function JoinPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de invitación no encontrado');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const res = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        
        if (res.ok && data.success) {
          setInvitation(data.invitation);
        } else {
          setError(data.error || 'Invitación no válida o expirada');
        }
      } catch (err) {
        setError('Error al cargar la invitación');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const acceptInvitation = async () => {
    if (!token) return;

    setAccepting(true);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        // Redirect to login/register page with team info
        setTimeout(() => {
          window.location.href = `/login?team=${encodeURIComponent(data.teamSlug)}`;
        }, 2000);
      } else {
        setError(data.error || 'Error al aceptar la invitación');
      }
    } catch (err) {
      setError('Error al procesar la invitación');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <p className="text-center text-sm text-slate-500 mt-4">
              Verificando invitación...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-red-900 dark:text-red-100">
              Invitación no válida
            </CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Link href="/login">
                <Button variant="outline">
                  Ir al inicio de sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-green-900 dark:text-green-100">
              ¡Invitación aceptada!
            </CardTitle>
            <CardDescription>
              Te has unido exitosamente al equipo. Serás redirigido al inicio de sesión...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6" />
          </div>
          <CardTitle>Invitación al equipo</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a un equipo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation && (
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-2">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Equipo:
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {invitation.teamSlug}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Invitado por:
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {invitation.inviterEmail}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Para:
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {invitation.inviteeEmail}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Expira:
                </label>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {new Date(invitation.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={acceptInvitation} 
              disabled={accepting}
              className="w-full"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Aceptando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aceptar invitación
                </>
              )}
            </Button>
            
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Cancelar
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <p className="text-center text-sm text-slate-500 mt-4">
                Cargando...
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
