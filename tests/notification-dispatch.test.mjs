import test from 'node:test';
import assert from 'node:assert/strict';

// No Supabase credentials: getSupabase() returns null, so the dispatch helper
// exercises its guard paths without touching the network.
globalThis.__vite_env__ = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };

const auth = await import('../src/lib/auth.ts');

test('the notification contract exposes no recipient-controlled fields', () => {
  // The Edge Function resolves the address and renders the body, so the client
  // helper must not accept `to`, `subject`, or `html`.
  assert.equal(typeof auth.sendTenantNotification, 'function');
  assert.equal(auth.sendEmail, undefined);
  assert.equal(auth.buildSecureLoginUrl, undefined);
  assert.equal(auth.sendSecureLoginLink, undefined);
});

test('no client-side OTP generation or storage remains', () => {
  // One-time codes are issued and verified by Supabase Auth. A browser-side
  // generator or store would be trivially readable and forgeable.
  assert.equal(auth.generateOTP, undefined);
  assert.equal(auth.sendOTP, undefined);
});

test('no landlord credentials are bundled with the client', () => {
  assert.equal(auth.OFFLINE_LANDLORD_CREDENTIALS, undefined);
});

test('a notification without a tenant id is refused before any dispatch', async () => {
  const sent = await auth.sendTenantNotification({
    tenantId: '',
    type: 'rent_increase',
    details: { oldAmount: 1000, newAmount: 1200 },
  });

  assert.equal(sent, false);
});

test('landlord login refuses to fall back to a local check when unconfigured', async () => {
  const result = await auth.landlordLogin({
    email: 'someone@example.com',
    password: 'whatever',
  });

  assert.equal(result.success, false);
  assert.match(result.message, /not configured/i);
});

test('a student one-time code cannot be requested without a backend', async () => {
  const result = await auth.requestOTP({ email: 'student@example.com', name: 'Student' });

  assert.equal(result.success, false);
  assert.equal('devOtp' in result, false);
});
