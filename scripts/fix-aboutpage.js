#!/usr/bin/env node

const fs = require('fs');

const locales = ['en', 'es', 'de'];

console.log('🔧 Corrigiendo duplicación de aboutPage...\n');

locales.forEach(locale => {
  const filePath = `messages/${locale}.json`;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (data.aboutPage) {
    // Ensure landing object exists
    data.landing = data.landing || {};
    
    // Copy aboutPage to landing.aboutPage
    data.landing.aboutPage = JSON.parse(JSON.stringify(data.aboutPage));
    
    // Delete the old aboutPage
    delete data.aboutPage;
    
    // Save file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ ${locale}.json: aboutPage movido a landing.aboutPage`);
  } else {
    console.log(`- ${locale}.json: no tiene aboutPage`);
  }
});

console.log('\n✅ Corrección completada');
