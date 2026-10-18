import * as XLSX from 'xlsx';

/**
 * Export table data to an Excel (.xlsx) file
 * @param data Array of flat objects representing rows
 * @param filename File name without extension or with .xlsx
 */
export function exportToExcel(data: Record<string, unknown>[], filename: string = 'DocuMind_Extracted_Data'): void {
  if (!data || data.length === 0) {
    throw new Error('No data available to export.');
  }

  // Create worksheet from JSON data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-fit column widths
  const keys = Object.keys(data[0] || {});
  const colWidths = keys.map((key) => {
    let maxLength = key.length;
    data.forEach((row) => {
      const cellVal = row[key];
      if (cellVal !== undefined && cellVal !== null) {
        const valStr = String(cellVal);
        if (valStr.length > maxLength) {
          maxLength = Math.min(valStr.length, 50); // cap max column width
        }
      }
    });
    return { wch: Math.max(maxLength + 3, 10) };
  });
  worksheet['!cols'] = colWidths;

  // Create a new workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted Data');

  // Ensure clean filename
  const cleanName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  // Write and trigger download in browser
  XLSX.writeFile(workbook, cleanName);
}

/**
 * Export table data to a CSV file (Google Sheets / Excel compatible)
 * @param data Array of flat objects representing rows
 * @param filename File name without extension or with .csv
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string = 'DocuMind_Extracted_Data'): void {
  if (!data || data.length === 0) {
    throw new Error('No data available to export.');
  }

  const keys = Object.keys(data[0] || {});

  const escapeCSVCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // If string contains quotes, commas, or newlines, escape quotes by doubling them
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerRow = keys.map(escapeCSVCell).join(',');
  const bodyRows = data.map((row) => keys.map((key) => escapeCSVCell(row[key])).join(','));

  // UTF-8 BOM prefix (\uFEFF) ensures Excel & Google Sheets parse special characters properly
  const csvContent = '\uFEFF' + [headerRow, ...bodyRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const cleanName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export table data to formatted JSON file
 */
export function exportToJSON(data: Record<string, unknown>[], filename: string = 'DocuMind_Extracted_Data'): void {
  if (!data || data.length === 0) {
    throw new Error('No data available to export.');
  }
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanName = filename.endsWith('.json') ? filename : `${filename}.json`;
  link.setAttribute('href', url);
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default {
  exportToExcel,
  exportToCSV,
  exportToJSON,
};
