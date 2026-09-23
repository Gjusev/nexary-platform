'use client';

import { useEffect, Suspense } from 'react';
import { useUser } from '@stackframe/stack';

/**
 * Componente interno que sincroniza automáticamente los roles desde PostgreSQL
 */
function RoleSyncContent({ children }: { children: React.ReactNode }) {
  const user = useUser({ or: 'return-null' });

  useEffect(() => {
    if (!user) return;

    const userId = (user as any).id;
    const serverMetadata = (user as any).serverMetadata || {};
    const lastSync = serverMetadata.lastSync;
    const dbSynced = serverMetadata.dbSynced;

    // Verificar si necesita sincronización
    const needsSync = !dbSynced || !lastSync || 
      (Date.now() - new Date(lastSync).getTime()) > 5 * 60 * 1000; // 5 minutos

    if (needsSync) {
      // Llamar al endpoint de sincronización
      fetch('/api/user/sync-roles', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // NO recargar automáticamente - causar loop infinito
            // El usuario puede recargar manualmente si lo necesita
          } else {
            console.error('❌ [RoleSyncProvider] Error sincronizando:', data.error);
          }
        })
        .catch(error => {
          console.error('❌ [RoleSyncProvider] Error en sincronización:', error);
        });
    } else {
      const minutesSinceSync = Math.floor((Date.now() - new Date(lastSync).getTime()) / (1000 * 60));
      }
  }, [user]);

  return <>{children}</>;
}

/**
 * Provider público con Suspense boundary
 */
export function RoleSyncProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <RoleSyncContent>{children}</RoleSyncContent>
    </Suspense>
  );
}
