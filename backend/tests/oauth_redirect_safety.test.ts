import assert from 'node:assert/strict';
import { getWebUrl, isTrustedWebHost } from '../src/lib/urls.js';
import { generateMetaOAuthState, verifyMetaOAuthState } from '../src/modules/channels/meta.service.js';

console.log('================================================================');
console.log('🔒 RUNNING OAUTH REDIRECT & TRUSTED WEB HOST TEST SUITE');
console.log('================================================================\n');

// 1. Trusted host validation
console.log('👉 [Test 1] isTrustedWebHost rejects external OAuth referers like facebook.com');
assert.equal(isTrustedWebHost('www.facebook.com'), false);
assert.equal(isTrustedWebHost('l.facebook.com'), false);
assert.equal(isTrustedWebHost('m.facebook.com'), false);
assert.equal(isTrustedWebHost('vs-hub-1.onrender.com'), false);
assert.equal(isTrustedWebHost('vs-hub-ruddy.vercel.app'), true);
assert.equal(isTrustedWebHost('localhost'), true);
console.log('   ✅ PASS\n');

// 2. getWebUrl ignores Facebook Referer on callback and defaults to Vercel production URL
console.log('👉 [Test 2] getWebUrl ignores Referer: https://www.facebook.com/ on Meta callback');
const mockCallbackReq = {
  headers: {
    referer: 'https://www.facebook.com/',
    'x-forwarded-host': 'vs-hub-1.onrender.com',
    'x-forwarded-proto': 'https',
  },
} as any;

const origWebUrl = process.env.WEB_URL;
const resolvedUrl = getWebUrl(mockCallbackReq);
assert.ok(!resolvedUrl.includes('facebook.com'), `Must NOT redirect to facebook.com, got: ${resolvedUrl}`);
assert.ok(!resolvedUrl.includes('onrender.com'), `Must NOT redirect to onrender.com, got: ${resolvedUrl}`);
console.log(`   Resolved callback webBase = ${resolvedUrl} ✅ PASS\n`);

// 3. Trusted Vercel origin IS preserved
console.log('👉 [Test 3] getWebUrl preserves trusted Vercel/localhost frontend origins');
const mockFrontendReq = {
  headers: {
    origin: 'https://vs-hub-ruddy.vercel.app',
  },
} as any;
assert.equal(getWebUrl(mockFrontendReq), 'https://vs-hub-ruddy.vercel.app');
console.log('   ✅ PASS\n');

// 4. Signed Meta OAuth state preserves webUrl and rejects untrusted webUrl
console.log('👉 [Test 4] generateMetaOAuthState & verifyMetaOAuthState validate webUrl safely');
const stateGood = generateMetaOAuthState('tok_1', 'brand_1', 'https://vs-hub-ruddy.vercel.app');
const verifiedGood = verifyMetaOAuthState(stateGood);
assert.equal(verifiedGood.inviteToken, 'tok_1');
assert.equal(verifiedGood.brandId, 'brand_1');
assert.equal(verifiedGood.webUrl, 'https://vs-hub-ruddy.vercel.app');

const stateEvil = generateMetaOAuthState('tok_1', 'brand_1', 'https://www.facebook.com');
const verifiedEvil = verifyMetaOAuthState(stateEvil);
assert.equal(verifiedEvil.webUrl, undefined);
console.log('   ✅ PASS\n');

if (origWebUrl !== undefined) process.env.WEB_URL = origWebUrl;

console.log('🎉 ALL OAUTH REDIRECT SAFETY TESTS PASSED!');
