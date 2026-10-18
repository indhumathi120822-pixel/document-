import React from 'react';
import {
  X,
  History,
  FileSpreadsheet,
  FileText,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Download,
} from 'lucide-react';
import { DataRow } from './DataTable';
import { exportToExcel } from '../utils/excelExport';

export interface HistoryItem {
  id: string;
  filename: string;
  extractedAt: string;
  data: DataRow[];
  columns: string[];
  isPDF: boolean;
  mimeType?: string;
  previewUrl?: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: HistoryItem[];
  onLoadItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  historyItems,
  onLoadItem,
  onDeleteItem,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B2540]/50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#E5E8EC] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[#E5E8EC] flex items-center justify-between bg-[#F8FAFC]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E0F4FA] border border-[#BFE3EE] flex items-center justify-center text-[#0EA5C9]">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Extraction History</h2>
                <p className="text-[11px] text-[#64748B]">
                  {historyItems.length} saved session{historyItems.length === 1 ? '' : 's'} in localStorage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {historyItems.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all extraction history from local storage?')) {
                      onClearAll();
                    }
                  }}
                  className="text-xs text-[#DC2626] hover:bg-[#FDECEC] px-2 py-1 rounded transition-colors font-medium"
                  title="Clear all"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of Extractions */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {historyItems.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E5E8EC] flex items-center justify-center mx-auto mb-3 text-[#94A3B8]">
                  <History className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-[#0F172A] mb-1">No Past Extractions</h4>
                <p className="text-xs text-[#64748B] max-w-xs mx-auto">
                  Documents you upload and extract are saved locally in browser storage for instant reload and re-export.
                </p>
              </div>
            ) : (
              historyItems.map((item) => (
                <div
                  key={item.id}
                  className="mox-card p-3.5 hover:border-[#0EA5C9] transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.isPDF ? (
                        <FileText className="w-4 h-4 text-[#DC2626] shrink-0" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-[#0EA5C9] shrink-0" />
                      )}
                      <h4
                        className="text-xs font-bold text-[#0F172A] truncate max-w-[200px]"
                        title={item.filename}
                      >
                        {item.filename}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => exportToExcel(item.data, `${item.filename}_DocuMind`)}
                        className="p-1 text-[#64748B] hover:text-[#16A34A] rounded transition-colors"
                        title="Download XLSX directly"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded transition-colors"
                        title="Delete from history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata pills */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] mb-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#94A3B8]" />
                      {formatDate(item.extractedAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#94A3B8]" />
                      {item.data.length} rows, {item.columns.length} cols
                    </span>
                  </div>

                  {/* Columns preview */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.columns.slice(0, 4).map((col) => (
                      <span
                        key={col}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono border border-[#E2E8F0]"
                      >
                        {col}
                      </span>
                    ))}
                    {item.columns.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]">
                        +{item.columns.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Load action button */}
                  <button
                    onClick={() => {
                      onLoadItem(item);
                      onClose();
                    }}
                    className="w-full mox-btn text-xs py-1.5 justify-center hover:border-[#0EA5C9] text-[#0B7C99] bg-[#E0F4FA] border-[#BFE3EE]"
                  >
                    <span>Load into Workspace</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 border-t border-[#E5E8EC] bg-[#F8FAFC] text-center text-[11px] text-[#64748B]">
            Stored locally in browser storage (Private & Confidential)
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
