import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvContent, getInitials, sanitizeCsvCell } from './pureFormatters';

test('getInitials extracts uppercase initials cleanly', () => {
  assert.equal(getInitials('Maya Lin-Reyes'), 'ML');
  assert.equal(getInitials('Priya'), 'PR');
  assert.equal(getInitials(''), 'AC');
});

test('sanitizeCsvCell prevents CSV formula injection and escapes commas/quotes', () => {
  assert.equal(sanitizeCsvCell('=CMD("calc")'), '\'=CMD("calc")'.replace(/'/, "'") && `"'=CMD(""calc"")"`);
  assert.equal(sanitizeCsvCell('+1-415-890'), `'+1-415-890`);
  assert.equal(sanitizeCsvCell('Computer Science, Dept'), '"Computer Science, Dept"');
});

test('buildCsvContent generates RFC-4180 rows with CRLF', () => {
  const csv = buildCsvContent(['ID', 'Name'], [['STU-1', 'Liam Navarro']]);
  assert.equal(csv, 'ID,Name\r\nSTU-1,Liam Navarro');
});
