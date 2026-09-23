export class OCRServiceV2 {
  private ocrServiceUrl: string;
  private apiKey: string;

  constructor() {
    this.ocrServiceUrl = process.env.OCR_MICROSERVICE_URL || 'http://localhost:8000/ocr/upload';
    this.apiKey = process.env.APP_API_KEY || '';
  }

  async extractText(fileBuffer: Buffer, fileType: string, originalFilename?: string): Promise<string> {
    try {
      // Determine file extension
      let fileName = originalFilename || `uploaded-file-${Date.now()}.pdf`;
      
      if (!fileName.includes('.')) {
        if (fileType.includes('pdf')) {
          fileName += '.pdf';
        } else if (fileType.includes('image')) {
          fileName += '.jpg';
        } else {
          fileName += '.pdf';
        }
      }
      
      // Convert Buffer to Uint8Array for web-compatible Blob
      const uint8Array = new Uint8Array(fileBuffer);
      const blob = new Blob([uint8Array], { type: fileType });
      
      // Use web-compatible FormData
      const formData = new FormData();
      formData.append('file', blob as any, fileName);

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
      console.error('OCR Service V2 Error:', error);
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
