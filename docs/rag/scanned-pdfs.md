# RAG: Manejo de PDFs Escaneados (Sin Texto Extraíble)

## Problema Identificado

Tu archivo `document_taxo_lyon.pdf` **no contiene texto extraíble**. Los logs muestran:

```
[RAG extract] ⚠️ PDF has no extractable text
diagnosis: 'PDF probablemente es escaneado (solo imágenes) o está protegido. Necesita OCR para indexar.'
```

## ¿Qué es un PDF Escaneado?

Un PDF puede contener:

### PDF con Texto (✅ Indexable)
- Creado digitalmente (Word → PDF, Export PDF, etc.)
- Contiene capa de texto seleccionable
- **Se puede indexar directamente** en el RAG

### PDF Escaneado (❌ No Indexable)
- Creado desde scanner o cámara
- Solo contiene imágenes de páginas
- Texto NO es seleccionable
- **Requiere OCR para indexar**

## Cómo Verificar si tu PDF es Escaneado

### Método 1: Seleccionar Texto
1. Abre el PDF en un visor (Adobe, Chrome, etc.)
2. Intenta seleccionar texto con el cursor
3. **Si NO puedes seleccionar texto** → Es escaneado

### Método 2: Ver Tamaño de Archivo
- PDF escaneado: ~500KB - 5MB por página
- PDF con texto: ~50KB - 200KB por página

### Método 3: Ver los Logs
```
pages: 5
sizeKB: 89
diagnosis: 'PDF probablemente es escaneado (solo imágenes)'
```

## Soluciones

### Opción 1: Aplicar OCR al PDF (Recomendado)

**Herramientas Gratuitas:**

1. **Adobe Acrobat Reader DC**
   - Abrir PDF → Tools → Recognize Text → In This File
   - Guardar el PDF con OCR
   - Subir nuevamente al RAG

2. **Google Drive**
   - Subir PDF a Google Drive
   - Click derecho → Abrir con Google Docs
   - Descargar como PDF
   - Resultado: PDF con texto extraíble

3. **OCRmyPDF (Linux/Mac/Docker)**
   ```bash
   # Instalar
   pip install ocrmypdf
   
   # Procesar PDF
   ocrmypdf input.pdf output.pdf
   ```

4. **Microsoft OneDrive**
   - Subir PDF a OneDrive
   - Click derecho → "Extract text from image"
   - Copiar texto a un documento Word
   - Guardar como PDF

### Opción 2: Extraer Texto Manualmente

Si el PDF es corto:
1. Usar herramienta OCR online (Soda PDF, PDFCandy)
2. Copiar texto extraído
3. Crear un archivo `.txt` con el contenido
4. Subir el `.txt` al RAG

### Opción 3: Implementar OCR Automático (Futuro)

El sistema RAG podría integrarse con:
- **Tesseract OCR** (open source)
- **Azure Computer Vision**
- **Google Cloud Vision API**
- **AWS Textract**

## Estado Actual del Sistema

### ✅ Funciona con:
- PDFs creados digitalmente
- Archivos Word (.docx)
- Archivos de texto (.txt, .md, .csv, etc.)
- HTML, XML, JSON

### ❌ No funciona con:
- PDFs escaneados (solo imágenes)
- Imágenes (JPG, PNG)
- PDFs protegidos con restricciones de extracción
- PDFs corruptos

### 📊 Diagnóstico Automático:
El sistema ahora detecta automáticamente PDFs sin texto y muestra:
```
PDF no contiene texto extraíble. Puede ser un archivo escaneado (solo imágenes) 
o protegido. Se requiere OCR para indexar este tipo de archivos.
```

## Cómo Procesar tu PDF

### Para `document_taxo_lyon.pdf`:

**Paso 1: Verificar**
```bash
# Abrir en visor PDF e intentar seleccionar texto
```

**Paso 2: Aplicar OCR**
Método más rápido (Google Drive):
1. Subir a Google Drive
2. Click derecho → Abrir con Google Docs
3. File → Download → PDF Document
4. Resultado: `document_taxo_lyon_ocr.pdf`

**Paso 3: Subir al RAG**
- Subir el nuevo PDF con OCR
- Debería indexarse correctamente

**Paso 4: Verificar**
```bash
node scripts/check-documents.js
```

Deberías ver:
```
✅ document_taxo_lyon_ocr.pdf
   Chunks: 45
   Type: application/pdf
```

## Logging Mejorado

Con los cambios implementados, ahora ves:

### Antes:
```
❌ Failed: No se pudo extraer texto legible del documento
```

### Después:
```
[RAG extract] ⚠️ PDF has no extractable text {
  filename: 'document_taxo_lyon.pdf',
  pages: 5,
  sizeKB: 89,
  diagnosis: 'PDF probablemente es escaneado (solo imágenes) o está protegido. Necesita OCR para indexar.'
}
[RAG Upload] ❌ No extractable text found {
  filename: 'document_taxo_lyon.pdf',
  isPDF: true
}
❌ Failed: PDF no contiene texto extraíble. Puede ser un archivo escaneado (solo imágenes) 
           o protegido. Se requiere OCR para indexar este tipo de archivos.
```

Mucho más claro sobre el problema y la solución ✅

## Preguntas Frecuentes

**P: ¿Por qué el sistema no hace OCR automáticamente?**
R: OCR requiere recursos computacionales significativos y puede ser costoso en APIs cloud. Es mejor que el usuario prepare los documentos antes.

**P: ¿Puedo subir el PDF escaneado de todas formas?**
R: Sí, pero no será indexado. Solo se guardará como metadata sin capacidad de búsqueda.

**P: ¿El OCR es perfecto?**
R: No. La calidad depende de:
- Resolución del scan
- Calidad del texto original
- Idioma del documento
- Herramienta OCR usada

Recomendación: Verificar el texto extraído antes de confiar en él completamente.

**P: ¿Qué pasa si mi PDF es muy grande?**
R: El sistema tiene límite de 25MB por archivo. PDFs escaneados con muchas páginas pueden exceder este límite. Considera:
- Dividir en PDFs más pequeños
- Reducir calidad de escaneo (150 DPI es suficiente para OCR)
- Convertir imágenes a B&N antes de escanear

## Resumen

1. ✅ **Sistema actualizado** con diagnóstico claro
2. ✅ **Logs detallados** muestran por qué falla
3. ✅ **Mensajes informativos** guían al usuario
4. ⚠️ **PDF escaneado detectado** en `document_taxo_lyon.pdf`
5. 🔧 **Solución**: Aplicar OCR antes de subir

**Próximo paso:** Procesa tu PDF con OCR y súbelo nuevamente. El sistema lo indexará correctamente.
