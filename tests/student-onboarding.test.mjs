import test from 'node:test';
import assert from 'node:assert/strict';

const {
  INVITE_MIN_TTL_MS,
  inviteStillValid,
  vacantBedsForGender,
  validateStudentOnboarding,
  nextOnboardingStep,
} = await import('../src/lib/studentOnboarding.ts');
const { applyOnboardingBedMove, occupancyBillingCarry } = await import('../src/lib/occupancy.ts');

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

test('onboarding may choose any vacant bed of the assigned gender, not only the landlord bed', () => {
  const female = vacantBedsForGender(beds, 'Female', 'BBH-7-B');
  assert.equal(validateStudentOnboarding({
    step: 'bed',
    gender: 'Female',
    bedId: 'BBH-7-A',
    beds,
    assignedBedId: 'BBH-7-B',
  }).ok, true);
  assert.deepEqual(female.map((bed) => bed.id).sort(), ['BBH-7-A', 'BBH-7-B']);
});

test('switching beds during onboarding carries the outstanding ledger onto the chosen bed', () => {
  const assigned = {
    billing_id: 'BBH-7-B',
    house_block: 'BBH',
    room_number: '7',
    bed_space: 'B',
    room_gender: 'Female',
    tenant_name: 'Ada Lovelace',
    phone_number: '0970000000',
    entry_date: '2026-02-01',
    current_rent: 900,
    target_month: 'Sep',
    accumulated_total: 1800,
    total_balance: 900,
    days_past_due: 0,
    billing_status: 'Open Window',
  };
  const vacant = {
    billing_id: 'BBH-7-A',
    house_block: 'BBH',
    room_number: '7',
    bed_space: 'A',
    room_gender: 'Female',
    tenant_name: '',
    phone_number: '',
    entry_date: '',
    current_rent: 850,
    target_month: '',
    accumulated_total: 0,
    total_balance: 0,
    days_past_due: 0,
    billing_status: 'Vacant',
  };

  const next = applyOnboardingBedMove(
    assigned,
    vacant,
    { name: 'Ada Lovelace', phone: '0970000000', moveInDate: '2026-02-01' },
    { blockCode: 'BBH', roomNumber: 7, bedLetter: 'A', rentAmount: 850, roomGender: 'Female' },
  );

  assert.equal(next.vacated.billing_status, 'Vacant');
  assert.equal(next.vacated.total_balance, 0);
  assert.equal(next.vacated.accumulated_total, 0);
  assert.equal(next.occupied.tenant_name, 'Ada Lovelace');
  assert.equal(next.occupied.current_rent, 850);
  assert.equal(next.occupied.total_balance, 900);
  assert.equal(next.occupied.accumulated_total, 1800);
  assert.equal(next.occupied.target_month, 'Sep');
  assert.deepEqual(occupancyBillingCarry(assigned), {
    total_balance: 900,
    accumulated_total: 1800,
    days_past_due: 0,
    target_month: 'Sep',
  });
});
