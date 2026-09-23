# Prompt-Bibliothek

Sistema completo de biblioteca de prompts con tres niveles de visibilidad y funcionalidades avanzadas.

## Características

### 📝 Tres Niveles de Visibilidad

1. **Privat (Privado)**
   - Prompts visibles solo para el usuario que los creó
   - Ideal para prompts personales y experimentales
   - Icono: 🔒 Lock

2. **Team (Equipo)**
   - Prompts compartidos con todos los miembros del equipo
   - Requiere que el usuario esté en un equipo
   - Ideal para plantillas y procesos de equipo
   - Icono: 👥 Users

3. **Community (Comunidad)**
   - Prompts públicos visibles para todos los usuarios
   - Ideal para compartir mejores prácticas
   - Icono: 🌐 Globe

### ✨ Funcionalidades Principales

- **Crear y Editar Prompts**: Interfaz completa con título, contenido, descripción, categoría y tags
- **Búsqueda**: Busca prompts por título, contenido, descripción o tags
- **Favoritos**: Marca prompts como favoritos con contador
- **Uso y Estadísticas**: 
  - Contador de usos
  - Contador de favoritos
  - Copiar al portapapeles con incremento automático de uso
- **Gestión**: Editar y eliminar tus propios prompts
- **Tags y Categorías**: Organiza prompts con categorías y tags personalizados

## Estructura de Base de Datos

### Tabla `prompts`

```sql
CREATE TABLE projectnexus.prompts (
  id UUID PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  visibility VARCHAR(20) NOT NULL, -- 'private', 'team', 'community'
  user_id TEXT NOT NULL,
  username TEXT,
  team_slug TEXT, -- NULL para private y community
  category VARCHAR(100),
  tags TEXT[],
  usage_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### Tabla `user_favorite_prompts`

```sql
CREATE TABLE projectnexus.user_favorite_prompts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, prompt_id)
);
```

## API Endpoints

### GET `/api/prompts`

Obtener prompts con filtros.

**Query Parameters:**
- `visibility`: 'private' | 'team' | 'community'
- `search`: Texto de búsqueda
- `teamSlug`: Slug del equipo (para prompts de equipo)

**Response:**
```json
{
  "prompts": [
    {
      "id": "uuid",
      "title": "string",
      "content": "string",
      "description": "string",
      "visibility": "private|team|community",
      "user_id": "string",
      "username": "string",
      "team_slug": "string",
      "category": "string",
      "tags": ["string"],
      "usage_count": 0,
      "favorite_count": 0,
      "created_at": "timestamp",
      "updated_at": "timestamp",
      "is_favorite": false
    }
  ]
}
```

### POST `/api/prompts`

Crear un nuevo prompt.

**Body:**
```json
{
  "title": "string",
  "content": "string",
  "description": "string",
  "visibility": "private|team|community",
  "teamSlug": "string", // Requerido solo para visibility='team'
  "category": "string",
  "tags": ["string"]
}
```

### PATCH `/api/prompts/[id]`

Actualizar un prompt existente (solo el creador).

**Body:** Igual que POST (todos los campos opcionales)

### DELETE `/api/prompts/[id]`

Eliminar un prompt (solo el creador).

### POST `/api/prompts/[id]/favorite`

Marcar/desmarcar un prompt como favorito.

**Response:**
```json
{
  "isFavorite": true
}
```

### POST `/api/prompts/[id]/use`

Incrementar el contador de uso de un prompt.

## Uso en la Interfaz

### Acceso

Navega a `/dashboard/prompts` o usa el sidebar del dashboard.

### Crear un Prompt

1. Click en "Prompt hinzufügen"
2. Completa el formulario:
   - **Título**: Nombre descriptivo (máx 200 caracteres)
   - **Contenido**: El prompt en sí (máx 16,000 caracteres)
   - **Descripción**: Explicación opcional
   - **Sichtbarkeit**: Privat, Team, o Community
   - **Kategorie**: Categoría opcional
   - **Tags**: Tags separados por comas
3. Click en "Erstellen"

### Usar un Prompt

1. Busca el prompt en las pestañas (Privat, Team, Community)
2. Click en "Verwenden"
3. El prompt se copia al portapapeles automáticamente
4. El contador de uso se incrementa

### Marcar Favoritos

- Click en el icono ❤️ en cualquier prompt
- Los favoritos se marcan en rojo

### Editar/Eliminar

- Solo puedes editar/eliminar tus propios prompts
- Click en ⋮ (más opciones) → Bearbeiten o Löschen

## Casos de Uso

### Privat (Privado)
- Prompts experimentales
- Plantillas personales
- Prompts en desarrollo

### Team (Equipo)
- Estándares de código del equipo
- Plantillas de documentación
- Procesos de revisión
- Guías de estilo

### Community (Comunidad)
- Mejores prácticas generales
- Prompts útiles para todos
- Plantillas reutilizables
- Ejemplos educativos

## Características de Seguridad

- ✅ Autenticación requerida para todas las operaciones
- ✅ Solo el creador puede editar/eliminar sus prompts
- ✅ Validación de visibilidad (team requiere teamSlug)
- ✅ Sanitización de inputs
- ✅ Límites de caracteres

## Estadísticas

Cada prompt muestra:
- 📈 **Tendencia**: Número de veces usado
- ⭐ **Favoritos**: Número de usuarios que lo marcaron como favorito
- 🕐 **Fecha**: Fecha de creación

## Integración con el Chat

Los prompts se pueden copiar directamente al portapapeles para usarlos en:
- Chat con documentos
- RAG queries
- Cualquier interacción con IA

## Roadmap Futuro

- [ ] Compartir prompts por link
- [ ] Exportar/Importar colecciones
- [ ] Versionado de prompts
- [ ] Templates con variables
- [ ] Prompt chaining
- [ ] Analytics detallados de uso
- [ ] Comentarios y ratings
- [ ] Categorías predefinidas
- [ ] Prompt marketplace

## Tecnologías

- **Frontend**: React, Next.js 15, TypeScript
- **UI**: shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de Datos**: PostgreSQL
- **Auth**: Stack Auth
- **Icons**: Lucide React

## Mantenimiento

### Migración

Para crear las tablas, ejecuta:

```bash
psql $DATABASE_URL -f migrations/003_add_prompts_library.sql
```

O las tablas se crearán automáticamente al inicializar la aplicación gracias a `ensurePromptsTable()`.

### Backup

Las tablas importantes son:
- `projectnexus.prompts`
- `projectnexus.user_favorite_prompts`

## Soporte

Para preguntas o issues, contacta al equipo de desarrollo.
