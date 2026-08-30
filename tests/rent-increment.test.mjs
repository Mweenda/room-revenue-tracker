import test from 'node:test';
import assert from 'node:assert/strict';

const { computeRentIncrease, resolveScope, buildRentPreview, summarizePreview } =
  await import('../src/lib/rent.ts');

function bed(id, blockCode, roomNumber, bedLetter, rentAmount, student) {
  return { id, blockCode, roomNumber, bedLetter, identifier: id, status: student ? 'occupied' : 'vacant', rentAmount, student };
}

const BEDS = [
  bed('BBH-1A', 'BBH', 1, 'A', 900, { id: 't1', name: 'Ada', email: 'ada@example.com', phone: '', nrc: '', moveInDate: '' }),
  bed('BBH-1B', 'BBH', 1, 'B', 900),
  bed('NWG-2A', 'NWG', 2, 'A', 1000, { id: 't2', name: 'Ben', email: '', phone: '', nrc: '', moveInDate: '' }),
  bed('ANX-3C', 'ANX', 3, 'C', 1250, { id: 't3', name: 'Cara', email: 'cara@example.com', phone: '', nrc: '', moveInDate: '' }),
];

test('percentage increase rounds to two decimals', () => {
  assert.equal(computeRentIncrease(900, 'percentage', 7.5), 967.5);
  assert.equal(computeRentIncrease(1000, 'percentage', 10), 1100);
  // 1233.33 * 1.035 = 1276.49655 -> 1276.5
  assert.equal(computeRentIncrease(1233.33, 'percentage', 3.5), 1276.5);
});

test('fixed increase adds a flat kwacha amount', () => {
  assert.equal(computeRentIncrease(900, 'fixed', 150), 1050);
  assert.equal(computeRentIncrease(999.99, 'fixed', 0.01), 1000);
});

test('increase value must be positive and rent non-negative', () => {
  assert.throws(() => computeRentIncrease(900, 'percentage', 0), /greater than zero/);
  assert.throws(() => computeRentIncrease(900, 'fixed', -50), /greater than zero/);
  assert.throws(() => computeRentIncrease(-1, 'fixed', 50), /non-negative/);
});

test('scope resolution returns beds in stable block/room/bed order', () => {
  const all = resolveScope(BEDS, { kind: 'all' });
  assert.deepEqual(all.map((b) => b.id), ['ANX-3C', 'BBH-1A', 'BBH-1B', 'NWG-2A']);

  const block = resolveScope(BEDS, { kind: 'block', blockCode: 'BBH' });
  assert.deepEqual(block.map((b) => b.id), ['BBH-1A', 'BBH-1B']);

  const picked = resolveScope(BEDS, { kind: 'selected', bedIds: ['NWG-2A', 'ANX-3C'] });
  assert.deepEqual(picked.map((b) => b.id), ['ANX-3C', 'NWG-2A']);

  assert.deepEqual(resolveScope(BEDS, { kind: 'selected', bedIds: [] }), []);
});

test('preview pairs old and new rent per bed without mutating input', () => {
  const rows = buildRentPreview(BEDS, { kind: 'block', blockCode: 'BBH' }, 'fixed', 100);

  assert.deepEqual(rows, [
    { bedId: 'BBH-1A', label: 'BBH 1A', studentName: 'Ada', studentEmail: 'ada@example.com', oldRent: 900, newRent: 1000, delta: 100 },
    { bedId: 'BBH-1B', label: 'BBH 1B', studentName: null, studentEmail: null, oldRent: 900, newRent: 1000, delta: 100 },
  ]);
  assert.equal(BEDS[0].rentAmount, 900, 'source beds are untouched');
});

test('summary counts occupied, vacant and notifiable beds', () => {
  const rows = buildRentPreview(BEDS, { kind: 'all' }, 'percentage', 10);
  const summary = summarizePreview(rows);

  assert.equal(summary.bedCount, 4);
  assert.equal(summary.studentCount, 3);
  assert.equal(summary.vacantCount, 1);
  // Ben has no email, so only Ada and Cara can be notified.
  assert.equal(summary.notifiableCount, 2);
  assert.equal(summary.currentMonthlyTotal, 4050);
  assert.equal(summary.newMonthlyTotal, 4455);
  assert.equal(Math.round(summary.monthlyUplift), 405);
});
