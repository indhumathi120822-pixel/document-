import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  History,
  Sparkles,
  RefreshCw,
  FileText,
  CheckCircle2,
  Upload,
} from 'lucide-react';

interface NavbarProps {
  onOpenHistory: () => void;
  historyCount: number;
  onLoadSample: (sampleType: 'invoice' | 'inventory' | 'payroll') => void;
  onReset: () => void;
  hasData: boolean;
  onImportLocal: (file: File) => void;
  isExtracting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenHistory,
  historyCount,
  onLoadSample,
  onReset,
  hasData,
  onImportLocal,
  isExtracting,
}) => {
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const navImportRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-40 w-full h-[54px] bg-[#0B2540] text-white border-b border-[#1E4264] flex items-center px-4 sm:px-6 shadow-sm">
      {/* Hidden input for local import */}
      <input
        ref={navImportRef}
        type="file"
        accept=".csv,.json,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImportLocal(file);
            e.target.value = '';
          }
        }}
      />

      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-[32px] h-[32px] rounded-lg bg-gradient-to-br from-[#0EA5C9] to-[#1B3F5E] flex items-center justify-center font-extrabold text-sm text-white shadow-sm select-none">
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wide text-white">DocuMind</span>
              <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-[#0EA5C9] text-white">
                AI
              </span>
              <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-[#1B3F5E] text-[#C9D6E3] border border-[#2B547A]">
                Flash Engine
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Feature 4: Local Import Button (Zero AI Delay) */}
          <button
            type="button"
            disabled={isExtracting}
            onClick={() => navImportRef.current?.click()}
            className="mox-btn text-xs py-1.5 px-3 bg-[#1B3F5E] hover:bg-[#234E75] text-white border-[#2A527A] cursor-pointer disabled:opacity-50"
            title="Import CSV or JSON directly into table (0ms delay)"
          >
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="hidden sm:inline">Import Data</span>
            <span className="sm:hidden">Import</span>
          </button>

          {/* Sample Loader Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
              disabled={isExtracting}
              className="mox-btn text-xs py-1.5 px-3 bg-[#1B3F5E] hover:bg-[#234E75] text-white border-[#2A527A] cursor-pointer disabled:opacity-50"
              title="Test with pre-configured sample documents"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="hidden sm:inline">Try Sample</span>
              <span className="sm:hidden">Samples</span>
            </button>

            {sampleMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSampleMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 rounded-lg bg-white border border-[#E5E8EC] shadow-xl p-1.5 z-40 animate-in fade-in slide-in-from-top-1 text-[#0F172A]">
                  <div className="px-2.5 py-1.5 text-[10.5px] font-bold text-[#64748B] uppercase tracking-wider">
                    Quick Sample Datasets
                  </div>
                  <button
                    onClick={() => {
                      onLoadSample('inventory');
                      setSampleMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-md text-xs hover:bg-[#F4F6F9] text-[#0F172A] transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                    <div>
                      <div className="font-semibold text-sm">Pharma Inventory (Expiry Dates)</div>
                      <div className="text-[11px] text-[#64748B]">Low stock (&lt;10) &amp; upcoming expiries</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onLoadSample('invoice');
                      setSampleMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-md text-xs hover:bg-[#F4F6F9] text-[#0F172A] transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[#0EA5C9]" />
                    <div>
                      <div className="font-semibold text-sm">Commercial Invoice</div>
                      <div className="text-[11px] text-[#64748B]">Items, quantities &amp; total prices</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onLoadSample('payroll');
                      setSampleMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-md text-xs hover:bg-[#F4F6F9] text-[#0F172A] transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />
                    <div>
                      <div className="font-semibold text-sm">Operations Ledger</div>
                      <div className="text-[11px] text-[#64748B]">Employees &amp; contract dates</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Reset Button */}
          {hasData && (
            <button
              onClick={onReset}
              disabled={isExtracting}
              className="mox-btn text-xs py-1.5 px-2.5 bg-transparent hover:bg-[#15385A] text-[#C9D6E3] hover:text-white border-transparent cursor-pointer disabled:opacity-50"
              title="Clear current extraction"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            disabled={isExtracting}
            className="mox-btn text-xs py-1.5 px-3 bg-[#1B3F5E] hover:bg-[#234E75] text-white border-[#2A527A] cursor-pointer disabled:opacity-50"
            title="View saved extractions"
          >
            <History className="w-3.5 h-3.5 text-[#0EA5C9]" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#0EA5C9] text-white">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
