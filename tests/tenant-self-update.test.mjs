import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolvePortalOrigin } from '../supabase/functions/send-email/portalOrigin.ts';

const migration = readFileSync(
  resolve('supabase/migrations/017_protect_tenant_self_update.sql'),
  'utf8',
);

test('student self-update cannot change bed_space_id, status, or auth linkage', () => {
  assert.match(migration, /protect_tenant_self_update/);
  assert.match(migration, /Students cannot reassign their bed space/);
  assert.match(migration, /Students cannot change occupancy status/);
  assert.match(migration, /Students cannot reassign the linked login/);
  assert.match(migration, /old\.auth_user_id is null and new\.auth_user_id = auth\.uid\(\)/);
  assert.match(migration, /before update on public\.tenants/);
});

test('landlord RPCs and service-role writes still pass the occupancy guard', () => {
  assert.match(migration, /if public\.is_landlord\(\) or auth\.uid\(\) is null then/);
});

test('welcome-email setup links ignore a spoofed Origin header', () => {
  assert.equal(
    resolvePortalOrigin('https://evil.example', 'https://roomrevenue.com'),
    'https://roomrevenue.com',
  );
  assert.equal(
    resolvePortalOrigin('https://evil.example', 'https://roomrevenue.com/'),
    'https://roomrevenue.com',
  );
  assert.equal(resolvePortalOrigin('https://evil.example', ''), 'http://localhost:5173');
  assert.equal(resolvePortalOrigin('http://localhost:5173', ''), 'http://localhost:5173');
  assert.equal(resolvePortalOrigin('http://127.0.0.1:4173', null), 'http://127.0.0.1:4173');
});
