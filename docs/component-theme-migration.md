# Migración de Componentes al Tema Global

## ✅ Componentes Ya Actualizados

### 1. `app/chat/chat-layout.tsx`
**Estado**: ✅ Completamente actualizado
- Todos los colores `slate-*`, `blue-*` reemplazados por variables del tema
- Fondos, textos, bordes y estados hover usando variables globales
- Input areas, botones y diálogos actualizados

### 2. `app/layout.tsx`
**Estado**: ✅ Actualizado
- Fuente Commissioner cargada
- Variables CSS aplicadas al body

### 3. `components/chat-sidebar.tsx`
**Estado**: ✅ Parcialmente actualizado
- Sidebar principal usando `bg-sidebar`, `border-sidebar-border`
- Botones usando `text-sidebar-foreground`, `bg-sidebar-primary`
- User dropdown actualizado
- Navegación actualizada con hover states

**Cambios aplicados**:
- `bg-white dark:bg-slate-900` → `bg-sidebar`
- `border-slate-200 dark:border-slate-800` → `border-sidebar-border`
- `text-slate-900 dark:text-slate-100` → `text-sidebar-foreground`
- `text-blue-600 hover:text-blue-700` → `text-sidebar-primary hover:text-sidebar-primary/80`
- `bg-gray-800 hover:bg-gray-700` → `bg-sidebar-primary hover:bg-sidebar-primary/90`
- `text-slate-600 dark:text-slate-400` → `text-sidebar-foreground`
- `text-slate-500` → `text-muted-foreground`
- `text-red-600` → `text-destructive`
- `hover:bg-slate-200 dark:hover:bg-slate-700` → `hover:bg-sidebar-accent`

## 🔄 Componentes Pendientes de Actualizar

### Prioridad Alta

#### 1. `components/navbar.tsx`
Buscar y reemplazar:
```
bg-white dark:bg-slate-900 → bg-card
border-slate-200 dark:border-slate-800 → border-border
text-slate-900 dark:text-slate-100 → text-foreground
text-slate-600 dark:text-slate-400 → text-muted-foreground
```

#### 2. `components/dashboard-sidebar.tsx`
Aplicar los mismos cambios que chat-sidebar:
```
bg-white dark:bg-slate-900 → bg-sidebar
border-slate-200 dark:border-slate-800 → border-sidebar-border
text-slate-900 dark:text-slate-100 → text-sidebar-foreground
```

#### 3. `components/rag-sidebar.tsx`
Similar a chat-sidebar, reemplazar:
```
bg-white dark:bg-slate-900 → bg-sidebar
text-blue-600 hover:text-blue-700 → text-sidebar-primary hover:text-sidebar-primary/80
text-slate-500 dark:text-slate-400 → text-muted-foreground
bg-purple-600 hover:bg-purple-700 → bg-sidebar-primary hover:bg-sidebar-primary/90
```

> **Nota:** El antiguo `components/chat-rag-slider.tsx` se retiró y la gestión de RAG ahora vive dentro de `app/chat/chat-layout.tsx` mediante un diálogo inline.

### Prioridad Media

#### 4. `app/dashboard/page.tsx`
Verificar que use los colores del tema en cards y estadísticas.

#### 5. Páginas de Admin (`app/admin/*`)
Actualizar todas las páginas de administración para consistencia.

## 📋 Guía de Reemplazo Rápido

### Fondos
```
bg-white dark:bg-slate-900/950 → bg-background o bg-card
bg-slate-50 dark:bg-slate-950 → bg-muted
bg-slate-100 dark:bg-slate-800 → bg-muted
bg-blue-50 dark:bg-blue-900/20 → bg-primary/10
bg-blue-600 → bg-primary
bg-gray-800 dark:bg-gray-700 → bg-secondary
bg-purple-600 → bg-primary (o bg-accent según contexto)
bg-red-50 dark:bg-red-900/20 → bg-destructive/10
bg-green-50 dark:bg-green-900/20 → bg-accent/10
```

### Textos
```
text-slate-900 dark:text-slate-100 → text-foreground
text-slate-800 dark:text-slate-200 → text-foreground
text-slate-700 dark:text-slate-300 → text-card-foreground
text-slate-600 dark:text-slate-400 → text-muted-foreground
text-slate-500 dark:text-slate-400 → text-muted-foreground
text-slate-400 dark:text-slate-500 → text-muted-foreground
text-blue-600 dark:text-blue-400 → text-primary
text-blue-700 dark:text-blue-300 → text-primary
text-red-600 dark:text-red-400 → text-destructive
text-green-600 dark:text-green-400 → text-accent (o un custom verde)
text-purple-600 dark:text-purple-400 → text-primary
text-white → text-primary-foreground (en contextos de botones primary)
text-black → text-foreground
```

### Bordes
```
border-slate-200 dark:border-slate-800 → border-border
border-slate-300 dark:border-slate-700 → border-border
border-blue-200 dark:border-blue-800 → border-primary/20 o border-primary
border-red-200 dark:border-red-800 → border-destructive/20
border-gray-200 dark:border-gray-800 → border-border
```

### Estados Hover
```
hover:bg-slate-50 dark:hover:bg-slate-800 → hover:bg-muted
hover:bg-slate-100 dark:hover:bg-slate-700 → hover:bg-muted
hover:bg-blue-50 dark:hover:bg-blue-900 → hover:bg-primary/10
hover:text-slate-900 dark:hover:text-slate-100 → hover:text-foreground
hover:text-blue-600 dark:hover:text-blue-400 → hover:text-primary
```

### Sidebar Específico
```
(Sidebar backgrounds)
bg-white dark:bg-slate-900 → bg-sidebar
text-slate-900 dark:text-slate-100 → text-sidebar-foreground
border-slate-200 dark:border-slate-800 → border-sidebar-border

(Sidebar active/primary elements)
bg-blue-600 → bg-sidebar-primary
text-blue-600 → text-sidebar-primary
text-white (en elementos primary) → text-sidebar-primary-foreground

(Sidebar hover/accent)
hover:bg-slate-100 → hover:bg-sidebar-accent
text elementos de accent → text-sidebar-accent-foreground cuando sobre accent bg
```

## 🎯 Script de Búsqueda y Reemplazo

Para actualizar componentes automáticamente, busca estos patrones regex:

```regex
# Fondos slate
bg-slate-(?:50|100|200|900|950)(?:\s+dark:bg-slate-(?:700|800|900|950))?

# Textos slate
text-slate-(?:400|500|600|700|800|900)(?:\s+dark:text-slate-(?:100|200|300|400|500))?

# Bordes slate
border-slate-(?:200|300|700|800)

# Colores blue
(?:bg|text|border)-blue-(?:50|100|200|300|400|500|600|700|800|900)

# Colores gray
(?:bg|text|border)-gray-(?:50|100|200|300|700|800|900)

# Colores purple
(?:bg|text|border)-purple-(?:50|100|200|600|700|800|900)

# Colores red
(?:bg|text|border)-red-(?:50|100|200|600|700|800|900)

# Colores green
(?:bg|text|border)-green-(?:50|100|200|600|700|800|900)
```

## 📝 Notas Importantes

1. **Sidebar vs. Content**: Usa variables `sidebar-*` solo dentro de sidebars. En el contenido principal, usa variables `background`, `foreground`, `card`, etc.

2. **Primary Color**: El color primary ahora es verde turquesa en dark mode y negro en light mode. Úsalo para CTAs y elementos importantes.

3. **Destructive**: Usa `text-destructive` para acciones destructivas/peligrosas en lugar de `text-red-600`.

4. **Muted**: Usa `bg-muted` y `text-muted-foreground` para contenido secundario y placeholder.

5. **Consistencia con UI Components**: Los componentes de `components/ui/*` ya usan las variables del tema, así que al usarlos, no necesitas especificar colores adicionales.

## ✨ Beneficios de la Migración Completa

1. **Tema Unificado**: Toda la aplicación respeta el mismo esquema de colores
2. **Mantenimiento Fácil**: Cambios de color en un solo lugar (globals.css)
3. **Dark Mode Automático**: Funciona sin clases dark: específicas
4. **Accesibilidad**: Contraste garantizado en todos los modos
5. **Identidad de Marca**: Color verde turquesa consistente en toda la app

## 🚀 Siguiente Paso

Puedes aplicar estos cambios manualmente o crear un script que busque y reemplace los patrones. Los componentes más visibles (chat, sidebar) ya están actualizados. Los demás componentes seguirán funcionando pero se beneficiarán de la migración para consistencia total.
