'use client';

import { useEffect, useState, Suspense } from 'react';
import { useUser } from '@stackframe/stack';
import { useTeam } from '@/hooks/use-team';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { StackAuthProvider } from '@/components/providers/stack-provider';

function TestAuthContent() {
  const user = useUser({ or: 'return-null' });
  const teamInfo = useTeam();
  const [syncData, setSyncData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSyncData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/sync');
      if (response.ok) {
        const data = await response.json();
        setSyncData(data);
      }
    } catch (error) {
      console.error('Fehler beim Synchronisieren:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSyncData();
    }
  }, [user]);

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Authentifizierungsstatus - Stack Auth</CardTitle>
            {user && (
              <Button size="sm" variant="outline" onClick={fetchSyncData} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Estado del cliente (useUser) */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              Client - useUser():
              {user ? (
                <Badge variant="default">Authentifiziert</Badge>
              ) : (
                <Badge variant="secondary">Nicht authentifiziert</Badge>
              )}
            </h3>
            {user ? (
              <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(
                  {
                    id: user.id,
                    primaryEmail: (user as any).primaryEmail,
                    displayName: (user as any).displayName,
                    teams: (user as any).teams,
                    selectedTeam: (user as any).selectedTeam,
                    clientMetadata: (user as any).clientMetadata,
                    serverMetadata: (user as any).serverMetadata,
                  },
                  null,
                  2
                )}
              </pre>
            ) : (
              <p className="text-slate-500">Kein authentifizierter Benutzer</p>
            )}
          </div>

          {/* Estado del hook useTeam */}
          {user && (
            <div>
              <h3 className="font-semibold mb-2">Hook useTeam():</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Aktuelles Team:</span>
                  <Badge variant="outline">{teamInfo.currentTeam?.displayName || 'N/A'}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Ist Owner/Admin?</span>
                  <Badge variant={teamInfo.isOwner ? 'default' : 'destructive'}>
                    {teamInfo.isOwner ? 'JA ✓' : 'NEIN ✗'}
                  </Badge>
                </div>
              </div>
              <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(
                  {
                    teamSlug: teamInfo.teamSlug,
                    teamName: teamInfo.teamName,
                    'currentTeam.id': teamInfo.currentTeam?.id,
                    roles: teamInfo.roles,
                    isOwner: teamInfo.isOwner,
                    isGlobalAdmin: teamInfo.isGlobalAdmin,
                    status: teamInfo.status,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Datos del servidor */}
          {syncData && (
            <div>
              <h3 className="font-semibold mb-2">Server - /api/user/sync:</h3>
              <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(syncData, null, 2)}
              </pre>
            </div>
          )}

          {/* Análisis de permisos */}
          {user && (
            <div>
              <h3 className="font-semibold mb-2">Berechtigungsanalyse:</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Kann auf Admin zugreifen:</span>
                  <Badge variant={teamInfo.isOwner || teamInfo.isGlobalAdmin ? 'default' : 'secondary'}>
                    {teamInfo.isOwner || teamInfo.isGlobalAdmin ? 'JA' : 'NEIN'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Kann RAGs verwalten:</span>
                  <Badge variant={teamInfo.isOwner ? 'default' : 'secondary'}>
                    {teamInfo.isOwner ? 'JA' : 'NEIN'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Erkannte Rollen:</span>
                  {teamInfo.roles.length > 0 ? (
                    teamInfo.roles.map((role: string) => (
                      <Badge key={role} variant="outline">{role}</Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">Keine Rollen</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Herramienta de sincronización y asignación de roles */}
          {user && (
            <div className="pt-4 border-t space-y-4">
              <div>
                <h3 className="font-semibold mb-2 text-sm">⚙️ Rol in PostgreSQL \u00E4ndern:</h3>
                <p className="text-xs text-slate-500 mb-2">
                  Aktualisieren Sie Ihre Rolle direkt in der PostgreSQL-Datenbank
                </p>
                <div className="flex gap-2 mb-4">
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const response = await fetch('/api/admin/update-user-role', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newRole: 'team-owner' }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                          alert(`✅ Rol in PostgreSQL aktualisiert:\n\nVorher: ${data.before.role}\nJetzt: ${data.after.role}\n\nSQL ausgef\u00FChrt:\n${data.sql}\n\nJetzt mit Stack Auth synchronisieren`);
                        } else {
                          alert(`❌ Fehler: ${data.error}`);
                        }
                      } catch (error) {
                        alert('Fehler beim Aktualisieren des Rolle');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '👑'} Zu TEAM-OWNER in DB \u00E4ndern
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const response = await fetch('/api/admin/update-user-role', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newRole: 'team-leader' }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                          alert(`✅ Rol in PostgreSQL aktualisiert:\n\nVorher: ${data.before.role}\nJetzt: ${data.after.role}\n\nSQL ausgef\u00FChrt:\n${data.sql}\n\nJetzt mit Stack Auth synchronisieren`);
                        } else {
                          alert(`❌ Fehler: ${data.error}`);
                        }
                      } catch (error) {
                        alert('Fehler beim Aktualisieren des Rolle');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '⭐'} Zu TEAM-LEADER in DB \u00E4ndern
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 text-sm">🔄 Rollen aus Datenbank synchronisieren:</h3>
                <p className="text-xs text-slate-500 mb-2">
                  Dies liest Ihre Rolle aus der PostgreSQL-Datenbank und synchronisiert sie mit Stack Auth
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const response = await fetch('/api/admin/sync-roles-from-db', {
                          method: 'POST',
                        });
                        const data = await response.json();
                        if (response.ok) {
                          alert(`✅ Rol synchronisiert:\nDB Rolle: ${data.data.dbRole}\nInterne Rolle: ${data.data.internalRole}\n\nNeu laden...`);
                          window.location.reload();
                        } else {
                          alert(`❌ Fehler: ${data.error}\n${data.details || ''}`);
                        }
                      } catch (error) {
                        alert('Fehler beim Synchronisieren der Rollen');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔄'} Aus DB synchronisieren
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/sync-roles-from-db');
                        const data = await response.json();
                        console.log('Daten aus der DB:', data);
                        alert(`Daten abgerufen. Siehe Konsole f\u00FCr Details.\n\nE-Mail: ${data.email}\nRollen in DB: ${JSON.stringify(data.dbData, null, 2)}`);
                      } catch (error) {
                        alert('Fehler beim Abrufen der Daten');
                      }
                    }}
                  >
                    DB-Daten anzeigen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/check-db');
                        const data = await response.json();
                        console.log('📊 Alle Daten aus der DB:', data);
                        if (data.success) {
                          const summary = `
📊 DATENBANK-ZUSAMMENFASSUNG:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Teams: ${data.data.summary.totalTeams}
Mitglieder: ${data.data.summary.totalMembers}

Siehe Konsole f\u00FCr vollst\u00E4ndige Details
                          `.trim();
                          alert(summary);
                        } else {
                          alert(`Fehler: ${data.error}`);
                        }
                      } catch (error) {
                        alert('Fehler beim Abfragen der DB');
                      }
                    }}
                  >
                    🔍 Alle Teams und Mitglieder anzeigen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/debug/check-user-in-db');
                        const data = await response.json();
                        console.log('🔬 DEBUG - Benutzer in DB:', data);
                        
                        if (data.success) {
                          const msg = `
🔬 VOLLST\u00C4NDIGE DIAGNOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━
Stack Auth ID: ${data.stackAuth.userId}
E-Mail: ${data.stackAuth.email}

Gefunden nach ID: ${data.foundById.count > 0 ? '✅ JA' : '❌ NEIN'}
Gefunden nach E-Mail: ${data.foundByEmail.count > 0 ? '✅ JA' : '❌ NEIN'}

Diagnose:
- Existiert in DB: ${data.diagnosis.existsInDB ? '✅' : '❌'}
- Ben\u00F6tigt UPDATE: ${data.diagnosis.needsUpdate ? '⚠️ JA' : '✓ Nein'}
- Ben\u00F6tigt INSERT: ${data.diagnosis.needsInsert ? '⚠️ JA' : '✓ Nein'}

Siehe Konsole f\u00FCr mehr Details
                          `.trim();
                          alert(msg);
                        } else {
                          alert(`Fehler: ${data.error}`);
                        }
                      } catch (error) {
                        alert('Fehler bei der Diagnose');
                        console.error(error);
                      }
                    }}
                  >
                    🔬 DEBUG: Bin ich in der DB?
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 text-sm">👥 Stack Auth Team Info:</h3>
                <p className="text-xs text-slate-500 mb-2">
                  Ermitteln Sie, wer der Admin des Teams in Stack Auth ist und Ihre Berechtigungen
                </p>
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const response = await fetch('/api/debug/stack-auth-team-info');
                      const data = await response.json();
                      console.log('👥 Stack Auth Team Info:', data);
                      
                      if (data.success) {
                        const teamData = data.data;
                        const hasUpdateTeam = teamData.teamDetails?.hasPermissions?.['$update_team'] || false;
                        const admins = teamData.teamDetails?.admins || [];
                        
                        const msg = `
👥 TEAM-INFORMATIONEN IN STACK AUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Ihre E-Mail: ${teamData.email}
🆔 Ihre ID: ${teamData.userId}

🏢 Team: ${teamData.selectedTeam?.displayName || 'N/A'}

🔐 IHRE BERECHTIGUNGEN:
${Object.entries(teamData.teamDetails?.hasPermissions || {}).map(([perm, has]) => 
  `  ${has ? '✅' : '❌'} ${perm}`
).join('\n')}

👑 TEAM-ADMINS (${admins.length}):
${admins.length > 0 ? admins.map((admin: any) => 
  `  • ${admin.displayName || admin.email} ${admin.id === teamData.userId ? '(SIE)' : ''}`
).join('\n') : '  (Konnten nicht abgerufen werden)'}

${hasUpdateTeam ? '✅ SIE SIND ADMIN IN STACK AUTH' : '❌ SIE SIND NICHT ADMIN IN STACK AUTH'}

Siehe Konsole f\u00FCr vollst\u00E4ndige Details
                        `.trim();
                        alert(msg);
                      } else {
                        alert(`Fehler: ${data.error}`);
                      }
                    } catch (error) {
                      alert('Fehler beim Abfragen von Stack Auth');
                      console.error(error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '👥'} Team-Info in Stack Auth anzeigen
                </Button>
              </div>
              
              {!teamInfo.isOwner && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">⚠️ Rolle manuell zuweisen (Alternative):</h3>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/admin/assign-role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              userId: (user as any).id,
                              role: 'TEAM_LEADER' 
                            }),
                          });
                          if (response.ok) {
                            alert('Rolle TEAM_LEADER zugewiesen. Seite neu laden.');
                            window.location.reload();
                          }
                        } catch (error) {
                          alert('Fehler beim Zuweisen der Rolle');
                        }
                      }}
                    >
                      TEAM_LEADER zuweisen
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/admin/assign-role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              userId: (user as any).id,
                              role: 'GLOBAL_ADMIN' 
                            }),
                          });
                          if (response.ok) {
                            alert('Rolle GLOBAL_ADMIN zugewiesen. Seite neu laden.');
                            window.location.reload();
                          }
                        } catch (error) {
                          alert('Fehler beim Zuweisen der Rolle');
                        }
                      }}
                    >
                      GLOBAL_ADMIN zuweisen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t">
            <Button onClick={() => window.location.href = '/login'}>
              Zum Login
            </Button>
            <Button onClick={() => window.location.href = '/dashboard'}>
              Zum Dashboard
            </Button>
            <Button onClick={() => window.location.href = '/chat'}>
              Zum Chat
            </Button>
            <Button onClick={() => window.location.href = '/dashboard/rag'}>
              Zum RAG
            </Button>
            {user && (
              <Button 
                variant="destructive" 
                onClick={async () => {
                  await user.signOut();
                  window.location.href = '/';
                }}
              >
                Abmelden
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TestAuthPage() {
  return (
    <StackAuthProvider>
      <Suspense fallback={
        <div className="container mx-auto p-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authentifizierungsinformationen werden geladen...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      }>
        <TestAuthContent />
      </Suspense>
    </StackAuthProvider>
  );
}
