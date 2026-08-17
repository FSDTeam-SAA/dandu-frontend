import assert from 'node:assert/strict';
import test from 'node:test';
import { previewCsv } from '../src/lib/csvPreview.ts';

test('validates SKU rows without claiming database persistence', () => {
  const preview = previewCsv('inventory.csv', 'SKU,Title\nA-1,"Widget, large"\n,Missing SKU\nB-2,Widget');

  assert.equal(preview.persisted, false);
  assert.equal(preview.totalRows, 3);
  assert.equal(preview.validRows, 2);
  assert.equal(preview.invalidRows, 1);
  assert.deepEqual(preview.issues, [{ rowNumber: 3, message: 'Missing SKU / ItemNumber' }]);
});

test('accepts ItemNumber and ignores blank trailing rows', () => {
  const preview = previewCsv('stock.csv', '\uFEFFItemNumber,Available\r\n2006386,0\r\n\r\n');

  assert.equal(preview.totalRows, 1);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 0);
});

test('rejects non-CSV files and files without an identifier column', () => {
  assert.throws(() => previewCsv('inventory.txt', 'SKU\nA-1'), /CSV file/);
  assert.throws(() => previewCsv('inventory.csv', 'Title\nWidget'), /SKU or ItemNumber/);
});
