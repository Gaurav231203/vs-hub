import assert from 'node:assert/strict';
import { getWebUrl } from '../src/lib/urls.js';

function makeReq(headers: Record<string, string>) {
  return { headers } as any;
}

console.log('================================================================');
console.log('🔗 RUNNING OAUTH CALLBACK REDIRECT URL SAFETY TEST SUITE');
console.log('================================================================\n');

const origWebUrl = process.env.WEB_URL;
const origNodeEnv = process.env.NODE_ENV;

try {
  // 1. Third-party OAuth referers (facebook.com, google.com) MUST be ignored
  console.log('👉 [Test 1] Ignores Referer: https://www.facebook.com/ and falls back to Vercel URL');
  const fbUrl = getWebUrl(makeReq({ referer: 'https://www.facebook.com/', host: 'vs-hub-1.onrender.com' }));
  assert.ok(!fbUrl.includes('facebook.com'), `Should never redirect to facebook.com, got ${fbUrl}`);
  assert.ok(
    fbUrl.includes('vs-hub-ruddy.vercel.app') || fbUrl.includes('localhost'),
    `Expected app domain, got ${fbUrl}`
  );
  console.log(`   ✅ PASS (${fbUrl})\n`);

  console.log('👉 [Test 2] Ignores Referer: https://l.facebook.com/ and accounts.google.com');
  assert.ok(!getWebUrl(makeReq({ referer: 'https://l.facebook.com/l.php' })).includes('facebook.com'));
  assert.ok(!getWebUrl(makeReq({ referer: 'https://accounts.google.com/o/oauth2/auth' })).includes('google.com'));
  console.log('   ✅ PASS\n');

  // 2. Render backend host itself should NOT be returned as frontend webBase
  console.log('👉 [Test 3] Ignores onrender.com in x-forwarded-host / origin');
  const renderUrl = getWebUrl(makeReq({ 'x-forwarded-host': 'vs-hub-1.onrender.com', 'x-forwarded-proto': 'https' }));
  assert.ok(!renderUrl.includes('onrender.com'), `Should not return backend host, got ${renderUrl}`);
  console.log(`   ✅ PASS (${renderUrl})\n`);

  // 3. Trusted Vercel / localhost origins ARE preserved
  console.log('👉 [Test 4] Preserves trusted Vercel & localhost app origins');
  assert.equal(getWebUrl(makeReq({ origin: 'https://vs-hub-ruddy.vercel.app' })), 'https://vs-hub-ruddy.vercel.app');
  assert.equal(getWebUrl(makeReq({ origin: 'http://localhost:5173' })), 'http://localhost:5173');
  console.log('   ✅ PASS\n');

  console.log('🎉 ALL OAUTH REDIRECT URL TESTS PASSED!');
} finally {
  if (origWebUrl === undefined) delete process.env.WEB_URL;
  else process.env.WEB_URL = origWebUrl;
  if (origNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = origNodeEnv;
}
