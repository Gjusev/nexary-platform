#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log(`${colors.cyan}${colors.bold}🔧 CORRECCIÓN DE TRADUCCIONES${colors.reset}`);
console.log('='.repeat(70) + '\n');

// Configuration
const LOCALE_DIR = path.join(__dirname, '../messages');
const COMPONENT_DIRS = ['app', 'components'];
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const IGNORE_PATTERNS = ['node_modules', '.next', 'dist', 'build', '__tests__'];

// Load translation files
const translations = {};
const locales = ['en', 'es', 'de'];

locales.forEach(locale => {
  const filePath = path.join(LOCALE_DIR, `${locale}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    translations[locale] = JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error cargando ${locale}.json: ${error.message}${colors.reset}`);
    translations[locale] = {};
  }
});

// Find keys used in components
const usedKeys = new Set();
const usedTranslationsByNamespace = new Map(); // namespace -> Set of keys

function scanDirectory(dir, depth = 0) {
  if (depth > 10) return;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (IGNORE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
      continue;
    }
    
    if (item.isDirectory()) {
      scanDirectory(fullPath, depth + 1);
    } else if (FILE_EXTENSIONS.some(ext => item.name.endsWith(ext))) {
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract useTranslations calls to find namespace
    const namespaceMatch = content.match(/useTranslations\(['"`]([^'"`]+)['"`]\)/);
    const namespace = namespaceMatch ? namespaceMatch[1] : null;
    
    // Find all t() calls
    const tMatches = content.matchAll(/t\(['"`]([^'"`]+)['"`][^)]*\)/g);
    
    for (const match of tMatches) {
      const key = match[1];
      
      // Skip obvious non-translation strings (imports, variables, very short strings)
      const isImport = key.includes('/') || key.startsWith('http') || key.startsWith('data-') || 
                       key.startsWith('accept-') || key.startsWith('content-') ||
                       key.startsWith('x-') || key.startsWith('NEXT_') ||
                       key.startsWith('cookie') || key.startsWith('user-') ||
                       key.includes('@');
      
      if (isImport || (key.match(/^[a-z]$/i) && key.length < 3)) {
        continue;
      }
      
      // Add full key (namespace.key or just key)
      const fullKey = namespace ? `${namespace}.${key}` : key;
      usedKeys.add(fullKey);
      
      // Track by namespace
      if (namespace) {
        if (!usedTranslationsByNamespace.has(namespace)) {
          usedTranslationsByNamespace.set(namespace, new Set());
        }
        usedTranslationsByNamespace.get(namespace).add(key);
      }
    }
  } catch (error) {
    // Silently skip unreadable files
  }
}

// Scan components
console.log(`${colors.blue}${colors.bold}📁 Escaneando componentes...${colors.reset}`);
COMPONENT_DIRS.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

console.log(`${colors.green}✓ Encontradas ${usedKeys.size} keys en componentes${colors.reset}\n`);

// Find missing keys
console.log(`${colors.blue}${colors.bold}🔍 Buscando keys faltantes...${colors.reset}`);

const missingByLocale = {};
const keysToAdd = new Set();

usedKeys.forEach(key => {
  locales.forEach(locale => {
    if (!hasKey(translations[locale], key)) {
      if (!missingByLocale[locale]) {
        missingByLocale[locale] = [];
      }
      missingByLocale[locale].push(key);
      keysToAdd.add(key);
    }
  });
});

const totalMissing = Object.values(missingByLocale).reduce((sum, arr) => sum + arr.length, 0);

if (totalMissing === 0) {
  console.log(`${colors.green}${colors.bold}✨ No hay keys faltantes!${colors.reset}\n`);
  process.exit(0);
}

console.log(`\n${colors.yellow}⚠️  Keys faltantes por idioma:${colors.reset}`);
locales.forEach(locale => {
  const count = missingByLocale[locale]?.length || 0;
  console.log(`  ${locale}: ${colors.bold}${count}${colors.reset}`);
});

// Show sample of missing keys
console.log(`\n${colors.yellow}📋 Ejemplo de keys faltantes:${colors.reset}`);
const sampleKeys = Array.from(keysToAdd).slice(0, 20);
sampleKeys.forEach(key => {
  const missingIn = locales.filter(l => !hasKey(translations[l], key));
  console.log(`  ${colors.red}✗${colors.reset} ${key} ${colors.dim}(${missingIn.join(', ')})${colors.reset}`);
});

if (keysToAdd.size > 20) {
  console.log(`  ${colors.dim}... y ${keysToAdd.size - 20} más${colors.reset}`);
}

// Dry run check
if (dryRun) {
  console.log(`\n${colors.cyan}${colors.bold}🔍 MODO SIMULACIÓN - No se harán cambios${colors.reset}\n`);
  console.log(`Para aplicar los cambios, ejecuta: ${colors.yellow}node scripts/fix-translations.js${colors.reset}\n`);
  process.exit(0);
}

// Confirm changes
console.log(`\n${colors.yellow}${colors.bold}⚠️  Se agregarán ${keysToAdd.size} keys a los archivos de traducción${colors.reset}`);
console.log(`¿Deseas continuar? (s/N): `);

// For non-interactive mode, just proceed
const shouldProceed = true;

if (!shouldProceed) {
  console.log(`${colors.dim}Cancelado. No se hicieron cambios.${colors.reset}\n`);
  process.exit(0);
}

// Add missing keys to translation files
console.log(`\n${colors.blue}${colors.bold}💾 Agregando keys a archivos de traducción...${colors.reset}`);

let totalAdded = 0;

locales.forEach(locale => {
  const missingKeys = missingByLocale[locale] || [];
  if (missingKeys.length === 0) return;
  
  console.log(`\n  ${locale}.json: ${missingKeys.length} keys`);
  
  missingKeys.forEach(key => {
    const parts = key.split('.');
    let current = translations[locale];
    let path = '';
    
    // Create nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      path += part + '.';
      
      if (!current[part]) {
        current[part] = {};
      } else if (typeof current[part] !== 'object') {
        console.log(`    ${colors.yellow}⚠️  Conflicto en ${path}${colors.reset}`);
        current[part] = {};
      }
      
      current = current[part];
    }
    
    const lastPart = parts[parts.length - 1];
    
    // Only add if not exists
    if (!current[lastPart]) {
      // Use English value as fallback
      const enValue = getValue(translations['en'], key) || key;
      current[lastPart] = enValue;
      totalAdded++;
    }
  });
  
  // Save file
  const filePath = path.join(LOCALE_DIR, `${locale}.json`);
  fs.writeFileSync(filePath, JSON.stringify(translations[locale], null, 2) + '\n');
  console.log(`    ${colors.green}✓ Guardado${colors.reset}`);
});

console.log(`\n${colors.green}${colors.bold}✅ Total: ${totalAdded} keys agregadas${colors.reset}\n`);

// Helper functions
function hasKey(obj, key) {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  return true;
}

function getValue(obj, key) {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}
