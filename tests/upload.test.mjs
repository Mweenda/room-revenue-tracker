import test from 'node:test';
import assert from 'node:assert/strict';

const upload = await import('../src/lib/upload.ts');

test('storage paths stay inside the tenant folder with a safe extension', () => {
  const path = upload.storageObjectPath('tenant-1', 'receipts', { name: 'Photo 01.JPEG', type: '' });
  assert.match(path, /^tenant-1\/receipts-\d+\.jpeg$/);
});

test('an empty Android file name still becomes a jpeg upload', () => {
  assert.equal(upload.fileExtension({ name: '', type: '' }), 'jpg');
  assert.equal(upload.contentTypeFor({ name: '', type: '' }), 'image/jpeg');
  assert.equal(upload.contentTypeFor({ name: 'proof.PNG', type: '' }), 'image/png');
  assert.equal(upload.contentTypeFor({ name: 'x.bin', type: 'application/pdf' }), 'application/pdf');
});

test('storage errors surface a specific message instead of a generic failure', () => {
  assert.match(
    upload.describeStorageError({ message: 'new row violates row-level security policy', statusCode: '403' }),
    /denied/i,
  );
  assert.match(
    upload.describeStorageError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' }),
    /too large/i,
  );
  assert.equal(
    upload.describeStorageError({ message: 'Bucket not found' }),
    'The receipt storage bucket is missing. Contact your landlord.',
  );
});
