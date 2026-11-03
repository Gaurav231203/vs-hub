import { sanitizeHtml, clientRequestChangesSchema } from '../src/lib/sanitize.js';

async function runTest() {
  console.log('--- [TDD TEST 4] Null-Byte & Control Character Sanitization ---');

  // Test Case 1: Null-Byte Injection
  const nullBytePayload = 'Approve\0Delete*Everything\u0000Evil';
  const cleanNull = sanitizeHtml(nullBytePayload);
  console.log('Null-byte test result:', cleanNull);
  if (cleanNull.includes('\0') || cleanNull.includes('\u0000')) {
    throw new Error('FAIL: sanitizeHtml did not strip null bytes!');
  }

  // Test Case 2: Zero-Width Characters (BOM, ZWSP, ZWNJ, ZWJ)
  const zeroWidthPayload = 'Safe\u200B\u200C\u200D\uFEFFText';
  const cleanZero = sanitizeHtml(zeroWidthPayload);
  console.log('Zero-width test result:', cleanZero);
  if (
    cleanZero.includes('\u200B') ||
    cleanZero.includes('\u200C') ||
    cleanZero.includes('\u200D') ||
    cleanZero.includes('\uFEFF')
  ) {
    throw new Error('FAIL: sanitizeHtml did not strip zero-width characters!');
  }

  // Test Case 3: Dangerous ASCII Control Characters (Bell, Backspace, Escape)
  const controlPayload = 'Line1\x07\x08\x1b[31;1mRedText\x1b[0m\r\nLine2';
  const cleanControl = sanitizeHtml(controlPayload);
  console.log('Control characters test result:', cleanControl);
  if (cleanControl.includes('\x07') || cleanControl.includes('\x08') || cleanControl.includes('\x1b')) {
    throw new Error('FAIL: sanitizeHtml did not strip dangerous control characters!');
  }

  // Test Case 4: Schema validation through Zod
  const schemaResult = clientRequestChangesSchema.safeParse({
    note: 'Approved\0<script>alert(1)</script>\u200B\u0000Evil',
  });
  if (!schemaResult.success) {
    throw new Error('FAIL: Schema rejected payload instead of transforming it!');
  }
  const schemaNote = schemaResult.data.note;
  if (schemaNote.includes('\0') || schemaNote.includes('<script>') || schemaNote.includes('\u200B')) {
    throw new Error('FAIL: clientRequestChangesSchema output contains unstripped null-byte or unescaped script tag!');
  }

  // Test Case 5: Legitimate content (emojis, line breaks, international text) must be PRESERVED
  const validPayload = 'Hello world! 🔥\r\nLine 2 with Café & "Quotes"';
  const cleanValid = sanitizeHtml(validPayload);
  console.log('Valid payload test result:', cleanValid);
  if (!cleanValid.includes('🔥') || !cleanValid.includes('Café') || !cleanValid.includes('Line 2')) {
    throw new Error('FAIL: Valid text or emojis were corrupted during sanitization!');
  }

  console.log('✅ TDD TEST 4 PASSED: All null-bytes and control characters cleanly stripped while preserving legitimate content.');
}

runTest().catch((err) => {
  console.error('❌ TDD TEST 4 FAILED:', err.message);
  process.exit(1);
});
