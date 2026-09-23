# Script de Validación de Traducciones

Este script valida que todas las keys de traducción utilizadas en los componentes existan en los 3 idiomas (en, es, de) y que estén correctamente traducidas.

## 📋 Resumen

El script `check-translations.js` realiza las siguientes validaciones:

1. **Keys Faltantes**: Keys usadas en componentes pero que NO existen en algún idioma
2. **Keys No Traducidas**: Keys que existen en los 3 idiomas pero tienen el mismo texto en dos o más idiomas
3. **Keys Sin Usar**: Keys definidas en los archivos JSON pero que no se usan en ningún componente

## 🚀 Uso

### Ejecución básica

```bash
npm run check-translations
```

### Opciones disponibles

```bash
# Mostrar salida detallada con ubicación de archivos
npm run check-translations -- --verbose

# Mostrar ayuda para corregir issues
npm run check-translations -- --fix
```

## 📊 Resultados del Script

El script genera un reporte con:

- Total de keys únicas encontradas en componentes
- Total de keys en cada archivo de traducción (en.json, es.json, de.json)
- Resumen de errores encontrados
- Listado detallado de problemas por categoría
- Recomendaciones para corregir los issues

## 🔍 Problemas Detectados Actuales

Al ejecutar el script en el proyecto actual, se encontraron:

### 1. Keys Faltantes (40 keys)
Keys usadas en componentes pero que no existen en todos los idiomas.

**Categorías afectadas:**
- `hero`: 1 key
- `login`: 1 key
- `contact`: 1 key
- `privacy`: 1 key
- `terms`: 1 key
- `badges`: 4 keys
- `welcome`: 1 key
- `templates`: 1 key
- `preferences`: 1 key
- `items`: 6 keys
- `prompts`: 3 keys
- `benefits`: 5 keys

### 2. Keys No Traducidas (1,030 keys)
Keys que existen en los 3 idiomas pero tienen el mismo valor en dos o más idiomas.

**Categorías principales:**
- `dashboard`: 388 keys
- `admin`: 142 keys
- `landing`: 128 keys
- `onboarding`: 54 keys
- `sidebar`: 36 keys
- `auth`: 20 keys
- `navigation`: 20 keys

### 3. Keys Sin Usar (1,030 keys)
Keys definidas en archivos JSON pero que no se usan en ningún componente.

**Categorías principales:**
- `dashboard`: 388 keys
- `admin`: 142 keys
- `landing`: 154 keys
- `sidebar`: 71 keys
- `onboarding`: 54 keys
- `aboutPage`: 13 keys
- `marketplace`: 31 keys

## 💡 Recomendaciones

1. **Agregar las keys faltantes** a todos los idiomas en el directorio `messages/`
2. **Traducir** las keys que tienen el mismo texto en inglés/español/alemán
3. **Eliminar o usar** las keys que no se utilizan en los componentes

## 🔧 Integración con CI/CD

Puedes agregar este script a tu pipeline de CI/CD para validar las traducciones antes de cada deploy:

```yaml
# Ejemplo para GitHub Actions
- name: Check translations
  run: npm run check-translations
```

El script retorna código de salida `1` si encuentra errores, lo que hará que el pipeline falle.

## 📝 Notas Técnicas

- El script busca patrones de traducción como `t('key')` y `t('key', { ... })`
- Analiza archivos `.tsx`, `.ts`, `.jsx`, `.js` en los directorios `app/`, `components/`, `lib/`, y `hooks/`
- Ignora directorios como `node_modules`, `.next`, `dist`, `__tests__`, etc.
- Soporta keys anidadas como `namespace.key.subkey`
