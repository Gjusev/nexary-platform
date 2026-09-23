# Authentik SAML Setup for Mokka Agentur

## Información de Configuración

- **Authentik URL**: https://ak.example.com
- **Nexary URL**: https://nexus.example.com
- **Team Slug**: mokka-agentur
- **Corporate Domain**: mokka-agentur.de

---

## PASO 1: Crear SAML Provider en Authentik

1. Ir a: **Applications** → **Providers** → **Create** → **SAML Provider**

2. Configurar:

   | Campo | Valor |
   |-------|-------|
   | Name | `nexary-mokka-agentur` |
   | Authentication Flow | `default-authentication-flow` |
   | Authorization Flow | `default-provider-authorization-explicit-consent` |
   | Assertion valid not before | `minutes: 5` |
   | Assertion valid not on or after | `minutes: 5` |

3. **Protocol Settings**:

   | Campo | Valor |
   |-------|-------|
   | ACS URL | `https://nexus.example.com/api/saml/mokka-agentur/callback` |
   | Audience (Entity ID) | `nexary-mokka-agentur-sp` |
   | Audience (Service Provider Realm) | `nexary-mokka-agentur-sp` |
   | Default Relay State | (dejar vacío) |

4. **Advanced Settings**:

   | Campo | Valor |
   |-------|-------|
   | Name ID Format | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |

5. **Property Mappings**:

   Seleccionar los siguientes mapeos:
   - `Email (use object field)` o `Email (return email as name)`
   - `Name (use first name)`
   - `Username (use username)`

6. Click en **Create**

---

## PASO 2: Obtener el Certificado de Authentik

1. Ir a: **Applications** → **Providers**
2. Click en el provider `nexary-mokka-agentur`
3. Click en **Download Metadata** o ir a:
   ```
   https://ak.example.com/application/nexary-mokka-agentur/metadata/
   ```
4. Buscar en el XML la etiqueta `<X509Certificate>`
5. Copiar el certificado (solo el contenido base64, sin las etiquetas)

---

## PASO 3: Actualizar Configuración en Base de Datos

Usar el script con el certificado obtenido:

```bash
# Opción 1: Crear archivo temporal con el certificado
echo "CERT=tu_certificado_base64_aqui" > cert.tmp

# Opción 2: Usar el admin UI de Nexary
# Ir a /dashboard/admin/teams/mokka-agentur y configurar SAML
```

O ejecutar manualmente el SQL:

```sql
INSERT INTO projectnexus.saml_configurations (
  team_slug,
  idp_entity_id,
  idp_sso_url,
  idp_x509_cert,
  sp_entity_id,
  acs_url,
  slo_url,
  attribute_mapping
) VALUES (
  'mokka-agentur',
  'https://ak.example.com/application/nexary-mokka-agentur/saml/',
  'https://ak.example.com/application/saml/login/nexary-mokka-agentur/',
  'PEGAR_CERTIFICADO_AQUI',
  'nexary-mokka-agentur-sp',
  'https://nexus.example.com/api/saml/mokka-agentur/callback',
  'https://nexus.example.com/api/saml/mokka-agentur/logout',
  '{}'::jsonb
)
ON CONFLICT (team_slug) DO UPDATE SET
  idp_entity_id = EXCLUDED.idp_entity_id,
  idp_sso_url = EXCLUDED.idp_sso_url,
  idp_x509_cert = EXCLUDED.idp_x509_cert,
  sp_entity_id = EXCLUDED.sp_entity_id,
  acs_url = EXCLUDED.acs_url,
  slo_url = EXCLUDED.slo_url,
  updated_at = NOW();
```

---

## PASO 4: Crear Aplicación en Authentik

1. Ir a: **Applications** → **Applications** → **Create**

2. Configurar:

   | Campo | Valor |
   |-------|-------|
   | Name | `Nexary - Mokka Agentur` |
   | Slug | `nexary-mokka-agentur` |
   | Provider | `nexary-mokka-agentur` (el creado arriba) |
   | Launch URL | `https://nexus.example.com/login?team=mokka-agentur` |
   | Open in | `New tab` |

3. **UI Settings**:

   | Campo | Valor |
   |-------|-------|
   | Icon URL | (opcional) |
   | Publisher | `Mokka Agentur` |

4. Click en **Create**

---

## PASO 5: Crear Usuario de Prueba en Authentik

1. Ir a: **Directory** → **Users** → **Create**

2. Configurar:

   | Campo | Valor |
   |-------|-------|
   | Username | `testuser` |
   | Email | `testuser@mokka-agentur.de` |
   | Name | `Test User` |
   | Password | `Test1234!` |

3. Click en **Create**

4. (Opcional) Asignar grupos/roles si es necesario

---

## PASO 6: Probar el SSO

### Prueba 1: Detección de Email

1. Ir a: `https://nexus.example.com/login`
2. Escribir: `testuser@mokka-agentur.de`
3. Verificar que aparezca el botón: **"Sign in with Mokka Agentur SSO"** ✅

### Prueba 2: Autenticación Completa

1. Click en **"Sign in with Mokka Agentur SSO"**
2. Redirige a Authentik: `https://ak.example.com/application/saml/login/nexary-mokka-agentur/`
3. Login con: `testuser` / `Test1234!`
4. Redirige de vuelta a Nexary
5. Usuario autenticado ✅

---

## Troubleshooting

### Error: "Invalid SAML Response"

- Verificar que el certificado esté correcto (sin espacios ni saltos de línea extra)
- Verificar que el reloj del servidor Authentik esté sincronizado
- Verificar que la ACS URL sea correcta

### Error: "No certificate found"

- El provider SAML debe existir primero en Authentik
- Descargar los metadatos desde Authentik
- Extraer el certificado del XML

### Error: "Team not found"

- Verificar que el team `mokka-agentur` exista en la base de datos
- Verificar que `corporate_domain` sea `mokka-agentur.de`
- Verificar que `enterprise_auth_enabled` sea `true`

### No aparece el botón SSO

- Verificar que el email tenga el dominio correcto (@mokka-agentur.de)
- Verificar que el endpoint `/api/auth/detect-team` funcione
- Revisar la consola del navegador para errores

---

## URLs de Referencia

| Descripción | URL |
|-------------|-----|
| Authentik Admin | `https://ak.example.com/if/admin/` |
| Metadata SAML | `https://ak.example.com/application/nexary-mokka-agentur/metadata/` |
| SSO URL | `https://ak.example.com/application/saml/login/nexary-mokka-agentur/` |
| Nexary Login | `https://nexus.example.com/login` |
| Nexary ACS | `https://nexus.example.com/api/saml/mokka-agentur/callback` |

---

## Configuración Rápida

Si ya tienes el certificado, ejecutar:

```bash
CERT="tu_certificado_base64_sin_espacios" npx tsx scripts/configure-authentik.ts
```

O editar el script `configure-authentik.ts` y agregar el certificado directamente.
