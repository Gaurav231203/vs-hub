import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { hashToken } from '../src/lib/crypto.js';
import { channelsRouter } from '../src/modules/channels/channels.routes.js';
import { invitesRouter } from '../src/modules/invites/invites.routes.js';

console.log('================================================================');
console.log('🔒 RUNNING OAUTH-ONLY CHANNEL CONNECTION REGRESSION SUITE');
console.log('================================================================\n');

function getRouteHandler(router: any, routePath: string, method: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === routePath && l.route?.methods?.[method.toLowerCase()]
  );
  assert.ok(layer, `Expected ${method.toUpperCase()} ${routePath} to exist on router`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

async function runHandler(handler: any, req: any) {
  let caughtErr: any = null;
  let statusCode = 200;
  let body: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      body = payload;
      return this;
    },
  };

  await handler(req, res, (err: any) => {
    caughtErr = err;
  });

  return { err: caughtErr, statusCode, body };
}

async function runTests() {
  // 1. connect-manual must unconditionally reject with OAUTH_REQUIRED (400)
  console.log('👉 [Test 1] POST /channels/connect-manual rejects fake manual linking with OAUTH_REQUIRED');
  const manualHandler = getRouteHandler(channelsRouter, '/channels/connect-manual', 'post');
  const resManual = await runHandler(manualHandler, {
    ctx: { workspaceId: 'ws_1', userId: 'u_1', allBrands: true, brandIds: [] },
    body: {
      brandId: 'br_1',
      network: 'INSTAGRAM',
      handle: '@nonexistent_fake_test_999999',
      accountLogin: 'fake_user@notreal.invalid',
      accountPassword: 'completely_wrong_password_123',
    },
  });
  assert.ok(resManual.err, 'connect-manual must pass an error to next()');
  assert.equal(resManual.err.code, 'OAUTH_REQUIRED');
  assert.equal(resManual.err.status, 400);
  console.log('   ✅ PASS (rejected with 400 OAUTH_REQUIRED)\n');

  // 2. connect-mock must unconditionally reject with OAUTH_REQUIRED (400)
  console.log('👉 [Test 2] POST /channels/connect-mock rejects fake mock linking with OAUTH_REQUIRED');
  const mockHandler = getRouteHandler(channelsRouter, '/channels/connect-mock', 'post');
  const resMock = await runHandler(mockHandler, {
    ctx: { workspaceId: 'ws_1', userId: 'u_1', allBrands: true, brandIds: [] },
    body: {
      brandId: 'br_1',
      network: 'X',
      handle: '@fake_mock_account',
    },
  });
  assert.ok(resMock.err, 'connect-mock must pass an error to next()');
  assert.equal(resMock.err.code, 'OAUTH_REQUIRED');
  assert.equal(resMock.err.status, 400);
  console.log('   ✅ PASS (rejected with 400 OAUTH_REQUIRED)\n');

  // 3. POST /public/connect/:token/channel rejects unverified channel creation for all networks
  console.log('👉 [Test 3] POST /public/connect/:token/channel rejects unverified linking across networks');
  const completeHandler = getRouteHandler(invitesRouter, '/public/connect/:token/channel', 'post');
  const rawToken = 'test_invite_token_123456';
  const tokenHash = hashToken(rawToken);
  const origFindInvite = prisma.connectInvite.findUnique;
  const origChannelUpsert = prisma.channel.upsert;
  let channelUpsertCalled = false;

  (prisma.connectInvite as any).findUnique = async () => ({
    id: 'inv_test',
    workspaceId: 'ws_1',
    brandId: 'br_1',
    tokenHash,
    status: 'PENDING',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3600_000),
    brand: { id: 'br_1', name: 'Test Brand' },
  });
  (prisma.channel as any).upsert = async () => {
    channelUpsertCalled = true;
    throw new Error('prisma.channel.upsert must not be called for unverified connect-complete');
  };

  try {
    for (const network of ['FACEBOOK', 'INSTAGRAM', 'X', 'LINKEDIN']) {
      const resComplete = await runHandler(completeHandler, {
        params: { token: rawToken },
        body: { network, handle: '@fake_unverified' },
      });
      assert.ok(resComplete.err, `${network} /complete must reject`);
      assert.equal(resComplete.err.code, 'OAUTH_REQUIRED');
      assert.equal(resComplete.err.status, 400);
    }
    assert.equal(channelUpsertCalled, false);
    console.log('   ✅ PASS (all networks rejected without DB channel upsert)\n');
  } finally {
    (prisma.connectInvite as any).findUnique = origFindInvite;
    (prisma.channel as any).upsert = origChannelUpsert;
  }

  // 4. Verify channels.routes.ts no longer contains samplePastPosts or fake credential creation
  console.log('👉 [Test 4] channels.routes.ts has zero fake samplePastPosts / manual_pass_ / mock_token_ generators');
  const channelsRouteSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/channels/channels.routes.ts'),
    'utf8'
  );
  assert.equal(channelsRouteSrc.includes('samplePastPosts'), false, 'samplePastPosts must be removed');
  assert.equal(channelsRouteSrc.includes('manual_pass_'), false, 'manual_pass_ must be removed');
  assert.equal(channelsRouteSrc.includes('mock_token_'), false, 'mock_token_ must be removed');
  console.log('   ✅ PASS\n');

  console.log('================================================================');
  console.log('🎉 ALL 4 OAUTH-ONLY CHANNEL TESTS PASSED');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
