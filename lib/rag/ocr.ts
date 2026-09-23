export class OCRService {
  private ocrServiceUrl: string;
  private apiKey: string;

  constructor() {
    this.ocrServiceUrl = process.env.OCR_MICROSERVICE_URL || 'http://localhost:8000/ocr/upload';
    this.apiKey = process.env.APP_API_KEY || '';
  }

  async extractText(fileBuffer: Buffer, fileType: string, originalFilename?: string): Promise<string> {
    try {
      // Determine file extension from type or use original filename
      let fileName = originalFilename || `uploaded-file-${Date.now()}.pdf`;
      
      // Ensure filename has an extension
      if (!fileName.includes('.')) {
        if (fileType.includes('pdf')) {
          fileName += '.pdf';
        } else if (fileType.includes('image')) {
          fileName += '.jpg';
        } else {
          fileName += '.pdf'; // Default to PDF
        }
      }
      
      // Use web-standard FormData, Blob, and File (NOT Node.js form-data package)
      const formData = new FormData();
      
      // Create a Blob from the buffer (cast to any to avoid TypeScript Buffer/Blob incompatibility)
      const blob = new Blob([fileBuffer as any], { type: fileType });
      
      // Create a File object from the Blob (this is what the OCR service expects)
      const file = new File([blob], fileName, { type: fileType });
      
      formData.append('file', file);

      const headers: HeadersInit = {};
      
      // Add API key if configured
      if (this.apiKey) {
        headers['X-API-KEY'] = this.apiKey;
      }

      const response = await fetch(this.ocrServiceUrl, {
        method: 'POST',
        body: formData,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('OCR Microservice Error Response:', errorData);
        throw new Error(`OCR service error: ${response.status} - ${errorData.detail || response.statusText}`);
      }

      const result = await response.json();
      if (!result.text) {
        throw new Error('No text extracted from the document');
      }

      return result.text;
    } catch (error) {
      console.error('OCR Service Error:', error);
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
