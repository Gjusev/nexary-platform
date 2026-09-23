# Guía de Implementación y Testing de SAML 2.0 SSO

Esta guía explica cómo configurar y probar la integración de SAML 2.0 con diferentes Identity Providers.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
3. [Testing con Okta (Recomendado)](#testing-con-okta)
4. [Testing con Azure AD](#testing-con-azure-ad)
5. [Testing con Google Workspace](#testing-con-google-workspace)
6. [Troubleshooting](#troubleshooting)
7. [Flujo Completo de Autenticación](#flujo-completo-de-autenticación)

---

## Requisitos Previos

Asegúrate de tener:

- ✅ Variables de entorno configuradas (ver abajo)
- ✅ Base de datos PostgreSQL ejecutándose
- ✅ Stack Auth configurado y funcionando
- ✅ Cuenta de prueba en un IdP (Okta, Azure AD, o Google)

---

## Configuración de Variables de Entorno

Agrega estas variables a tu archivo `.env.local`:

```bash
# Stack Auth (ya deberías tener estas)
NEXT_PUBLIC_STACK_PROJECT_ID=tu-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=tu-publishable-key
STACK_SECRET_SERVER_KEY=tu-secret-key
NEXT_PUBLIC_STACK_API_URL=https://api.stack-auth.com  # o tu URL personalizada

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000  # o tu URL de producción

# Certificados SAML (opcional para desarrollo)
# SAML_SP_PRIVATE_KEY=...
# SAML_SP_CERT=...
```

**Importante**: Para producción, necesitas generar certificados X.509 para firmar solicitudes SAML:

```bash
# Generar clave privada y certificado (development only)
openssl req -x509 -newkey rsa:2048 -keyout sp-key.pem -out sp-cert.pem -days 365 -nodes -subj "/CN=app.example.com"

# Convertir a formato de una línea para .env
cat sp-cert.pem | tr -d '\n' > sp-cert-oneline.txt
```

---

## Testing con Okta (Recomendado)

Okta ofrece una cuenta de desarrollador gratuita que es perfecta para testing.

### Paso 1: Crear Cuenta Okta Developer

1. Ve a https://developer.okta.com/signup/
2. Regístrate con una cuenta de email válida
3. Tu organización se creará como `dev-XXXXXX.okta.com`

### Paso 2: Crear Aplicación SAML en Okta

1. En el Dashboard de Okta, ve a **Applications** → **Applications**
2. Click en **Create App Integration**
3. Selecciona **SAML 2.0**
4. Configura la aplicación:

#### General Settings

```
App name: Nexary Development
App logo: (opcional)
App visibility: unchecked
```

#### Configure SAML

```
SSO URL: http://localhost:3000/api/saml/acs
Audience URI (SP Entity ID): http://localhost:3000
Default RelayState: /dashboard
Name ID format: EmailAddress
Application username: Email
```

#### Attribute Statements (opcional pero recomendado)

| Name | Name Format | Value |
|------|-------------|-------|
| `displayName` | Basic | `user.displayName` |
| `firstName` | Basic | `user.firstName` |
| `lastName` | Basic | `user.lastName` |

5. Click en **Next**, luego **Finish**

### Paso 3: Obtener Certificado y URLs de Okta

1. En la página de la aplicación, ve a **Sign On**
2. Copia estos valores:
   - **Identity Provider SSOL URL** → `idpSsoUrl`
   - **Identity Provider Issuer** → `idpEntityId`
   - **X.509 Certificate** → `idpCert`

3. Click en **View SAML setup instructions** para ver el certificado completo

### Paso 4: Configurar Nexary

1. Ve a `http://localhost:3000/dashboard/settings/sso`
2. Selecciona **Okta** como plantilla
3. Completa el formulario:

```
Identity Provider Entity ID: http://www.okta.com/exk...  # valor copiado
SSO URL: https://dev-XXXXXX.okta.com/app/dev...  # valor copiado
X.509 Certificate: -----BEGIN CERTIFICATE-----
MIIDxTCCAk2gAwIBAgIJK...
-----END CERTIFICATE-----
```

4. Click en **Save Configuration**

### Paso 5: Descargar Metadata (Opcional)

1. Click en **Download Metadata XML**
2. Puedes subir este archivo a Okta como alternativa a la configuración manual

### Paso 6: Probar el Login SAML

```bash
# Inicia el flujo SAML
curl -X POST http://localhost:3000/api/saml/tu-team-slug/login \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "/dashboard"}'
```

O desde el navegador:
1. Ve a `http://localhost:3000/login`
2. Click en **"Login with SSO"**
3. Serás redirigido a Okta
4. Ingresa tus credenciales de Okta
5. Serás redirigido de vuelta a Nexary, autenticado

---

## Testing con Azure AD

### Paso 1: Crear Tenant de Prueba Azure AD

1. Ve a https://portal.azure.com/
2. Si no tienes cuenta, crea una cuenta gratuita de Azure
3. Tu tenant será `tu-empresa.onmicrosoft.com`

### Paso 2: Registrar Aplicación Enterprise

1. En Azure Portal, ve a **Azure Active Directory** → **Enterprise applications**
2. Click en **New application** → **Create your own application**
3. Nombre: `Nexary Development`
4. Selecciona **Integrate any other application you don't find in the gallery**
5. Click **Create**

### Paso 3: Configurar Single Sign-On

1. En la aplicación recién creada, ve a **Single sign-on**
2. Selecciona **SAML**
3. Click en **Edit** en **Basic SAML Configuration**

```
Identifier (Entity ID): http://localhost:3000
Reply URL (Assertion Consumer Service URL): http://localhost:3000/api/saml/acs
Sign on URL: http://localhost:3000/login
Relay State: /dashboard
```

4. Guarda la configuración

### Paso 4: Descargar Certificado de Azure

1. En la sección **SAML Signing Certificate**
2. Click en **Download** next to **Certificate (Base64)**
3. Abre el certificado y copia el contenido (incluyendo BEGIN/END CERTIFICATE)

### Paso 5: Copiar URLs de Azure

Necesitas:
- **Login URL**: En "Set up Nexary Development" → Azure AD Identifier
- **Azure AD Identifier**: En "Set up Nexary Development" → App ID URI
- **Logout URL** (opcional): https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/logout

### Paso 6: Configurar Nexary

Usa los valores copiados en `/dashboard/settings/sso` con la plantilla Azure AD.

---

## Testing con Google Workspace

Google requiere un dominio de Google Workspace (no disponible con cuentas Gmail gratuitas).

### Paso 1: Configurar SAML en Google Admin Console

1. Ve a https://admin.google.com/
2. **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**
3. Nombre: `Nexary Development`

### Paso 2: Configurar Google Identity Provider

1. Download el **Google IDP metadata** (lo necesitarás si quieres automated setup)
2. Copia el **SSO URL** y **Entity ID** de Google

### Paso 3: Configurar Service Provider

```
ACS URL: http://localhost:3000/api/saml/acs
Entity ID: http://localhost:3000
Name ID: Primary email
Name ID Format: EMAIL
```

### Paso 4: Configurar Attributes

```
Primary email: Basic Information > Primary email
First name: Basic Information > First name
Last name: Basic Information > Last name
```

### Paso 5: Activar la App

1. Configura **User access** → "ON for everyone" o un grupo específico
2. Guarda la configuración

### Paso 6: Obtener Certificado de Google

1. Click en **Download certificate** en la sección "Service provider details"
2. Guarda el certificado para reference

---

## Troubleshooting

### Error: "Cannot determine team slug from relay state"

**Causa**: El `teamSlug` no se está pasando correctamente en el RelayState.

**Solución**: Asegúrate de que el login request incluya el teamSlug:

```typescript
// En tu frontend
const response = await fetch(`/api/saml/${teamSlug}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ returnUrl: '/dashboard' })
});
```

### Error: "SAML validation failed: Invalid signature"

**Causa**: El certificado X.509 del IdP no coincide con el que configuraste.

**Solución**:
1. Revisa que el certificado esté completo (incluyendo BEGIN/END lines)
2. Verifica que no haya espacios extra ni saltos de línea
3. Asegúrate de estar usando el certificado correcto (signing, no encryption)

### Error: "No profile returned from SAML response"

**Causa**: La respuesta SAML no contiene un assertion válido.

**Solución**:
1. Habilita logs de debug en `lib/saml/saml-provider.ts`
2. Revisa los logs del IdP para ver qué está enviando
3. Verifica que el `audience` (SP Entity ID) coincida

### Error: "User not found in team"

**Causa**: El usuario se autenticó correctamente pero no es miembro del team.

**Solución**:
1. El código debería crear automáticamente la membresía en `ensureTeamMembership()`
2. Si el team no existe, crea el team primero

### Error: "NEXT_PUBLIC_STACK_PROJECT_ID is not set"

**Causa**: Las variables de entorno de Stack Auth no están configuradas.

**Solución**: Agrega las variables de entorno a `.env.local` y reinicia el servidor.

---

## Flujo Completo de Autenticación

### 1. Inicio del Flujo

```
Usuario → Frontend → POST /api/saml/{teamSlug}/login
```

Response:
```json
{
  "samlRequestUrl": "https://idp.example.com/sso?SAMLRequest=..."
}
```

### 2. Redirección al IdP

```
Frontend → Redirige usuario a samlRequestUrl
Usuario → Ingresa credenciales en IdP
IdP → Valida credenciales
```

### 3. IdP envía SAML Response

```
IdP → POST /api/saml/acs
Body: {
  "SAMLResponse": "base64-encoded-saml-response",
  "RelayState": "base64-relay-state"
}
```

### 4. Validación SAML en Nexary

```
POST /api/saml/acs → validateSAMLResponse()
  → Carga configuración SAML del team
  → Valida firma con certificado X.509
  → Extrae atributos del usuario
```

### 5. Creación/Actualización de Usuario

```
findOrCreateUserFromSAML()
  → Busca usuario por email en Stack Auth
  → Si no existe, crea nuevo usuario
  → Actualiza displayName si es necesario
  → Agrega usuario al team (team_members)
```

### 6. Creación de Sesión

```
createSAMLSession()
  → Set cookie: saml_session con datos del usuario
  → Redirige a returnUrl (/dashboard)
```

### 7. Acceso a la Aplicación

```
Usuario → Dashboard
Middleware → Verifica cookie saml_session
  → Obtiene userId de Stack Auth
  → Verifica membresía en team
  → Concede acceso
```

---

## Testing Manual con Postman/curl

### 1. Iniciar Login SAML

```bash
curl -X POST http://localhost:3000/api/saml/test-team/login \
  -H "Content-Type: application/json" \
  -d '{
    "returnUrl": "/dashboard"
  }' \
  -v
```

Response esperado:
```json
{
  "samlRequestUrl": "https://dev-123456.okta.com/app/dev123456_123456/sso/saml",
  "relayState": "ey...",
  "requestId": "abc123..."
}
```

### 2. Simular Callback del IdP

Para esto necesitas una respuesta SAML real del IdP. La forma más fácil es:
1. Completar el flujo en el navegador
2. Usar el Network tab del DevTools para copiar el SAMLResponse
3. Probar con curl:

```bash
curl -X POST http://localhost:3000/api/saml/acs \
  -H "Content-Type: application/json" \
  -d '{
    "SAMLResponse": "copiado-del-browser...",
    "RelayState": "copiado-del-browser..."
  }'
```

---

## Testing Automatizado

### Unit Tests para SAML Provider

```typescript
// __tests__/saml/saml-provider.test.ts

import { SAMLProvider } from '@/lib/saml/saml-provider';

describe('SAMLProvider', () => {
  const mockConfig = {
    idpEntityId: 'http://test-idp.com',
    idpSsoUrl: 'https://test-idp.com/sso',
    idpCert: `-----BEGIN CERTIFICATE-----
MIIDxTCCAk2gAwIBAg...
-----END CERTIFICATE-----`,
    spEntityId: 'http://localhost:3000',
    acsUrl: 'http://localhost:3000/api/saml/acs',
  };

  it('should generate authorize request URL', async () => {
    const provider = new SAMLProvider(mockConfig);
    const url = await provider.generateAuthorizeRequest('/dashboard');

    expect(url).toContain('https://test-idp.com/sso');
    expect(url).toContain('SAMLRequest=');
  });

  it('should validate SAML response', async () => {
    // Mock response real del IdP
    const mockSAMLResponse = '...';
    const provider = new SAMLProvider(mockConfig);

    const profile = await provider.validateResponse(mockSAMLResponse);

    expect(profile).toHaveProperty('email');
    expect(profile).toHaveProperty('nameID');
  });
});
```

---

## Próximos Pasos

Después de confirmar que SAML funciona correctamente:

1. ✅ Configurar certificados X.509 de producción
2. ✅ Agregar botón "Login with SSO" en la página de login
3. ✅ Implementar Single Logout (SLO)
4. ✅ Agregar más IdPs según necesites
5. ✅ Continuar con **SCIM 2.0 Provisioning** (próxima fase)

---

## Checklist de Producción

Antes de deployar a producción:

- [ ] Usar certificados X.509 reales (no self-signed)
- [ ] Configurar `NEXT_PUBLIC_APP_URL` con el dominio de producción
- [ ] Habilitar HTTPS obligatorio
- [ ] Configurar timeout de sesión apropiado
- [ ] Implementar rate limiting en endpoints SAML
- [ ] Configurar logs de auditoría
- [ ] Testear con múltiples usuarios simultáneos
- [ ] Documentar el proceso para los clientes
- [ ] Crear guías específicas por IdP (Okta, Azure, Google)
