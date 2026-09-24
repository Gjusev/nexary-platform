# 🗄️ Cómo Crear las Tablas de Prompts en la Base de Datos

Hay **4 opciones** para crear las tablas. Elige la que prefieras:

---

## ✨ **Opción 1: Automática (Más Fácil)**

Las tablas se crean **automáticamente** cuando accedes por primera vez a la página de prompts.

### Pasos:

1. Inicia tu aplicación:
   ```bash
   npm run dev
   ```

2. Navega a la página de prompts:
   ```
   http://localhost:3000/dashboard/prompts
   ```

3. ¡Listo! Las tablas se crean automáticamente en el primer acceso.

**✅ Ventajas:**
- No requiere comandos adicionales
- Se ejecuta automáticamente
- Sin configuración manual

---

## 🔧 **Opción 2: Script Node.js (JavaScript)**

Ejecuta el script de migración en JavaScript.

### Pasos:

1. Asegúrate de tener el `DATABASE_URL` en tu `.env`:
   ```env
   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nombre_db
   ```

2. Ejecuta el script:
   ```bash
   node scripts/create-prompts-tables.js
   ```

**✅ Ventajas:**
- Fácil de ejecutar
- No requiere TypeScript
- Incluye prompts de ejemplo
- Muestra progreso detallado

---

## 🚀 **Opción 3: Script TypeScript**

Si prefieres usar TypeScript:

### Pasos:

1. Asegúrate de tener el `DATABASE_URL` en tu `.env`

2. Ejecuta con ts-node:
   ```bash
   npx ts-node scripts/create-prompts-tables.ts
   ```

   O compila primero:
   ```bash
   npx tsc scripts/create-prompts-tables.ts
   node scripts/create-prompts-tables.js
   ```

**✅ Ventajas:**
- Type-safe
- Usa las funciones de tu codebase
- Validación en tiempo de desarrollo

---

## 📝 **Opción 4: SQL Directo con psql**

Ejecuta el archivo SQL directamente con PostgreSQL.

### Pasos:

1. Abre PowerShell o CMD en la raíz del proyecto

2. Ejecuta el archivo de migración:
   ```bash
   # PowerShell
   $env:DATABASE_URL = "postgresql://usuario:contraseña@localhost:5432/db"
   psql $env:DATABASE_URL -f migrations/003_add_prompts_library.sql
   ```

   ```bash
   # CMD
   set DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/db
   psql %DATABASE_URL% -f migrations/003_add_prompts_library.sql
   ```

   ```bash
   # Bash/Linux/Mac
   export DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/db"
   psql $DATABASE_URL -f migrations/003_add_prompts_library.sql
   ```

**✅ Ventajas:**
- Control total sobre el SQL
- Útil para producción
- Puede ejecutarse remotamente

---

## 🔍 **Verificar que las Tablas se Crearon**

Después de crear las tablas, verifica que existen:

### Opción A: Con psql
```bash
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'projectnexus' AND table_name IN ('prompts', 'user_favorite_prompts');"
```

### Opción B: Desde la aplicación
1. Ve a `/dashboard/prompts`
2. Si ves la interfaz sin errores, ¡las tablas están creadas!

### Opción C: Con un cliente de DB
- pgAdmin
- DBeaver
- TablePlus

Busca en el schema `projectnexus` las tablas:
- `prompts`
- `user_favorite_prompts`

---

## 📊 **Estructura de las Tablas Creadas**

### Tabla `prompts`:
```sql
- id (UUID, Primary Key)
- title (VARCHAR 200)
- content (TEXT)
- description (TEXT)
- visibility ('private', 'team', 'community')
- user_id (TEXT)
- username (TEXT)
- team_slug (TEXT)
- category (VARCHAR 100)
- tags (TEXT[])
- usage_count (INTEGER)
- favorite_count (INTEGER)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Tabla `user_favorite_prompts`:
```sql
- id (UUID, Primary Key)
- user_id (TEXT)
- prompt_id (UUID, Foreign Key)
- created_at (TIMESTAMPTZ)
```

---

## 🎯 **Datos de Ejemplo**

El script crea 3 prompts de comunidad como ejemplos:

1. **Code Review Prompt** - Para revisiones de código
2. **Dokumentations-Zusammenfassung** - Para resumir documentos
3. **Bug Report Template** - Plantilla para reportar bugs

Estos aparecerán en la tab "Community".

---

## ⚠️ **Solución de Problemas**

### Error: "DATABASE_URL no está configurada"

**Solución:**
1. Verifica que existe el archivo `.env` en la raíz del proyecto
2. Agrega la variable:
   ```env
   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nombre_db
   ```

### Error: "psql: command not found"

**Solución:**
- Usa la **Opción 2** (Script Node.js) en su lugar
- O instala PostgreSQL client tools

### Error: "relation already exists"

**Solución:**
- Las tablas ya están creadas, ¡no hay problema!
- Puedes continuar usando la aplicación

### Error: "permission denied for schema projectnexus"

**Solución:**
1. Verifica los permisos del usuario de DB
2. Ejecuta como superuser:
   ```sql
   GRANT ALL ON SCHEMA projectnexus TO tu_usuario;
   ```

---

## 🔄 **Rollback (Eliminar Tablas)**

Si necesitas eliminar las tablas:

```sql
DROP TABLE IF EXISTS projectnexus.user_favorite_prompts CASCADE;
DROP TABLE IF EXISTS projectnexus.prompts CASCADE;
```

---

## 📚 **Próximos Pasos**

Una vez creadas las tablas:

1. ✅ Accede a `/dashboard/prompts`
2. ✅ Crea tu primer prompt
3. ✅ Explora los prompts de comunidad
4. ✅ Comparte prompts con tu equipo

---

## 💡 **Recomendación**

Para desarrollo local: **Usa la Opción 1 (Automática)**

Para producción: **Usa la Opción 4 (SQL directo con psql)**

---

## 📞 **Soporte**

Si tienes problemas, revisa:
- Logs de la consola
- Archivo `.env`
- Conexión a la base de datos
- Permisos del usuario de DB

¿Necesitas ayuda? Contacta al equipo de desarrollo.
