# Plan de Eliminación de Landing - App.nexary.de

## Objetivo

Transformar la aplicación para que sea **solo chat**, eliminando la landing page y configurando la app para que:
- URL principal: `app.nexary.de`
- Redirigir a `/chat` si el usuario tiene sesión
- Redirigir a `/login` si el usuario no tiene sesión
- Eliminar completamente la landing page y componentes relacionados

---

## 📋 Análisis Actual

### Estructura de Rutas Actual

```
app/
├── page.tsx                          # Raíz → redirige a /{locale}
├── [locale]/
│   ├── page.tsx                      # LANDING PAGE (a eliminar)
│   ├── login/page.tsx                # Login ✅
│   ├── register/page.tsx             # Register ✅
│   ├── verify-email/page.tsx         # Verify email ✅
│   ├── about/page.tsx                # Páginas estáticas (eliminar)
│   ├── contact/page.tsx              # Páginas estáticas (eliminar)
│   ├── features/page.tsx             # Páginas estáticas (eliminar)
│   ├── pricing/page.tsx              # Páginas estáticas (eliminar)
│   └── security/page.tsx             # Páginas estáticas (eliminar)
└── (authenticated)/
    ├── chat/
    │   ├── page.tsx                  # Lista de chats ✅
    │   └── [conversationId]/page.tsx  # Chat individual ✅
    ├── dashboard/                    # Admin/Dashboard ✅
    └── marketplace/                  # Marketplace (evaluar)
```

### Middleware Actual

- Rutas protegidas: `/dashboard`, `/admin`, `/chat`
- Rutas localizadas: `/`, `/login`, `/register`
- Redirección basada en autenticación

---

## 🗑️ Archivos a Eliminar

### 1. Páginas de Landing (8 archivos)

```
app/[locale]/page.tsx                  # Landing principal
app/[locale]/about/page.tsx            # About
app/[locale]/contact/page.tsx          # Contact
app/[locale]/features/page.tsx         # Features
app/[locale]/pricing/page.tsx          # Pricing
app/[locale]/security/page.tsx         # Security
```

### 2. Componentes de Landing (directorio completo)

```
components/landing/                     # TODO el directorio
├── nexary-hero.tsx
├── product-demo.tsx
├── value-props-section.tsx
├── workflow-diagram-section.tsx
├── trust-section.tsx
├── rag-explained-section.tsx
├── services-section.tsx
├── benefits-section.tsx
├── use-cases-section.tsx
├── cta-section.tsx
├── footer.tsx
├── decorative-elements.tsx
├── beta-banner.tsx
└── ... (todos los demás)
```

### 3. Navbar de Landing

```
components/landing-navbar.tsx           # Navbar específico para landing
```

### 4. Traducciones de Landing (en messages/)

Eliminar secciones:
- `landing.*` - Todo el namespace de landing
- `footer.*` - Si solo se usa en landing
- `trustBadges.*` - Si solo se usa en landing
- `valueProps.*` - Si solo se usa en landing

---

## 📝 Cambios Necesarios

### 1. Nuevo Middleware

**Archivo:** `middleware.ts`

```typescript
// CAMBIOS EN MIDDLEWARE:

// 1. Actualizar rutas localizadas
const i18nConfig = {
  locales: ['en', 'de', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localizedRoutes: ['/login', '/register'],  // ELIMINAR '/' de aquí
} as const;

// 2. Añadir lógica de redirección para raíz
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NUEVA LÓGICA: Manejar raíz sin locale
  if (pathname === '/' || pathname === '') {
    // Verificar si usuario está autenticado
    const user = await getUser();

    if (user) {
      // Autenticado → redirigir a /chat
      const locale = getUserLocale(user) || 'en';
      return NextResponse.redirect(`/${locale}/chat`);
    } else {
      // No autenticado → redirigir a /login
      const locale = getLocaleFromRequest(request) || 'en';
      return NextResponse.redirect(`/${locale}/login`);
    }
  }

  // ... resto del middleware actual
}
```

### 2. Nueva Página Raíz

**Archivo:** `app/page.tsx`

```typescript
import { redirect } from 'next/navigation';

export default function RootPage() {
  // Esta página casi nunca se ejecuta porque el middleware
  // maneja la redirección, pero la mantenemos como fallback
  redirect('/en/chat');
}
```

### 3. Actualizar i18n Config

**Archivo:** `i18n.ts`

```typescript
export const i18nConfig = {
  locales: ['en', 'de', 'es'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localizedRoutes: ['/login', '/register'],  // ELIMINAR '/'
} as const;
```

### 4. Eliminar Traducciones de Landing

**Archivos:** `messages/de.json`, `messages/en.json`, `messages/es.json`

Eliminar de cada archivo:
- Todo el namespace `"landing": { ... }`
- Claves relacionadas si están en otros namespaces

---

## 🔄 Flujo de Usuarios Después del Cambio

### Usuario NO Autenticado

```
app.nexary.de
    ↓ (middleware detecta no auth)
/en/login (o /de/login según preferencias)
    ↓ (se loguea)
/en/chat
```

### Usuario Autenticado

```
app.nexary.de
    ↓ (middleware detecta auth)
/es/chat (o /en/chat según preferencias)
```

### Acceso Directo a Rutas

```
app.nexary.de/chat
    ↓ (middleware detecta no auth)
/en/login?callbackUrl=/chat
    ↓ (se loguea)
/en/chat  (redirigido con callbackUrl)
```

---

## ✅ Pasos de Implementación

### Fase 1: Preparación del Middleware

1. **Actualizar middleware.ts**
   - [ ] Eliminar '/' de `localizedRoutes`
   - [ ] Añadir lógica de redirección para raíz `/`
   - [ ] Verificar que /chat sigue siendo ruta protegida
   - [ ] Testing: Acceder a `/` sin auth → redirige a login
   - [ ] Testing: Acceder a `/` con auth → redirige a /chat

### Fase 2: Actualizar Página Raíz

2. **Modificar app/page.tsx**
   - [ ] Simplificar a redirect simple
   - [ ] Eliminar dependencias de landing

3. **Actualizar app/[locale]/page.tsx**
   - [ ] Reemplazar landing con redirect a /chat

### Fase 3: Eliminar Landing Pages

4. **Eliminar páginas estáticas**
   - [ ] Eliminar `app/[locale]/page.tsx`
   - [ ] Eliminar `app/[locale]/about/page.tsx`
   - [ ] Eliminar `app/[locale]/contact/page.tsx`
   - [ ] Eliminar `app/[locale]/features/page.tsx`
   - [ ] Eliminar `app/[locale]/pricing/page.tsx`
   - [ ] Eliminar `app/[locale]/security/page.tsx`

### Fase 4: Eliminar Componentes

5. **Eliminar directorio components/landing/**
   - [ ] Backup del directorio (por si acaso)
   - [ ] Eliminar `components/landing/` completo

6. **Eliminar components/landing-navbar.tsx**
   - [ ] Verificar que no se usa en otro lado
   - [ ] Eliminar archivo

### Fase 5: Limpieza de Traducciones

7. **Eliminar traducciones de landing**
   - [ ] Eliminar namespace `landing` de `messages/de.json`
   - [ ] Eliminar namespace `landing` de `messages/en.json`
   - [ ] Eliminar namespace `landing` de `messages/es.json`
   - [ ] Ejecutar `npm run check-translations`
   - [ ] Corregir cualquier error de traducciones faltantes

### Fase 6: Limpieza de Assets

8. **Eliminar assets no usados**
   - [ ] Buscar imágenes en `public/` relacionadas a landing
   - [ ] Eliminar si no se usan en otra parte

### Fase 7: Testing

9. **Testing completo**
   - [ ] Testear flujo: `/` → `/login` → `/chat`
   - [ ] Testear flujo: `/` → `/chat` (usuario autenticado)
   - [ ] Testear rutas directas: `/de/chat`, `/en/login`
   - [ ] Testear que dashboard sigue funcionando
   - [ ] Testear que admin sigue funcionando
   - [ ] Verificar no broken links
   - [ ] Build exitoso: `npm run build`
   - [ ] TypeScript limpio: `npx tsc --noEmit`

---

## ⚠️ Consideraciones Importantes

### URLs y Redirecciones

1. **SEO**: Si ya hay indexación en Google, usar redirecciones 301
2. **Backlinks**: Si hay enlaces externos, mantener redirecciones
3. **Emails**: Verificar enlaces en emails de bienvenida

### Marketplace

**Pregunta**: ¿Qué pasa con `/marketplace`?
- **Opción A**: Eliminar también (solo chat)
- **Opción B**: Mantener (como parte de la app)

### Compartido con Otro Proyecto

Mencionaste que la landing ya está en otro proyecto.
- **Asegurarse** de que no se comparten componentes
- **Verificar** que las traducciones eliminadas no se necesitan en el otro proyecto

---

## 🚀 Orden Recomendado de Ejecución

1. **Middleware primero** - Cambiar la lógica de redirección
2. **Testing básico** - Verificar que las redirecciones funcionan
3. **Eliminar páginas** - Quitar las páginas de landing
4. **Eliminar componentes** - Quitar el directorio landing
5. **Limpieza final** - Traducciones y assets
6. **Testing completo** - Verificar todo el flujo

---

## 📊 Impacto Esperado

### Tamaño del Proyecto

- **Antes**: ~15 archivos de landing + 1 directorio de componentes
- **Después**: Solo chat, dashboard, admin

### Rutas Finales

```
/                           → Redirige a /chat o /login
/login                     → Login page
/register                  → Register page
/chat                      → Chat (protegido)
/chat/[id]                 → Conversación específica
/dashboard                 → Dashboard (protegido)
/admin                     → Admin (protegido)
/marketplace               → Marketplace (si se mantiene)
```

### Arquitectura Final

```
app.nexary.de (app)
├── /                     → Smart redirect
├── /{locale}/login       → Auth
├── /{locale}/chat        → Chat App
├── /{locale}/dashboard   → Dashboard
└── /{locale}/admin       → Admin
```

---

## 🎯 Checklist Final

Antes de considerar completado:

- [ ] Middleware redirige correctamente la raíz
- [ ] No hay broken links en la app
- [ ] Build exitoso sin errores
- [ ] TypeScript limpio
- [ ] Traducciones consistentes
- [ ] No hay imports a componentes eliminados
- [ ] Testing manual completo
- [ ] Documentación actualizada (si es necesario)

---

**Estado**: Plan completo listo para ejecución
**Riesgo**: Medio - Involucra cambios en middleware y eliminación de archivos
**Tiempo estimado**: 2-3 horas con testing completo
