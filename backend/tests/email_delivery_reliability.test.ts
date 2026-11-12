import assert from 'node:assert/strict';
import { cleanEnvString } from '../src/config/env.js';
import { parseFromAddress, EmailService } from '../src/lib/email.js';
import { BrandsService } from '../src/modules/brands/brands.service.js';
import { prisma } from '../src/lib/prisma.js';

async function runTests() {
  console.log('================================================================');
  console.log('📧 RUNNING EMAIL DELIVERY RELIABILITY & REGRESSION TEST SUITE');
  console.log('================================================================\n');

  // 1. Env quote stripping
  console.log('👉 [Test 1] cleanEnvString handles accidental quotes & whitespace');
  assert.equal(cleanEnvString('  "xkeysib-abc"  '), 'xkeysib-abc');
  assert.equal(cleanEnvString("'VS Adda <test@gmail.com>'"), 'VS Adda <test@gmail.com>');
  assert.equal(cleanEnvString('""'), undefined);
  assert.equal(cleanEnvString('   '), undefined);
  console.log('   ✅ PASS\n');

  // 2. From-address parsing
  console.log('👉 [Test 2] parseFromAddress parses quoted & unquoted sender formats');
  assert.deepEqual(parseFromAddress('VS Adda <washingtonjosh770@gmail.com>'), {
    name: 'VS Adda',
    email: 'washingtonjosh770@gmail.com',
  });
  assert.deepEqual(parseFromAddress('"VS Adda <washingtonjosh770@gmail.com>"'), {
    name: 'VS Adda',
    email: 'washingtonjosh770@gmail.com',
  });
  assert.deepEqual(parseFromAddress('"washingtonjosh770@gmail.com"'), {
    name: 'VS Adda',
    email: 'washingtonjosh770@gmail.com',
  });
  console.log('   ✅ PASS\n');

  // Save original fetch & env
  const origFetch = globalThis.fetch;
  const origEnv = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    // 3. Quoted BREVO_API_KEY & EMAIL_FROM stripped automatically before calling Brevo API
    console.log('👉 [Test 3] Quoted BREVO_API_KEY and EMAIL_FROM succeed cleanly');
    process.env.BREVO_API_KEY = '"xkeysib-test-quoted-key"';
    process.env.EMAIL_FROM = '"VS Adda <verified@agency.com>"';
    process.env.NODE_ENV = 'production';

    let capturedHeaders: any = null;
    let capturedBody: any = null;
    globalThis.fetch = (async (url: any, init: any) => {
      if (String(url).includes('/v3/smtp/email')) {
        capturedHeaders = init.headers;
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ messageId: '<msg-123>' }), { status: 201 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    const res3 = await EmailService.sendConnectInvite({
      toEmail: 'client@brand.com',
      clientName: 'Client',
      brandName: 'Sahil Brand',
      agencyName: 'VS Adda',
      inviteUrl: 'https://vs-hub-ruddy.vercel.app/connect/tok',
    });

    assert.equal(res3.sent, true);
    assert.equal(res3.provider, 'brevo_api');
    assert.equal(res3.from, 'verified@agency.com');
    assert.equal(capturedHeaders['api-key'], 'xkeysib-test-quoted-key');
    assert.equal(capturedBody.sender.email, 'verified@agency.com');
    console.log('   ✅ PASS\n');

    // 4. Unverified sender self-heals via Brevo /v3/senders
    console.log('👉 [Test 4] Rejected unverified sender auto-heals via GET /v3/senders');
    process.env.EMAIL_FROM = 'bad-sender@unverified.com';
    let sendCalls = 0;
    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url);
      if (u.includes('/v3/senders')) {
        return new Response(
          JSON.stringify({
            senders: [{ id: 1, name: 'Vibe Soft', email: 'washingtonjosh770@gmail.com', active: true }],
          }),
          { status: 200 }
        );
      }
      if (u.includes('/v3/smtp/email')) {
        sendCalls++;
        const payload = JSON.parse(init.body);
        if (payload.sender.email === 'bad-sender@unverified.com') {
          return new Response(JSON.stringify({ code: 'invalid_parameter', message: 'valid sender required' }), {
            status: 400,
          });
        }
        return new Response(JSON.stringify({ messageId: '<healed-456>' }), { status: 201 });
      }
      throw new Error(`Unexpected URL: ${u}`);
    }) as any;

    const res4 = await EmailService.sendConnectInvite({
      toEmail: 'client@brand.com',
      clientName: 'Client',
      brandName: 'Sahil Brand',
      agencyName: 'VS Adda',
      inviteUrl: 'https://vs-hub-ruddy.vercel.app/connect/tok',
    });

    assert.equal(sendCalls, 2);
    assert.equal(res4.sent, true);
    assert.equal(res4.from, 'washingtonjosh770@gmail.com');
    assert.equal(res4.messageId, '<healed-456>');
    console.log('   ✅ PASS\n');

    // 5. Never silently pretend Mock success in production when Brevo returns 401
    console.log('👉 [Test 5] Unauthorized Brevo API returns { sent: false, error } in production');
    process.env.BREVO_API_KEY = 'xkeysib-invalid';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 });
    }) as any;

    const res5 = await EmailService.sendConnectInvite({
      toEmail: 'client@brand.com',
      clientName: 'Client',
      brandName: 'Sahil Brand',
      agencyName: 'VS Adda',
      inviteUrl: 'https://vs-hub-ruddy.vercel.app/connect/tok',
    });

    assert.equal(res5.sent, false);
    assert.equal(res5.provider, 'none');
    assert.ok(res5.error?.includes('401'), `Expected 401 error, got: ${res5.error}`);
    console.log('   ✅ PASS\n');

    // 6. Verify BrandsService.createBrand calls sendConnectInvite and propagates emailDelivery (mocked prisma)
    console.log('👉 [Test 6] BrandsService.createBrand dispatches invite email & returns emailDelivery');
    process.env.BREVO_API_KEY = 'xkeysib-valid';
    process.env.EMAIL_FROM = 'washingtonjosh770@gmail.com';
    let createBrandEmailSentTo = '';
    globalThis.fetch = (async (url: any, init: any) => {
      if (String(url).includes('/v3/smtp/email')) {
        const body = JSON.parse(init.body);
        createBrandEmailSentTo = body.to[0].email;
        return new Response(JSON.stringify({ messageId: '<brand-msg-789>' }), { status: 201 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as any;

    const origWorkspaceFind = prisma.workspace.findUnique;
    const origBrandCreate = prisma.brand.create;
    const origBrandUpdate = prisma.brand.update;
    const origContactCreate = prisma.brandContact.create;
    const origInviteCreate = prisma.connectInvite.create;

    (prisma.workspace as any).findUnique = async () => ({ id: 'ws_1', name: 'VS Adda Agency' });
    (prisma.brand as any).create = async (args: any) => ({ id: 'br_1', ...args.data });
    (prisma.brandContact as any).create = async (args: any) => ({ id: 'ct_1', ...args.data });
    (prisma.connectInvite as any).create = async (args: any) => ({ id: 'inv_1', ...args.data });
    (prisma.brand as any).update = async (args: any) => ({
      id: 'br_1',
      name: 'Client Test Brand',
      status: args.data.status,
      contacts: [{ id: 'ct_1', name: 'Sahil', email: 'client@example.com' }],
    });

    try {
      const created = await BrandsService.createBrand(
        'ws_1',
        'usr_1',
        {
          name: 'Client Test Brand',
          clientContactName: 'Sahil',
          clientContactEmail: 'Client@Example.com',
          timezone: 'Asia/Kolkata',
        },
        'https://vs-hub-ruddy.vercel.app'
      );

      assert.equal(createBrandEmailSentTo, 'client@example.com');
      assert.equal(created.emailDelivery.sent, true);
      assert.equal(created.emailDelivery.provider, 'brevo_api');
      assert.equal(created.emailDelivery.messageId, '<brand-msg-789>');
      console.log('   ✅ PASS\n');
    } finally {
      (prisma.workspace as any).findUnique = origWorkspaceFind;
      (prisma.brand as any).create = origBrandCreate;
      (prisma.brand as any).update = origBrandUpdate;
      (prisma.brandContact as any).create = origContactCreate;
      (prisma.connectInvite as any).create = origInviteCreate;
    }

    console.log('🎉 ALL EMAIL DELIVERY RELIABILITY TESTS PASSED!\n');
  } finally {
    globalThis.fetch = origFetch;
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
