const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function checkDocuments() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos\n');
    
    const packageId = '8eba2be4-0656-4cc4-860d-d24b52ee69e3';
    
    // Verificar documentos en el paquete
    const result = await client.query(
      `SELECT id, filename, size, chunk_count, content_type, uploaded_at 
       FROM projectnexus.rag_documents 
       WHERE package_id = $1 
       ORDER BY uploaded_at DESC 
       LIMIT 10`,
      [packageId]
    );
    
    console.log(`📁 Documentos en el paquete (Total: ${result.rows.length}):\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No hay documentos en este paquete');
    } else {
      result.rows.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.filename}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Size: ${doc.size} bytes`);
        console.log(`   Chunks: ${doc.chunk_count}`);
        console.log(`   Type: ${doc.content_type}`);
        console.log(`   Uploaded: ${doc.uploaded_at}`);
        console.log('');
      });
    }
    
    // Buscar específicamente document_taxo_lyon.pdf
    const taxoDoc = await client.query(
      `SELECT * FROM projectnexus.rag_documents WHERE filename LIKE '%taxo_lyon%'`,
    );
    
    if (taxoDoc.rows.length > 0) {
      console.log('\n🔍 Documento "document_taxo_lyon.pdf" encontrado:\n');
      console.log(JSON.stringify(taxoDoc.rows[0], null, 2));
    } else {
      console.log('\n❌ Documento "document_taxo_lyon.pdf" NO encontrado en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDocuments();
