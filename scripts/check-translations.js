#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const fix = args.includes('--fix');
const format = args.find(arg => arg.startsWith('--format'))?.split('=')[1] || 'text';

console.log(`${colors.cyan}${colors.bold}📊 VALIDACIÓN DE TRADUCCIONES - NEXARY${colors.reset}`);
console.log('='.repeat(70) + '\n');

// Configuration
const LOCALE_DIR = path.join(__dirname, '../messages');
const COMPONENT_DIRS = ['app', 'components', 'lib', 'hooks'];
const FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.test.',
  '.spec.',
  '__tests__',
  'coverage',
];

// Step 1: Extract all translation keys from components
console.log(`${colors.blue}${colors.bold}1️⃣  Buscando keys usadas en componentes...${colors.reset}`);

const usedKeys = new Set();
const keysWithLocation = new Map(); // Store file locations for fix mode

function scanDirectory(dir, depth = 0) {
  if (depth > 10) return; // Prevent infinite recursion
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    // Skip ignored patterns
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
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Pattern 1: t('key')
    const simpleMatches = content.match(/t\(['"`](.+?)['"`]\)/g) || [];
    simpleMatches.forEach(match => {
      const keyMatch = match.match(/['"`](.+?)['"`]/);
      if (keyMatch) {
        const key = keyMatch[1];
        usedKeys.add(key);
        addKeyLocation(key, relativePath);
      }
    });
    
    // Pattern 2: t('key', { ... })
    const paramMatches = content.match(/t\(['"`](.+?)['"`]\s*,\s*\{.+?\}/g) || [];
    paramMatches.forEach(match => {
      const keyMatch = match.match(/['"`](.+?)['"`]/);
      if (keyMatch) {
        const key = keyMatch[1];
        usedKeys.add(key);
        addKeyLocation(key, relativePath);
      }
    });
    
    // Pattern 4: useTranslations('namespace') - extract namespace
    const nsMatches = content.match(/useTranslations\(['"`]([^'"`]+)['"`]\)/g) || [];
    // Namespaces are already handled in the file, so we don't need to add them separately
    
  } catch (error) {
    if (verbose) {
      console.log(`${colors.yellow}⚠️  No se pudo leer: ${filePath}${colors.reset}`);
    }
  }
}

function addKeyLocation(key, filePath) {
  if (!keysWithLocation.has(key)) {
    keysWithLocation.set(key, new Set());
  }
  keysWithLocation.get(key).add(filePath);
}

COMPONENT_DIRS.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    scanDirectory(fullPath);
  }
});

console.log(`${colors.green}✓ Keys únicas encontradas en componentes: ${usedKeys.size}${colors.reset}\n`);

// Step 2: Load translation files
console.log(`${colors.blue}${colors.bold}2️⃣  Cargando archivos de traducción...${colors.reset}`);

const translationFiles = ['en', 'es', 'de'];
const translations = {};

translationFiles.forEach(locale => {
  const filePath = path.join(LOCALE_DIR, `${locale}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    translations[locale] = JSON.parse(content);
    const keyCount = countKeys(translations[locale]);
    console.log(`${colors.green}✓ ${locale}.json: ${keyCount} keys${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}✗ Error cargando ${locale}.json: ${error.message}${colors.reset}`);
    translations[locale] = {};
  }
});
console.log('');

// Step 3: Flatten all keys from translation files
console.log(`${colors.blue}${colors.bold}3️⃣  Analizando estructuras de traducción...${colors.reset}`);

const allTranslationKeys = {};
translationFiles.forEach(locale => {
  allTranslationKeys[locale] = new Set();
  flattenKeys(translations[locale], '', allTranslationKeys[locale]);
});

// Step 4: Find issues
console.log(`${colors.blue}${colors.bold}4️⃣  Buscando problemas...${colors.reset}\n`);

const issues = {
  missing: new Map(), // key -> missing in locales
  untranslated: new Map(), // key -> not translated locales
  unused: new Map(), // key -> locale
};

// 4.1 Find missing keys (used in components but not in translation files)
console.log(`${colors.yellow}4.1 Buscando keys faltantes...${colors.reset}`);
usedKeys.forEach(key => {
  const missingIn = [];
  translationFiles.forEach(locale => {
    if (!allTranslationKeys[locale].has(key)) {
      missingIn.push(locale);
    }
  });
  if (missingIn.length > 0) {
    issues.missing.set(key, missingIn);
  }
});

// 4.2 Find untranslated keys (exists in all 3 locales but same value)
console.log(`${colors.yellow}4.2 Buscando keys no traducidas...${colors.reset}`);
findUntranslatedKeys(allTranslationKeys, issues.untranslated);

// 4.3 Find unused keys (in translation files but not used in components)
console.log(`${colors.yellow}4.3 Buscando keys sin usar...${colors.reset}`);
translationFiles.forEach(locale => {
  allTranslationKeys[locale].forEach(key => {
    if (!usedKeys.has(key)) {
      if (!issues.unused.has(key)) {
        issues.unused.set(key, []);
      }
      issues.unused.get(key).push(locale);
    }
  });
});

// Step 5: Generate report
console.log('');
console.log(`${colors.cyan}${colors.bold}📊 RESUMEN DE VALIDACIÓN${colors.reset}`);
console.log('='.repeat(70));

const totalUsed = usedKeys.size;
const totalEN = allTranslationKeys['en'].size;
const totalES = allTranslationKeys['es'].size;
const totalDE = allTranslationKeys['de'].size;

console.log(`\nTotal Keys Únicas Encontradas: ${colors.bold}${totalUsed}${colors.reset}`);
console.log(`Total Keys en en.json: ${colors.bold}${totalEN}${colors.reset}`);
console.log(`Total Keys en es.json: ${colors.bold}${totalES}${colors.reset}`);
console.log(`Total Keys en de.json: ${colors.bold}${totalDE}${colors.reset}`);

const totalIssues = issues.missing.size + issues.untranslated.size + issues.unused.size;
console.log(`\n${totalIssues > 0 ? colors.red + colors.bold : colors.green + colors.bold}⚠️  ERRORES ENCONTRADOS: ${totalIssues}${colors.reset}`);
console.log('─'.repeat(70));

if (totalIssues === 0) {
  console.log(`${colors.green}${colors.bold}✨ ¡Todas las traducciones están completas!${colors.reset}\n`);
  process.exit(0);
}

// 4.1 Missing Keys
if (issues.missing.size > 0) {
  console.log(`\n${colors.red}${colors.bold}1. KEYS FALTANTES (${issues.missing.size} total)${colors.reset}`);
  console.log(`${colors.red}   Keys usadas en componentes pero NO existen en algún idioma${colors.reset}\n`);
  
  const missingByCategory = groupKeysByNamespace([...issues.missing.keys()]);
  missingByCategory.forEach((keys, category) => {
    console.log(`${colors.yellow}📁 ${category || 'Root'}:${colors.reset}`);
    keys.slice(0, 10).forEach(key => {
      const missingIn = issues.missing.get(key);
      console.log(`   ${colors.red}✗${colors.reset} ${key}`);
      console.log(`      ${colors.cyan}Falta en: ${missingIn.join(', ')}${colors.reset}`);
      if (fix && keysWithLocation.has(key)) {
        const locations = [...keysWithLocation.get(key)].slice(0, 2);
        locations.forEach(loc => {
          console.log(`      ${colors.dim}→ ${loc}${colors.reset}`);
        });
      }
      if (keys.length > 10) {
        console.log(`   ${colors.dim}... y ${keys.length - 10} más${colors.reset}`);
      }
    });
  });
}

// 4.2 Untranslated Keys
if (issues.untranslated.size > 0) {
  console.log(`\n${colors.yellow}${colors.bold}2. KEYS NO TRADUCIDAS (${issues.untranslated.size} total)${colors.reset}`);
  console.log(`${colors.yellow}   Keys que existen en los 3 idiomas pero tienen el mismo texto${colors.reset}\n`);
  
  const untranslatedByCategory = groupKeysByNamespace([...issues.untranslated.keys()]);
  untranslatedByCategory.forEach((keys, category) => {
    console.log(`${colors.yellow}📁 ${category || 'Root'}:${colors.reset}`);
    keys.slice(0, 10).forEach(key => {
      console.log(`   ${colors.yellow}⚠️${colors.reset} ${key}`);
      const details = issues.untranslated.get(key);
      console.log(`      ${colors.cyan}Motivo: ${details.reason}${colors.reset}`);
    });
    if (keys.length > 10) {
      console.log(`   ${colors.dim}... y ${keys.length - 10} más${colors.reset}`);
    }
  });
}

// 4.3 Unused Keys
if (issues.unused.size > 0) {
  console.log(`\n${colors.magenta}${colors.bold}3. KEYS SIN USAR (${issues.unused.size} total)${colors.reset}`);
  console.log(`${colors.magenta}   Keys definidas en JSON pero no usadas en ningún componente${colors.reset}\n`);
  
  const unusedByCategory = groupKeysByNamespace([...issues.unused.keys()]);
  unusedByCategory.forEach((keys, category) => {
    console.log(`${colors.yellow}📁 ${category || 'Root'}:${colors.reset}`);
    keys.slice(0, 10).forEach(key => {
      const inLocales = issues.unused.get(key);
      console.log(`   ${colors.magenta}⊘${colors.reset} ${key} ${colors.dim}(${inLocales.join(', ')})${colors.reset}`);
    });
    if (keys.length > 10) {
      console.log(`   ${colors.dim}... y ${keys.length - 10} más${colors.reset}`);
    }
  });
}

// Summary by category
console.log(`\n${colors.cyan}${colors.bold}📋 DETALLES POR CATEGORÍA${colors.reset}`);
console.log('='.repeat(70));

const allCategories = new Set();
issues.missing.forEach((_, key) => allCategories.add(key.split('.')[0]));
issues.untranslated.forEach((_, key) => allCategories.add(key.split('.')[0]));
issues.unused.forEach((_, key) => allCategories.add(key.split('.')[0]));

allCategories.forEach(category => {
  if (category === '') return;
  
  const missingInCategory = [...issues.missing.keys()].filter(k => k.startsWith(category + '.')).length;
  const untranslatedInCategory = [...issues.untranslated.keys()].filter(k => k.startsWith(category + '.')).length;
  const unusedInCategory = [...issues.unused.keys()].filter(k => k.startsWith(category + '.')).length;
  
  if (missingInCategory + untranslatedInCategory + unusedInCategory > 0) {
    console.log(`\n${colors.bold}${category}:${colors.reset}`);
    console.log(`   ${colors.red}Faltantes: ${missingInCategory}${colors.reset}`);
    console.log(`   ${colors.yellow}No traducidas: ${untranslatedInCategory}${colors.reset}`);
    console.log(`   ${colors.magenta}Sin usar: ${unusedInCategory}${colors.reset}`);
  }
});

console.log(`\n${colors.cyan}${colors.bold}💡 RECOMENDACIONES${colors.reset}`);
console.log('─'.repeat(70));
if (issues.missing.size > 0) {
  console.log('1. Agregue las keys faltantes a todos los idiomas en messages/');
}
if (issues.untranslated.size > 0) {
  console.log('2. Traduzca las keys que tienen el mismo texto en inglés/español/alemán');
}
if (issues.unused.size > 0) {
  console.log('3. Elimine o use las keys que no se utilizan en los componentes');
}

if (fix) {
  console.log(`\n${colors.cyan}${colors.bold}📍 DETALLES DE UBICACIÓN${colors.reset}`);
  console.log('Para más detalles sobre dónde se usan las keys, usa --verbose');
}

// Helper functions
function flattenKeys(obj, prefix, result) {
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      flattenKeys(obj[key], fullKey, result);
    } else {
      result.add(fullKey);
    }
  }
}

function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

function findUntranslatedKeys(allKeys, result) {
  // For each key that exists in all 3 languages
  allKeys['en'].forEach(key => {
    if (allKeys['es'].has(key) && allKeys['de'].has(key)) {
      const enValue = getValue(translations['en'], key);
      const esValue = getValue(translations['es'], key);
      const deValue = getValue(translations['de'], key);
      
      // Check if any two languages have the same value
      if (enValue === esValue || enValue === deValue || esValue === deValue) {
        const issues = [];
        if (enValue === esValue) issues.push('español = inglés');
        if (enValue === deValue) issues.push('alemán = inglés');
        if (esValue === deValue) issues.push('alemán = español');
        
        result.set(key, { reason: issues.join(', ') });
      }
    }
  });
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

function groupKeysByNamespace(keys) {
  const grouped = new Map();
  keys.forEach(key => {
    const namespace = key.includes('.') ? key.split('.')[0] : 'root';
    if (!grouped.has(namespace)) {
      grouped.set(namespace, []);
    }
    grouped.get(namespace).push(key);
  });
  return grouped;
}

// Verbose output option
if (verbose) {
  console.log(`\n${colors.cyan}${colors.bold}📄 SALIDA DETALLADA (VERBOSE)${colors.reset}`);
  console.log('─'.repeat(70));
  
  if (issues.missing.size > 0) {
    console.log('\n' + colors.red + 'KEYS FALTANTES DETALLADAS:' + colors.reset);
    issues.missing.forEach((missingIn, key) => {
      console.log(`\n${colors.bold}${key}${colors.reset}`);
      console.log(`  Faltante en: ${missingIn.join(', ')}`);
      if (keysWithLocation.has(key)) {
        console.log(`  Usado en:`);
        keysWithLocation.get(key).forEach(loc => {
          console.log(`    - ${loc}`);
        });
      }
    });
  }
}

// Exit with error code if issues found
process.exit(totalIssues > 0 ? 1 : 0);
