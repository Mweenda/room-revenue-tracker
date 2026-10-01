import test from 'node:test';
import assert from 'node:assert/strict';

const {
  normalizeWhatsAppPhone,
  whatsappChatUrl,
  whatsappBroadcastUrl,
  formatWhatsAppNumberList,
  composeBulkRentReminder,
  resolveBulkReminderText,
  composeRentReminder,
  studentsForWhatsAppReminder,
} = await import('../src/lib/whatsapp.ts');

test('Zambian phone numbers become WhatsApp international digits', () => {
  assert.equal(normalizeWhatsAppPhone('0977146630'), '260977146630');
  assert.equal(normalizeWhatsAppPhone('+260 977 146 630'), '260977146630');
  assert.equal(normalizeWhatsAppPhone('260977146630'), '260977146630');
  assert.equal(normalizeWhatsAppPhone(''), null);
});

test('click-to-chat URL opens WhatsApp with a prefilled reminder', () => {
  const url = whatsappChatUrl('0977146630', 'Please pay rent');
  assert.equal(url.startsWith('https://wa.me/260977146630?text='), true);
  assert.equal(decodeURIComponent(new URL(url).searchParams.get('text')), 'Please pay rent');
});

test('reminder copy names the student, bed, balance and grace', () => {
  const text = composeRentReminder({
    name: 'Ada Lovelace',
    bedLabel: 'BBH 1A',
    balance: 900,
    dueDate: '2026-09-01',
    daysPastDue: 6,
    status: 'OVERDUE / UNPAID',
  });
  assert.match(text, /Ada Lovelace/);
  assert.match(text, /BBH 1A/);
  assert.match(text, /K900/);
  assert.match(text, /overdue/i);
});

test('bulk reminder is one shared message and a phone-less WhatsApp URL', () => {
  const text = composeBulkRentReminder({ dueDate: 'the 1st of the month' });
  assert.match(text, /outstanding balance/i);
  assert.doesNotMatch(text, /Hi Ada/);
  const url = whatsappBroadcastUrl(text);
  assert.equal(url.startsWith('https://wa.me/?text='), true);
  assert.equal(decodeURIComponent(new URL(url).searchParams.get('text')), text);
  assert.equal(formatWhatsAppNumberList(['0977000002', '+260 977 000 003', '']), '260977000002, 260977000003');
  assert.match(resolveBulkReminderText('Pay now {name} in {bed}'), /Pay now there in your bed space/);
});

test('the Students WhatsApp gateway sends one reminder to the whole owing list', async () => {
  const { readFileSync } = await import('node:fs');
  const gateway = readFileSync(new URL('../src/app/components/WhatsAppGateway.tsx', import.meta.url), 'utf8');
  const studentsView = readFileSync(new URL('../src/app/views/StudentsView.tsx', import.meta.url), 'utf8');
  assert.match(gateway, /Send to all \$\{recipients\.length\}/);
  assert.match(gateway, /whatsappBroadcastUrl/);
  assert.match(gateway, /New broadcast/);
  assert.match(studentsView, /preferredFilter/);
  assert.match(studentsView, /past_grace/);
});

test('WhatsApp targeting follows the current student filter and 5-day grace', () => {
  const rows = [
    { id: '1', full_name: 'Paid', phone: '0977000001', tenant_status: 'active', billing_status: 'Paid / Secured', total_balance: 0, days_past_due: 20 },
    { id: '2', full_name: 'Grace', phone: '0977000002', tenant_status: 'active', billing_status: 'Grace Period', total_balance: 900, days_past_due: 3 },
    { id: '3', full_name: 'Overdue', phone: '0977000003', tenant_status: 'active', billing_status: 'OVERDUE / UNPAID', total_balance: 900, days_past_due: 8 },
    { id: '4', full_name: 'Unpaid window', phone: '0977000004', tenant_status: 'active', billing_status: 'Open Window', total_balance: 900, days_past_due: 0 },
    { id: '5', full_name: 'No phone', phone: null, tenant_status: 'active', billing_status: 'OVERDUE / UNPAID', total_balance: 900, days_past_due: 9 },
    { id: '6', full_name: 'Evicted', phone: '0977000006', tenant_status: 'evicted', billing_status: 'OVERDUE / UNPAID', total_balance: 900, days_past_due: 9 },
  ];

  const unpaid = studentsForWhatsAppReminder(rows, 'unpaid');
  assert.deepEqual(unpaid.map((r) => r.full_name), ['Grace', 'Overdue', 'Unpaid window']);

  const overdue = studentsForWhatsAppReminder(rows, 'past_grace');
  assert.deepEqual(overdue.map((r) => r.full_name), ['Overdue']);

  const selected = studentsForWhatsAppReminder(rows, 'selected', new Set(['2', '3', '6']));
  assert.deepEqual(selected.map((r) => r.full_name), ['Grace', 'Overdue']);
});
