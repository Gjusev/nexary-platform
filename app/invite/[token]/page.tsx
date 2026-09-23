'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@stackframe/stack';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';

type Invitation = {
  teamSlug: string;
  email: string;
  role: string;
  expiresAt: string;
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invite/${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
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

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with callback to this page
      router.push(`/login?callbackUrl=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invite/${token}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAccepted(true);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Error al aceptar la invitación');
      }
    } catch (err) {
      setError('Error al aceptar la invitación');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin " />
            <span className="ml-2">Cargando invitación...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12  mx-auto mb-4" />
            <CardTitle className="text-red-600">Invitación no válida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/login')} 
              className="w-full"
              variant="outline"
            >
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12  mx-auto mb-4" />
            <CardTitle className="text-green-600">¡Invitación aceptada!</CardTitle>
            <CardDescription>
              Te has unido exitosamente al equipo <strong>{invitation.teamSlug}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-sm text-gray-600">
              Redirigiendo al dashboard...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-12 w-12  mx-auto mb-4" />
          <CardTitle>Invitación al equipo</CardTitle>
          <CardDescription>
            Has sido invitado a unirte al equipo <strong>{invitation.teamSlug}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Email:</strong> {invitation.email}
            </p>
            <div className="flex justify-center">
              <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                {invitation.role === 'admin' ? 'Administrador' : 'Miembro'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Expira: {new Date(invitation.expiresAt).toLocaleDateString('es-ES')}
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-600">
                Necesitas iniciar sesión para aceptar esta invitación
              </p>
              <Button onClick={handleAccept} className="w-full">
                Iniciar sesión y aceptar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-600">
                Conectado como <strong>{(user as any)?.primaryEmail}</strong>
              </p>
              <Button 
                onClick={handleAccept} 
                className="w-full"
                disabled={accepting}
              >
                {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Aceptar invitación
              </Button>
              <Button 
                onClick={() => router.push('/dashboard')} 
                variant="outline" 
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}