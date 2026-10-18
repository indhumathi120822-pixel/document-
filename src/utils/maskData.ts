/**
 * Mask sensitive data in table cells.
 * Rules: Masks the last 4 digits of any number sequence longer than 8 digits.
 * Example: 1234567890 -> 123456XXXX
 * Also handles phone numbers, credit cards, SSN, bank accounts with spaces/hyphens.
 */

export function maskSensitiveValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // Match sequences of 9 or more digits (ignoring hyphens/spaces for length calculation or direct match)
  // 1. Direct digit sequence of 9+ digits: mask last 4 digits
  const maskedDirect = str.replace(/\b(\d{5,})(\d{4})\b/g, (_match, prefix) => {
    return `${prefix}XXXX`;
  });

  // 2. Also match formatted numbers like XXXX-XXXX-XXXX-1234 or 123-456-7890 (total digits >= 9)
  const maskedFormatted = maskedDirect.replace(/(\d[\d\s-]{7,}\d)/g, (fullMatch) => {
    const rawDigits = fullMatch.replace(/\D/g, '');
    if (rawDigits.length >= 9) {
      // Find the last 4 digits in fullMatch and replace them with XXXX
      let replacedCount = 0;
      const chars = fullMatch.split('');
      for (let i = chars.length - 1; i >= 0 && replacedCount < 4; i--) {
        if (/\d/.test(chars[i])) {
          chars[i] = 'X';
          replacedCount++;
        }
      }
      return chars.join('');
    }
    return fullMatch;
  });

  return maskedFormatted;
}

export function maskRowData<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const maskedRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'object' && value !== null) {
      maskedRow[key] = JSON.stringify(value);
    } else {
      maskedRow[key] = maskSensitiveValue(value);
    }
  }
  return maskedRow;
}

export function countSensitiveValues(rows: Record<string, unknown>[]): number {
  let count = 0;
  for (const row of rows) {
    for (const val of Object.values(row)) {
      if (val === null || val === undefined) continue;
      const str = String(val);
      const digits = str.replace(/\D/g, '');
      if (digits.length >= 9) {
        count++;
      }
    }
  }
  return count;
}

export default {
  maskSensitiveValue,
  maskRowData,
  countSensitiveValues,
};
