import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  INVITE_MIN_TTL_MS,
  inviteStillValid,
  vacantBedsForGender,
  validateStudentOnboarding,
  nextOnboardingStep,
} = await import('../src/lib/studentOnboarding.ts');

const beds = [
  { id: 'BBH-1-A', blockCode: 'BBH', roomNumber: 1, bedLetter: 'A', identifier: 'BBH-1-A', status: 'vacant', rentAmount: 900, roomGender: 'Male' },
  { id: 'BBH-7-A', blockCode: 'BBH', roomNumber: 7, bedLetter: 'A', identifier: 'BBH-7-A', status: 'vacant', rentAmount: 900, roomGender: 'Female' },
  { id: 'BBH-7-B', blockCode: 'BBH', roomNumber: 7, bedLetter: 'B', identifier: 'BBH-7-B', status: 'occupied', rentAmount: 900, roomGender: 'Female', student: { id: 't2', name: 'Taken', phone: '-', nrc: '-', email: 't@x.com', moveInDate: '2026-01-01' } },
];

test('invite links remain valid for at least 15 minutes', () => {
  assert.equal(INVITE_MIN_TTL_MS, 15 * 60 * 1000);
  const created = new Date('2026-09-07T10:00:00Z');
  assert.equal(inviteStillValid(created, new Date('2026-09-07T10:14:59Z')), true);
  assert.equal(inviteStillValid(created, new Date('2026-09-07T10:15:00Z'), 15 * 60 * 1000), true);
  const expiresAt = new Date('2026-09-07T10:20:00Z');
  assert.equal(inviteStillValid(created, new Date('2026-09-07T10:19:00Z'), undefined, expiresAt), true);
  assert.equal(inviteStillValid(created, new Date('2026-09-07T10:21:00Z'), undefined, expiresAt), false);
});

test('vacant beds are filtered to the student gender', () => {
  const female = vacantBedsForGender(beds, 'Female');
  assert.deepEqual(female.map((b) => b.id), ['BBH-7-A']);
  const male = vacantBedsForGender(beds, 'Male', 'BBH-7-B');
  assert.deepEqual(male.map((b) => b.id), ['BBH-1-A']);
  const femaleKeepAssigned = vacantBedsForGender(beds, 'Female', 'BBH-7-B');
  assert.deepEqual(femaleKeepAssigned.map((b) => b.id).sort(), ['BBH-7-A', 'BBH-7-B']);
});

test('onboarding walks gender → bed → personal info → password', () => {
  assert.equal(nextOnboardingStep('gender'), 'bed');
  assert.equal(nextOnboardingStep('bed'), 'profile');
  assert.equal(nextOnboardingStep('profile'), 'password');
  assert.equal(nextOnboardingStep('password'), 'done');

  assert.match(validateStudentOnboarding({ step: 'gender', gender: null }).error ?? '', /gender/i);
  assert.equal(validateStudentOnboarding({ step: 'gender', gender: 'Female' }).ok, true);

  assert.match(validateStudentOnboarding({
    step: 'bed',
    gender: 'Female',
    bedId: 'BBH-1-A',
    beds,
  }).error ?? '', /female|gender/i);

  assert.equal(validateStudentOnboarding({
    step: 'bed',
    gender: 'Female',
    bedId: 'BBH-7-A',
    beds,
  }).ok, true);

  assert.match(validateStudentOnboarding({
    step: 'profile',
    name: '',
    phone: '0977',
    nrc: '111',
    moveInDate: '2026-09-01',
  }).error ?? '', /name/i);

  assert.equal(validateStudentOnboarding({
    step: 'password',
    password: 'secret1',
    confirmPassword: 'secret1',
  }).ok, true);

  assert.match(validateStudentOnboarding({
    step: 'password',
    password: 'short',
    confirmPassword: 'short',
  }).error ?? '', /6/);
});

test("new occupancy ledgers use the Lusaka billing month, not UTC", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/030_onboard_billing_month.sql"), "utf8");
  assert.match(sql, /v_month text := public\.current_billing_month\(\);/);
  assert.match(
    sql,
    /coalesce\(nullif\(btrim\(coalesce\(p_target_month, ''\)\), ''\), public\.current_billing_month\(\)\)/,
  );
  assert.match(sql, /public\.onboard_student\(\s*[\s\S]*public\.current_billing_month\(\),/);
  assert.doesNotMatch(sql, /to_char\(timezone\('UTC', now\(\)\), 'Mon'\)/);
});
