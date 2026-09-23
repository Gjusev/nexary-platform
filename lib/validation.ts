import { z } from 'zod';

// Contact form validation schema
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
  company: z
    .string()
    .max(100, 'Company name must not exceed 100 characters')
    .trim()
    .optional(),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must not exceed 200 characters')
    .trim(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must not exceed 2000 characters')
    .trim(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export class ValidationService {
   static isValidFileType(fileType: string): boolean {
     const allowedTypes = [
       'application/pdf',
       'image/jpeg',
       'image/jpg',
       'image/png',
       'image/gif',
       'image/webp'
     ];
     return allowedTypes.includes(fileType.toLowerCase());
   }

   static isValidFileSize(fileSize: number): boolean {
     const maxSize = 10 * 1024 * 1024; // 10MB
     return fileSize <= maxSize;
   }

   static sanitizeFileName(fileName: string): string {
     // Remove path traversal attempts and special characters
     return fileName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);
   }

   static sanitizeText(text: string): string {
     // Basic sanitization - remove null bytes and control characters
     return text
       .replace(/\u0000/g, '')
       .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
       .trim();
   }
 }
