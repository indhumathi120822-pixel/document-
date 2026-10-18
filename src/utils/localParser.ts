import * as XLSX from 'xlsx';
import { DataRow } from '../components/DataTable';

export interface ParsedTableResult {
  rows: DataRow[];
  columns: string[];
  filename: string;
}

/**
 * Instantly parse CSV, JSON, or Excel files client-side with ZERO AI delay.
 * Executes in milliseconds directly in browser JavaScript.
 */
export async function parseFileLocally(file: File): Promise<ParsedTableResult> {
  const fileName = file.name;
  const isJSON = fileName.toLowerCase().endsWith('.json') || file.type === 'application/json';

  if (isJSON) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    let rawRows: Record<string, unknown>[] = [];
    if (Array.isArray(parsed)) {
      rawRows = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (arrayKey && Array.isArray(parsed[arrayKey])) {
        rawRows = parsed[arrayKey];
      } else {
        rawRows = [parsed];
      }
    }

    rawRows = rawRows.filter((item) => item && typeof item === 'object');
    if (rawRows.length === 0) {
      throw new Error('JSON file did not contain any valid row items.');
    }

    const columnSet = new Set<string>();
    rawRows.forEach((r) => Object.keys(r).forEach((k) => columnSet.add(k)));
    const columns = Array.from(columnSet);

    const rows: DataRow[] = rawRows.map((r, idx) => {
      const rowObj: DataRow = { _id: `import-${idx}-${Date.now()}` };
      columns.forEach((c) => {
        rowObj[c] = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
      });
      return rowObj;
    });

    return { rows, columns, filename: fileName };
  }

  // Parse CSV, TSV, or XLSX using SheetJS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Uploaded spreadsheet does not contain any sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('Imported file has no readable data rows.');
  }

  const columnSet = new Set<string>();
  rawRows.forEach((r) => Object.keys(r).forEach((k) => columnSet.add(k)));
  const columns = Array.from(columnSet);

  const rows: DataRow[] = rawRows.map((r, idx) => {
    const rowObj: DataRow = { _id: `import-${idx}-${Date.now()}` };
    columns.forEach((c) => {
      rowObj[c] = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
    });
    return rowObj;
  });

  return { rows, columns, filename: fileName };
}
