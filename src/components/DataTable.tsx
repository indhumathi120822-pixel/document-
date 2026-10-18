import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  PackageX,
  Filter,
  X,
} from 'lucide-react';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/excelExport';

export interface DataRow extends Record<string, unknown> {
  _id: string;
}

interface DataTableProps {
  data: DataRow[];
  columns: string[];
  filename: string;
  onDataChange: (newData: DataRow[], newColumns?: string[]) => void;
}

// Utility to parse numeric amounts
function parseAmount(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Utility to parse date strings into Date object
function parseDateString(val: unknown): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return new Date(parsed);

  // Match formats like MM/DD/YYYY or DD-MM-YYYY or YYYY/MM/DD
  const parts = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (parts) {
    return new Date(parseInt(parts[1], 10), parseInt(parts[2], 10) - 1, parseInt(parts[3], 10));
  }

  const slashParts = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (slashParts) {
    return new Date(parseInt(slashParts[3], 10), parseInt(slashParts[1], 10) - 1, parseInt(slashParts[2], 10));
  }

  return null;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  filename,
  onDataChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Shortlist state: Show Low Stock & Expiring Soon
  const [isShortlistActive, setIsShortlistActive] = useState(false);

  // Add column modal
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Column renaming state
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [columnRenameValue, setColumnRenameValue] = useState('');

  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 1. Locate Quantity & Expiry Columns
  const quantityCol = useMemo(() => {
    return (
      columns.find((c) => /^quantity$/i.test(c)) ||
      columns.find((c) => /qty|quantity|units_on_hand|stock/i.test(c)) ||
      null
    );
  }, [columns]);

  const expiryCol = useMemo(() => {
    return (
      columns.find((c) => /^expiry.*date$/i.test(c)) ||
      columns.find((c) => /expiry|expiration|exp_date/i.test(c)) ||
      columns.find((c) => /due_date|date/i.test(c)) ||
      null
    );
  }, [columns]);

  // 2. Identify Low Stock and Expiring Soon rows
  // Current reference date (October 18, 2026)
  const now = useMemo(() => new Date(), []);
  const threeMonthsLater = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 3);
    return d;
  }, [now]);

  const rowStatusMap = useMemo(() => {
    const map = new Map<string, { isLowStock: boolean; isExpiringSoon: boolean; daysRemaining: number | null }>();

    data.forEach((row) => {
      let isLowStock = false;
      let isExpiringSoon = false;
      let daysRemaining: number | null = null;

      // Check Quantity (< 10)
      if (quantityCol) {
        const rawQty = row[quantityCol];
        const numQty = parseAmount(rawQty);
        if (numQty < 10 && rawQty !== '' && rawQty !== undefined) {
          isLowStock = true;
        }
      }

      // Check Expiry Date (within next 3 months)
      if (expiryCol) {
        const dateObj = parseDateString(row[expiryCol]);
        if (dateObj) {
          const diffMs = dateObj.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          daysRemaining = diffDays;
          if (diffDays <= 93) {
            isExpiringSoon = true;
          }
        }
      }

      map.set(row._id, { isLowStock, isExpiringSoon, daysRemaining });
    });

    return map;
  }, [data, quantityCol, expiryCol, now]);

  const shortlistCount = useMemo(() => {
    let count = 0;
    rowStatusMap.forEach((status) => {
      if (status.isLowStock || status.isExpiringSoon) count++;
    });
    return count;
  }, [rowStatusMap]);

  // 3. Anomaly detection (Amount 5x higher than average)
  const amountCol = useMemo(() => {
    return (
      columns.find((c) => /^amount$/i.test(c)) ||
      columns.find((c) => /total.*amount|amount|net_pay|total|price|cost/i.test(c)) ||
      null
    );
  }, [columns]);

  const { averageAmount, anomalyRowIds } = useMemo(() => {
    if (!amountCol || data.length < 2) {
      return { averageAmount: 0, anomalyRowIds: new Set<string>() };
    }

    let sum = 0;
    let count = 0;
    data.forEach((row) => {
      const val = parseAmount(row[amountCol]);
      if (val > 0) {
        sum += val;
        count++;
      }
    });

    if (count < 2) return { averageAmount: 0, anomalyRowIds: new Set<string>() };

    const avg = sum / count;
    const threshold = avg * 5;
    const anomalies = new Set<string>();

    data.forEach((row) => {
      const val = parseAmount(row[amountCol]);
      if (val >= threshold && val > 0) {
        anomalies.add(row._id);
      }
    });

    return { averageAmount: avg, anomalyRowIds: anomalies };
  }, [data, amountCol]);

  // 4. Filtered and Sorted Rows (combines Search Query + Shortlist Filter)
  const displayedRows = useMemo(() => {
    let rows = [...data];

    // Shortlist filter: Low Stock (<10) OR Expiring Soon (Next 3 months)
    if (isShortlistActive) {
      rows = rows.filter((row) => {
        const status = rowStatusMap.get(row._id);
        return status?.isLowStock || status?.isExpiringSoon;
      });
    }

    // Dynamic search across all columns (date, product name, numbers, etc.)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter((row) =>
        columns.some((col) => {
          const val = row[col];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sorting
    if (sortConfig) {
      rows.sort((a, b) => {
        const aVal = String(a[sortConfig.key] ?? '');
        const bVal = String(b[sortConfig.key] ?? '');
        const compare = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? compare : -compare;
      });
    }

    return rows;
  }, [data, columns, searchQuery, isShortlistActive, rowStatusMap, sortConfig]);

  // Cell editing
  const handleSaveCell = (rowId: string, colKey: string) => {
    const updated = data.map((row) => {
      if (row._id === rowId) {
        return { ...row, [colKey]: cellEditValue };
      }
      return row;
    });
    onDataChange(updated);
    setEditingCell(null);
  };

  const handleAddRow = () => {
    const newRow: DataRow = { _id: `row-new-${Date.now()}` };
    columns.forEach((col) => {
      newRow[col] = '';
    });
    onDataChange([...data, newRow]);
  };

  const handleDeleteRow = (rowId: string) => {
    const updated = data.filter((r) => r._id !== rowId);
    onDataChange(updated);
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newColumnName.trim();
    if (!cleanName || columns.includes(cleanName)) return;

    const newCols = [...columns, cleanName];
    const updated = data.map((row) => ({
      ...row,
      [cleanName]: '',
    }));
    onDataChange(updated, newCols);
    setNewColumnName('');
    setShowAddColumnModal(false);
  };

  const handleSaveRenameColumn = (oldName: string) => {
    const newName = columnRenameValue.trim();
    if (!newName || newName === oldName || columns.includes(newName)) {
      setRenamingColumn(null);
      return;
    }

    const newCols = columns.map((col) => (col === oldName ? newName : col));
    const updated = data.map((row) => {
      const newRow = { ...row };
      newRow[newName] = newRow[oldName] ?? '';
      delete newRow[oldName];
      return newRow;
    });

    onDataChange(updated, newCols);
    setRenamingColumn(null);
  };

  const handleDeleteColumn = (colName: string) => {
    if (columns.length <= 1) return;
    if (window.confirm(`Delete column "${colName}"?`)) {
      const newCols = columns.filter((c) => c !== colName);
      const updated = data.map((row) => {
        const newRow = { ...row };
        delete newRow[colName];
        return newRow;
      });
      onDataChange(updated, newCols);
    }
  };

  const getCleanExportData = () => {
    return data.map((row) => {
      const rowCopy: Record<string, unknown> = {};
      columns.forEach((col) => {
        rowCopy[col] = row[col] ?? '';
      });
      return rowCopy;
    });
  };

  const handleExportXLSX = () => {
    const baseName = filename.replace(/\.[^/.]+$/, '');
    exportToExcel(getCleanExportData(), `${baseName}_Export`);
  };

  const handleExportCSV = () => {
    const baseName = filename.replace(/\.[^/.]+$/, '');
    exportToCSV(getCleanExportData(), `${baseName}_Export`);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(getCleanExportData(), null, 2));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleSort = (colKey: string) => {
    setSortConfig((current) => {
      if (current?.key === colKey) {
        if (current.direction === 'asc') return { key: colKey, direction: 'desc' };
        return null;
      }
      return { key: colKey, direction: 'asc' };
    });
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. SECURITY BANNER */}
      <div className="mox-weak-box p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0" />
            <p className="text-sm font-bold text-[#B91C1C]">
              🔒 Human-in-the-Loop Security: Please verify the extracted data before exporting.
            </p>
          </div>
          <span className="text-xs text-[#DC2626] font-medium hidden sm:inline">
            Click any cell to edit directly
          </span>
        </div>
      </div>

      {/* 2. PROMINENT SMART SEARCH & SHORTLIST FILTER BAR */}
      <div className="mox-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Prominent Smart Search Bar */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, date (e.g. 2026), batch, or price..."
              className="w-full pl-11 pr-10 py-2.5 text-base rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0EA5C9] focus:ring-3 focus:ring-[#0EA5C9]/15 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Shortlist Filter Button ("Show Low Stock & Expiring Soon") */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShortlistActive(!isShortlistActive)}
              className={`mox-btn text-sm font-bold py-2.5 px-4 rounded-lg transition-all shadow-sm ${
                isShortlistActive
                  ? 'bg-[#EA580C] text-white border-[#EA580C] hover:bg-[#C2410C]'
                  : 'bg-white hover:bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]'
              }`}
              title="Filter items with Quantity < 10 or Expiry Date within the next 3 months"
            >
              <Filter className="w-4 h-4" />
              <span>Show Low Stock & Expiring Soon</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-extrabold ${
                  isShortlistActive ? 'bg-white text-[#EA580C]' : 'bg-[#FFEDD5] text-[#9A3412]'
                }`}
              >
                {shortlistCount}
              </span>
            </button>

            {isShortlistActive && (
              <button
                onClick={() => setIsShortlistActive(false)}
                className="mox-btn text-xs py-2 px-2.5 text-[#64748B] hover:text-[#DC2626]"
                title="Clear shortlist filter"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Toolbar Action Row (Clean, minimal, 16px table controls) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E8EC]">
          <div className="flex items-center gap-2">
            <button onClick={handleAddRow} className="mox-btn text-xs font-semibold py-1.5 px-3">
              <Plus className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Add Row</span>
            </button>
            <button onClick={() => setShowAddColumnModal(true)} className="mox-btn text-xs font-semibold py-1.5 px-3">
              <Plus className="w-3.5 h-3.5 text-[#0EA5C9]" />
              <span>Add Column</span>
            </button>

            {anomalyRowIds.size > 0 && (
              <span className="mox-pill mox-pill-red text-xs px-2.5 py-1">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {anomalyRowIds.size} Suspicious Row{anomalyRowIds.size === 1 ? '' : 's'} (&gt;5x avg)
              </span>
            )}
          </div>

          {/* Clean Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportXLSX}
              className="mox-btn mox-btn-ok text-xs font-bold py-1.5 px-3.5 shadow-sm"
              title="Download as Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="mox-btn mox-btn-cy text-xs font-bold py-1.5 px-3.5 shadow-sm"
              title="Download as CSV (.csv)"
            >
              <FileText className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleCopyJSON}
              className="mox-btn text-xs font-semibold py-1.5 px-3 text-[#0F172A]"
              title="Copy JSON array"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span className="text-[#16A34A]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. RESPONSIVE TABLE WITH LARGE FONT SIZES (>=16px) */}
      <div className="mox-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[700px]">
            {/* Table Header with 16px Font */}
            <thead className="sticky top-0 z-20 bg-[#FAFBFC] border-b border-[#E5E8EC]">
              <tr>
                <th className="py-3 px-3 w-12 text-center text-[#64748B] font-mono text-sm border-r border-[#E5E8EC]">
                  #
                </th>
                {columns.map((colKey) => (
                  <th
                    key={colKey}
                    className="py-3 px-4 font-bold text-base text-[#0F172A] border-r border-[#E5E8EC] last:border-r-0 group/col relative min-w-[150px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {renamingColumn === colKey ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={columnRenameValue}
                            onChange={(e) => setColumnRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameColumn(colKey);
                              if (e.key === 'Escape') setRenamingColumn(null);
                            }}
                            autoFocus
                            className="mox-input py-1 px-2 text-sm w-28"
                          />
                          <button onClick={() => handleSaveRenameColumn(colKey)} className="text-[#16A34A]">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 cursor-pointer select-none hover:text-[#0EA5C9] transition-colors"
                          onClick={() => handleSort(colKey)}
                          title="Click to sort"
                        >
                          <span className="capitalize">{colKey.replace(/_/g, ' ')}</span>
                          {sortConfig?.key === colKey ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="w-4 h-4 text-[#0EA5C9]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#0EA5C9]" />
                            )
                          ) : (
                            <span className="opacity-0 group-hover/col:opacity-40 text-[#94A3B8]">↕</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setRenamingColumn(colKey);
                            setColumnRenameValue(colKey);
                          }}
                          className="text-[#94A3B8] hover:text-[#0F172A] p-0.5 rounded"
                          title="Rename column"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {columns.length > 1 && (
                          <button
                            onClick={() => handleDeleteColumn(colKey)}
                            className="text-[#94A3B8] hover:text-[#DC2626] p-0.5 rounded"
                            title="Delete column"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
                <th className="py-3 px-3 w-16 text-center text-[#64748B] text-sm">Action</th>
              </tr>
            </thead>

            {/* Table Body with 16px Font Size */}
            <tbody className="divide-y divide-[#F0F2F5]">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-14 text-center text-base text-[#64748B]">
                    {isShortlistActive
                      ? 'No items found matching the Low Stock (<10) or Expiring Soon filter.'
                      : 'No records matching the search query.'}
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, index) => {
                  const isAnomaly = anomalyRowIds.has(row._id);
                  const status = rowStatusMap.get(row._id);
                  const isLow = status?.isLowStock;
                  const isExpiring = status?.isExpiringSoon;

                  return (
                    <tr
                      key={row._id}
                      className={`transition-colors group/row ${
                        isAnomaly
                          ? 'bg-[#FEF4F4] hover:bg-[#FEEAEA] border-l-4 border-l-[#DC2626]'
                          : isExpiring && isLow
                          ? 'bg-[#FFF7ED] hover:bg-[#FFEDD5] border-l-4 border-l-[#EA580C]'
                          : isExpiring
                          ? 'bg-[#FEFCE8] hover:bg-[#FEF9C3] border-l-4 border-l-[#F59E0B]'
                          : isLow
                          ? 'bg-[#EFF6FF] hover:bg-[#DBEAFE] border-l-4 border-l-[#3B82F6]'
                          : 'hover:bg-[#F7FBFD]'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-3 px-3 text-center text-[#64748B] font-mono text-sm border-r border-[#E5E8EC] bg-[#FAFBFC]">
                        {index + 1}
                      </td>

                      {/* Dynamic Cells: 16px Font */}
                      {columns.map((colKey) => {
                        const isEditing = editingCell?.rowId === row._id && editingCell?.colKey === colKey;
                        const rawValue = row[colKey];
                        const displayValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';

                        const isAmountCell = amountCol === colKey;
                        const isQtyCell = quantityCol === colKey;
                        const isExpCell = expiryCol === colKey;

                        return (
                          <td
                            key={colKey}
                            onClick={() => {
                              if (!isEditing) {
                                setEditingCell({ rowId: row._id, colKey });
                                setCellEditValue(displayValue);
                              }
                            }}
                            className={`py-3 px-4 border-r border-[#E5E8EC] last:border-r-0 cursor-pointer text-base transition-colors ${
                              isEditing ? 'bg-[#F2FBFE] ring-2 ring-[#0EA5C9] ring-inset' : ''
                            }`}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={cellEditValue}
                                onChange={(e) => setCellEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCell(row._id, colKey);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                onBlur={() => handleSaveCell(row._id, colKey)}
                                autoFocus
                                className="w-full mox-input py-1 px-2 text-base"
                              />
                            ) : (
                              <div className="flex items-center justify-between gap-2 min-h-[24px]">
                                <span
                                  className={`truncate text-base ${
                                    isAnomaly && isAmountCell
                                      ? 'text-[#DC2626] font-extrabold'
                                      : isLow && isQtyCell
                                      ? 'text-[#EA580C] font-extrabold'
                                      : isExpiring && isExpCell
                                      ? 'text-[#B45309] font-bold'
                                      : !displayValue
                                      ? 'text-[#94A3B8] italic'
                                      : 'text-[#0F172A] font-medium'
                                  }`}
                                >
                                  {displayValue || '—'}
                                </span>

                                {/* Badges */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {isAnomaly && isAmountCell && (
                                    <span className="mox-pill mox-pill-red text-xs px-2 py-0.5 font-bold">
                                      ⚠️ Suspicious Amount
                                    </span>
                                  )}

                                  {isQtyCell && isLow && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#FFEDD5] text-[#C2410C] border border-[#FDBA74]">
                                      <PackageX className="w-3 h-3" />
                                      Low Stock (&lt;10)
                                    </span>
                                  )}

                                  {isExpCell && isExpiring && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                                      <Clock className="w-3 h-3" />
                                      {status?.daysRemaining !== null && status.daysRemaining <= 0
                                        ? 'Expired'
                                        : 'Expiring Soon'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Delete Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteRow(row._id)}
                          className="opacity-0 group-hover/row:opacity-100 p-1 text-[#94A3B8] hover:text-[#DC2626] rounded transition-all"
                          title="Delete row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Stats */}
        <div className="py-3 px-4 bg-[#FAFBFC] border-t border-[#E5E8EC] flex flex-wrap items-center justify-between gap-3 text-sm text-[#64748B]">
          <div className="flex items-center gap-4">
            <span>
              Showing: <strong className="text-[#0F172A]">{displayedRows.length}</strong> of {data.length} records
            </span>
            {isShortlistActive && (
              <span className="text-[#EA580C] font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Shortlist Active (Low Stock / Expiring Soon)
              </span>
            )}
            {searchQuery && (
              <span className="text-[#0EA5C9] font-medium">
                Matching &quot;{searchQuery}&quot;
              </span>
            )}
          </div>
          <div className="text-xs text-[#94A3B8]">Double-click or tap cell to edit value</div>
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2540]/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-white border border-[#E5E8EC] p-5 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-[#0F172A] mb-1">Add New Column</h3>
            <form onSubmit={handleAddColumn} className="space-y-3 mt-3">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column Name (e.g. Expiry Date)"
                autoFocus
                className="mox-input text-base"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddColumnModal(false)}
                  className="mox-btn text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newColumnName.trim()}
                  className="mox-btn mox-btn-pri text-xs py-1.5 px-4 disabled:opacity-50"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
