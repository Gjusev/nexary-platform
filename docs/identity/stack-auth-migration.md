# Migración de ZITADEL a Stack Auth

## Plan por fases

1. **Inventario y respaldo**
   - Exporta usuarios, roles y memberships desde ZITADEL usando la API de management o la consola (`/management/v1/users/_search`, `projects/{id}/roles`, `orgs/{id}/users/_search`).
   - Respaldos de la base de datos interna (`users`, `teams`, `memberships`).
   - Habilita modo read-only temporal para altas críticas mientras migras.

2. **Diseño en Stack Auth**
   - Crea un proyecto en Stack Auth y habilita el SDK para Next.js.
   - Define claims personalizados para `teamSlug`, `teamName`, `roles`.
   - Configura API keys de servicio para operaciones administrativas.

3. **Script de carga inicial**
   - Para cada usuario exportado de ZITADEL:
     - Crea o reutiliza el equipo (`POST /projects/{projectId}/teams`).
     - Crea usuario (`POST /projects/{projectId}/users`).
     - Asigna roles (`team-owner`, `team-member`) según el dataset.
     - Marca `requirePasswordReset = true` si no migras contraseñas.

4. **Integración de la aplicación**
   - Actualiza NextAuth para usar el proveedor `stack-auth` (credenciales) y sincronizar la sesión con tu DB interna.
   - Sustituye los endpoints de ZITADEL por `lib/stack/client.ts` y rutas `/api/auth/register-team`.
   - Migra las páginas `/login` y `/register` para utilizar Stack Auth.

5. **Transición**
   - Durante un periodo, permite login con ambos sistemas (añade segundo proveedor en NextAuth).
   - Cuando confirmes que los usuarios migrados funcionan, revoca los clientes de ZITADEL y elimina el provider de la app.
   - Comunica a usuarios el nuevo flujo (email + CTA para reestablecer contraseña).

6. **Post-migración**
   - Monitoriza el panel de eventos de Stack Auth (intentos fallidos, MFA).
   - Programa rotación de API keys y revisa permisos de servicio.
   - Limpia código y variables de ZITADEL del repositorio.

## Variables de entorno necesarias

```
STACK_AUTH_API_URL=https://api.stack-auth.com
STACK_AUTH_PROJECT_ID=...
STACK_AUTH_API_KEY=...
STACK_AUTH_CALLBACK_URL=https://app.example.com/api/auth/callback/stack
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
```

## Estrategia de coexistencia temporal

- **Dual login**: añade un segundo proveedor `Credentials` que siga llamando a ZITADEL hasta que todos los usuarios estén migrados.
- **Shadow migration**: en cada login con ZITADEL, crea el usuario en Stack Auth detrás de escena y envía correo con instrucciones para nuevo login.
- **Control de sesión**: define expiración corta para tokens de ZITADEL y larga para Stack Auth; pide relogin forzado después de la ventana de transición.

## Consideraciones de seguridad

- Valida todos los payloads en las API routes (`zod`).
- Aplica rate limiting en `/api/auth/register-team` y `/api/auth/login` para evitar brute-force.
- No guardes tokens de servicio en repositorio. Usa secret manager para producción.
- Verifica códigos de invitación antes de agregar a un equipo. Expíralos tras su uso.
- Limita la creación de equipos por usuario (por ejemplo 3 por día) para evitar spam.
- Habilita MFA en Stack Auth y fuerza `passwordReset` para usuarios migrados.

## Estructura recomendada

```
lib/
  auth/options.ts          # configuración NextAuth con Stack Auth
  stack/client.ts          # SDK ligero para Stack Auth
  db.ts                    # adaptador a base de datos interna
app/
  api/auth/register-team/  # endpoint de registro
  login/page.tsx           # formulario de login
  register/page.tsx        # flujo crear/unirse a equipo
middleware.ts              # protección por teamSlug
```

## Recursos adicionales

- Documentación oficial Stack Auth: https://docs.stack-auth.com
- SDK React / Next.js: https://docs.stack-auth.com/integrations/nextjs
- Guía de mappers y claims personalizados: https://docs.stack-auth.com/custom-claims


