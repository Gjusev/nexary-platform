// Script para verificar las credenciales de Stack Auth
const https = require('https');

const projectId = '314f18d9-337e-4f4d-90f2-8a60f089257f';
const publishableKey = 'pck_gp3k6957d3353kyrcwekpmxgf178m0qjk2v5djfwkq2q8';
const apiUrl = 'sa-api.mokka-dev.de';

console.log('🔍 Verificando credenciales de Stack Auth...\n');
console.log('Project ID:', projectId);
console.log('Publishable Key:', publishableKey);
console.log('API URL:', apiUrl);
console.log('\n---\n');

// Intentar obtener la configuración del proyecto
const options = {
  hostname: apiUrl,
  path: `/api/v1/projects/${projectId}`,
  method: 'GET',
  headers: {
    'x-stack-publishable-client-key': publishableKey,
  },
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nRespuesta:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ Las credenciales son válidas');
      } else {
        console.log('\n❌ Las credenciales son inválidas o el proyecto no existe');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
});

req.end();
