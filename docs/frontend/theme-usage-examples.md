# Ejemplos de Uso del Nuevo Tema

Este documento proporciona ejemplos prácticos de cómo usar el nuevo sistema de temas implementado en el proyecto.

## Usando Clases de Tailwind

### Colores de Fondo y Texto

```tsx
// Fondo y texto básicos
<div className="bg-background text-foreground">
  Contenido con colores por defecto
</div>

// Card con estilo
<div className="bg-card text-card-foreground rounded-lg p-4 border border-border">
  Card con bordes
</div>

// Muted (contenido secundario)
<div className="bg-muted text-muted-foreground">
  Contenido secundario
</div>
```

### Botones

```tsx
// Botón primario
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90">
  Botón Primario
</button>

// Botón secundario
<button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:opacity-90">
  Botón Secundario
</button>

// Botón de acento
<button className="bg-accent text-accent-foreground px-4 py-2 rounded-md hover:opacity-90">
  Botón de Acento
</button>

// Botón destructivo
<button className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:opacity-90">
  Eliminar
</button>
```

### Sidebar

```tsx
<aside className="bg-sidebar border-r border-sidebar-border w-64">
  <nav className="p-4">
    <div className="text-sidebar-foreground mb-4">
      Navegación
    </div>
    
    {/* Item activo */}
    <a 
      href="#" 
      className="flex items-center px-3 py-2 rounded-md bg-sidebar-accent text-sidebar-accent-foreground"
    >
      Dashboard
    </a>
    
    {/* Item normal */}
    <a 
      href="#" 
      className="flex items-center px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      Configuración
    </a>
  </nav>
</aside>
```

### Inputs y Formularios

```tsx
<div className="space-y-4">
  <div>
    <label className="text-sm font-medium text-foreground">
      Nombre
    </label>
    <input 
      type="text"
      className="w-full px-3 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="Ingresa tu nombre"
    />
  </div>
  
  <div>
    <label className="text-sm font-medium text-foreground">
      Email
    </label>
    <input 
      type="email"
      className="w-full px-3 py-2 bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="tu@email.com"
    />
  </div>
</div>
```

## Usando Fuentes

### Font Sans (Inter)

```tsx
// Por defecto, todo el texto usa font-sans
<p className="font-sans">
  Texto con fuente Inter (por defecto)
</p>
```

### Font Serif (Lora)

```tsx
// Para títulos o contenido editorial
<h1 className="font-serif text-4xl font-bold">
  Título con Lora
</h1>

<article className="font-serif">
  <p>
    Contenido editorial con fuente serif para mejor legibilidad en textos largos.
  </p>
</article>
```

### Font Mono (Fira Code)

```tsx
// Para código o contenido técnico
<code className="font-mono bg-muted px-2 py-1 rounded text-sm">
  const hello = "world";
</code>

<pre className="font-mono bg-muted p-4 rounded-md overflow-x-auto">
  <code>
    function greet(name: string) {"{"}
      return `Hello, ${"{"}name{"}"}!`;
    {"}"}
  </code>
</pre>
```

## Componentes de UI Comunes

### Card Informativa

```tsx
<div className="bg-card text-card-foreground border border-border rounded-lg p-6 shadow-md">
  <h3 className="font-serif text-xl font-semibold mb-2">
    Título de la Card
  </h3>
  <p className="text-muted-foreground mb-4">
    Descripción o contenido secundario de la card.
  </p>
  <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
    Acción
  </button>
</div>
```

### Alert / Banner

```tsx
// Alert de información
<div className="bg-accent/10 border border-accent rounded-md p-4">
  <p className="text-accent-foreground">
    <strong>Info:</strong> Este es un mensaje informativo.
  </p>
</div>

// Alert de error
<div className="bg-destructive/10 border border-destructive rounded-md p-4">
  <p className="text-destructive-foreground">
    <strong>Error:</strong> Algo salió mal.
  </p>
</div>
```

### Modal / Dialog

```tsx
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
  <div className="bg-popover text-popover-foreground rounded-lg p-6 max-w-md w-full border border-border shadow-xl">
    <h2 className="font-serif text-2xl font-bold mb-4">
      Título del Modal
    </h2>
    <p className="text-muted-foreground mb-6">
      Contenido del modal con información importante.
    </p>
    <div className="flex gap-3 justify-end">
      <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md">
        Cancelar
      </button>
      <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
        Confirmar
      </button>
    </div>
  </div>
</div>
```

### Tabla

```tsx
<div className="border border-border rounded-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-muted">
      <tr>
        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
          Nombre
        </th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
          Email
        </th>
        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
          Rol
        </th>
      </tr>
    </thead>
    <tbody className="bg-card">
      <tr className="border-t border-border hover:bg-muted/50">
        <td className="px-4 py-3 text-sm text-card-foreground">Juan Pérez</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">juan@example.com</td>
        <td className="px-4 py-3 text-sm">
          <span className="bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs">
            Admin
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Badge / Tag

```tsx
<div className="flex gap-2">
  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
    Importante
  </span>
  <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm">
    Nuevo
  </span>
  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
    Archivado
  </span>
</div>
```

## Usando Variables CSS Directamente

En algunos casos, puedes necesitar usar las variables CSS directamente en estilos personalizados:

```tsx
<div 
  style={{
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
    padding: '1rem',
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-sans)',
    boxShadow: 'var(--shadow-md)',
  }}
>
  Contenido con estilos inline
</div>
```

O en un archivo CSS/SCSS:

```css
.custom-component {
  background-color: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--spacing);
  font-family: var(--font-sans);
}

.custom-component:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
}
```

## Chart / Gráficos

```tsx
// Usando los colores de chart para visualizaciones
<div className="flex gap-2">
  <div className="w-20 h-20 rounded" style={{ backgroundColor: 'var(--chart-1)' }} />
  <div className="w-20 h-20 rounded" style={{ backgroundColor: 'var(--chart-2)' }} />
  <div className="w-20 h-20 rounded" style={{ backgroundColor: 'var(--chart-3)' }} />
  <div className="w-20 h-20 rounded" style={{ backgroundColor: 'var(--chart-4)' }} />
  <div className="w-20 h-20 rounded" style={{ backgroundColor: 'var(--chart-5)' }} />
</div>
```

## Modo Oscuro

El tema cambia automáticamente según la clase `dark` en el elemento HTML. La configuración del ThemeProvider se encarga de esto:

```tsx
// Ya está configurado en layout.tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

Todos los componentes que usen las variables del tema se actualizarán automáticamente al cambiar de modo claro a oscuro.

## Consejos de Uso

1. **Usa las variables semánticas**: Prefiere `bg-card` sobre colores específicos como `bg-white` para que el tema funcione correctamente.

2. **Consistencia en tipografía**: Usa `font-sans` para texto general, `font-serif` para encabezados/contenido editorial, y `font-mono` para código.

3. **Accesibilidad**: Las combinaciones de colores foreground/background están diseñadas para mantener buen contraste.

4. **Hover states**: Usa `hover:opacity-90` o combina con otros colores del tema para estados hover.

5. **Sombras**: Si decides activar las sombras, están disponibles desde `shadow-2xs` hasta `shadow-2xl`.

6. **Bordes**: Usa `border-border` para bordes consistentes con el tema.

7. **Espaciado**: La variable `--spacing` (0.25rem) está disponible para espaciado personalizado.
