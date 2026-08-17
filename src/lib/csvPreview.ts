export type CsvValidationIssue = {
  rowNumber: number;
  message: string;
};

export type CsvPreview = {
  persisted: false;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headers: string[];
  issues: CsvValidationIssue[];
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += character;
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted value');
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function previewCsv(fileName: string, content: string): CsvPreview {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    throw new Error('Please select a CSV file');
  }

  const rows = parseCsv(content);
  const headers = rows[0]?.map((header) => header.replace(/^\uFEFF/, '').trim()) ?? [];
  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new Error('CSV is empty');
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const skuIndex = normalizedHeaders.findIndex(
    (header) => header === 'sku' || header === 'itemnumber',
  );
  if (skuIndex < 0) throw new Error('CSV must include a SKU or ItemNumber column');

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
  const issues: CsvValidationIssue[] = [];

  dataRows.forEach((row, index) => {
    if (!row[skuIndex]?.trim()) {
      issues.push({ rowNumber: index + 2, message: 'Missing SKU / ItemNumber' });
    }
  });

  return {
    persisted: false,
    totalRows: dataRows.length,
    validRows: dataRows.length - issues.length,
    invalidRows: issues.length,
    headers,
    issues,
  };
}
