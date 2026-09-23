# 🔄 Sistema de Sincronización Automática de Roles

## 📋 Resumen

Este sistema sincroniza automáticamente los roles de los usuarios desde PostgreSQL a Stack Auth, eliminando la necesidad de que los usuarios hagan clic en botones manualmente.

## 🎯 ¿Cómo Funciona?

### 1. **Sincronización Automática en Layout (Client-Side)** 
Cada vez que un usuario se loguea o navega por la aplicación:

```
Usuario se loguea → RoleSyncProvider detecta → Llama API /api/user/sync-roles → Sincroniza desde PostgreSQL → Recarga página
```

**Frecuencia de sincronización:**
- ✅ Primera vez que el usuario se loguea (dbSynced = false)
- ✅ Cada 5 minutos después de la última sincronización
- ⏭️ Salta la sincronización si se sincronizó hace menos de 5 minutos

**Nota:** La sincronización se hace en el cliente (no en middleware) porque Next.js Edge Runtime no soporta módulos de Node.js como `pg`.

### 2. **Flujo de Datos**

```
PostgreSQL (team_members)     →     Stack Auth (serverMetadata)     →     Frontend (useUser)
━━━━━━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━
role: 'owner'                       roles: ['TEAM_LEADER']             isOwner: true
role: 'leader'              →       teamRole: 'TEAM_LEADER'     →      roles: ['TEAM_LEADER']
role: 'member'                      dbRole: 'owner'                    ✅ Acceso admin
                                    teamSlug: 'mi-equipo'
                                    lastSync: '2025-10-05T...'
```

### 3. **Mapeo de Roles**

| Rol en PostgreSQL | Rol en Stack Auth | Permisos            |
|-------------------|-------------------|---------------------|
| `owner`           | `TEAM_LEADER`     | ✅ Admin, RAG, Team |
| `leader`          | `TEAM_LEADER`     | ✅ Admin, RAG, Team |
| `admin`           | `TEAM_LEADER`     | ✅ Admin, RAG, Team |
| `member`          | `TEAM_MEMBER`     | ❌ Solo miembro     |

## 📁 Archivos Modificados

### 1. `lib/sync-user-roles.ts` (NUEVO)
Contiene la lógica de sincronización:
- `syncUserRolesFromDB(userId)`: Lee PostgreSQL → Actualiza Stack Auth
- `needsSync(lastSync, maxAgeMinutes)`: Verifica si necesita sincronizar

### 2. `middleware.ts` (MODIFICADO)
Solo verifica autenticación (no sincroniza roles debido a Edge Runtime):
```typescript
// Verifica autenticación y agrega header si necesita sync
const serverMetadata = (user as any).serverMetadata || {};
if (!serverMetadata.dbSynced) {
  response.headers.set('X-Needs-Role-Sync', 'true');
}
```

### 3. `components/providers/role-sync-provider.tsx` (NUEVO)
Componente que sincroniza roles automáticamente en el cliente:
```typescript
// Se ejecuta cuando el usuario se loguea o navega
if (!dbSynced || needsSync(lastSync, 5)) {
  fetch('/api/user/sync-roles', { method: 'POST' });
}
```

### 4. `app/layout.tsx` (MODIFICADO)
Agrega el RoleSyncProvider para sincronización automática:
```typescript
<StackAuthProvider>
  <RoleSyncProvider>
    {children}
  </RoleSyncProvider>
</StackAuthProvider>
```

### 5. `hooks/use-team.ts` (MODIFICADO)
Lee los roles sincronizados automáticamente:
```typescript
// Muestra en consola si los roles están sincronizados
if (serverMetadata.dbSynced) {
  console.log('✅ Roles sincronizados desde PostgreSQL');
}
```

### 6. `app/api/user/sync-roles/route.ts` (NUEVO)
Endpoint para forzar sincronización manual:
```bash
POST /api/user/sync-roles
```

## 🚀 Casos de Uso

### Caso 1: Usuario se loguea por primera vez
1. Usuario inicia sesión → Redirige a `/dashboard`
2. Middleware detecta `dbSynced = false`
3. Ejecuta `syncUserRolesFromDB(userId)`
4. Lee rol desde PostgreSQL (`owner`)
5. Actualiza Stack Auth con `teamRole: 'TEAM_LEADER'`
6. Usuario ve sus permisos de admin inmediatamente ✅

### Caso 2: Usuario cambia de rol en PostgreSQL
1. Admin cambia rol de `member` a `owner` en PostgreSQL
2. Usuario navega a `/dashboard/rag`
3. Han pasado >5 minutos desde última sync
4. Middleware ejecuta `syncUserRolesFromDB(userId)`
5. Lee nuevo rol (`owner`) desde PostgreSQL
6. Actualiza Stack Auth
7. Usuario ve nuevos permisos ✅

### Caso 3: Usuario se une a un equipo
1. Usuario acepta invitación → Se agrega a `team_members`
2. Backend llama `POST /api/user/sync-roles`
3. Sincroniza inmediatamente el nuevo rol
4. Usuario ve su equipo y permisos ✅

## 🔧 Configuración

### Variables de Entorno Requeridas
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_STACK_PROJECT_ID=...
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=...
STACK_SECRET_SERVER_KEY=...
NEXT_PUBLIC_STACK_API_URL=https://stack-api.example.com
```

### Ajustar Frecuencia de Sincronización
En `middleware.ts`, cambia el parámetro de `needsSync`:
```typescript
// Sincronizar cada 10 minutos en lugar de 5
if (!serverMetadata.dbSynced || needsSync(lastSync, 10)) {
  await syncUserRolesFromDB(user.id);
}
```

## 🧪 Testing

### Ver logs de sincronización
1. Abre DevTools (F12) → Consola
2. Navega a `/dashboard`
3. Verás logs como:
```
🔄 [middleware] Sincronizando roles automáticamente para: user_abc123
✅ [syncUserRoles] Usuario user_abc123: DB role="owner" → Internal role="TEAM_LEADER"
✅ [middleware] Roles sincronizados: TEAM_LEADER
```

### Verificar sincronización en `/test-auth`
1. Ve a `/test-auth`
2. Busca en la salida:
```json
"serverMetadata": {
  "dbSynced": true,
  "lastSync": "2025-10-05T12:34:56.789Z",
  "dbRole": "owner",
  "teamRole": "TEAM_LEADER",
  "roles": ["TEAM_LEADER"]
}
```

### Forzar sincronización manual
```javascript
// En consola del navegador:
fetch('/api/user/sync-roles', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

## ✅ Ventajas

1. **Automático**: No requiere intervención del usuario
2. **Eficiente**: Solo sincroniza cada 5 minutos
3. **Confiable**: Lee directamente desde PostgreSQL (fuente de verdad)
4. **No bloqueante**: Si falla, no impide el acceso
5. **Transparente**: Logs detallados para debugging

## 🔄 Próximos Pasos

1. ✅ Probar con usuario `yyy@m.com`
2. ✅ Verificar que `isOwner` sea `true` después del login
3. ✅ Confirmar acceso a `/dashboard/rag`
4. 📝 Agregar sincronización después de eventos:
   - Después de register
   - Después de join team
   - Después de cambio de rol por admin

## 🐛 Troubleshooting

### Problema: Roles no se sincronizan
**Solución:** Verificar que el `user_id` en PostgreSQL coincida con el ID de Stack Auth:
```sql
SELECT user_id, role FROM projectnexus.team_members WHERE user_id = 'stack-auth-user-id';
```

### Problema: Sincronización muy frecuente
**Solución:** Aumentar el tiempo en `needsSync(lastSync, 10)` (de 5 a 10 minutos)

### Problema: Error de conexión a PostgreSQL
**Solución:** Verificar `DATABASE_URL` en `.env.local`

## 📚 Documentación Relacionada

- Stack Auth API: https://docs.stack-auth.com/
- PostgreSQL pg module: https://node-postgres.com/
- Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
