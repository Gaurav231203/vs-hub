import { z } from 'zod';

/**
 * Multi-stage Sanitizer:
 * 1. Strips null bytes (\0, \u0000)
 * 2. Strips ANSI escape sequences (e.g. \x1b[...m)
 * 3. Strips non-printable ASCII control characters except \t, \n, \r ([\x01-\x08\x0B\x0C\x0E-\x1F\x7F])
 * 4. Strips invisible zero-width unicode characters ([\u200B-\u200D\uFEFF])
 * 5. HTML Entity Encodes (&, <, >, ", ', /) to prevent Stored XSS
 * Preserves standard whitespace, emojis, and international Unicode text.
 */
export function sanitizeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    // 1. Strip null-bytes
    .replace(/\0|\u0000/g, '')
    // 2. Strip ANSI escape sequences
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    // 3. Strip non-printable ASCII control characters (keeping \t, \n, \r)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 4. Strip invisible zero-width characters (BOM, ZWSP, ZWNJ, ZWJ)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // 5. HTML Entity Encoding
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export const clientApproveSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000, 'Note cannot exceed 1000 characters')
    .optional()
    .transform((val) => (val ? sanitizeHtml(val) : undefined)),
});

export const clientRequestChangesSchema = z.object({
  note: z
    .string({ required_error: 'Please provide feedback explaining requested changes' })
    .trim()
    .min(3, 'Feedback must be at least 3 characters long')
    .max(1000, 'Feedback cannot exceed 1000 characters')
    .transform((val) => sanitizeHtml(val)),
});
