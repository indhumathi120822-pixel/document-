import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import UploadZone, { SelectedFileMeta } from './components/UploadZone';
import DataTable, { DataRow } from './components/DataTable';
import DashboardCharts from './components/DashboardCharts';
import HistoryPanel, { HistoryItem } from './components/HistoryPanel';
import { parseFileLocally } from './utils/localParser';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

const STORAGE_KEY = 'documind_history_v1';

// Pre-packaged inventory datasets with Expiry Dates & Quantities
const SAMPLES: Record<
  'invoice' | 'inventory' | 'payroll',
  { filename: string; columns: string[]; rows: Record<string, string>[] }
> = {
  inventory: {
    filename: 'Pharmaceutical_Warehouse_Stock_Q4.png',
    columns: ['Item_Code', 'Product_Name', 'Batch_No', 'Quantity', 'Expiry_Date', 'Unit_Price', 'Total_Amount'],
    rows: [
      {
        Item_Code: 'MED-104',
        Product_Name: 'Amoxicillin Trihydrate 500mg (Cap)',
        Batch_No: 'BAT-2026-90',
        Quantity: '4', // Low stock (<10)
        Expiry_Date: '2026-11-28', // Expiring in ~1 month (Within 3 months)
        Unit_Price: '$18.50',
        Total_Amount: '$74.00',
      },
      {
        Item_Code: 'MED-208',
        Product_Name: 'Ciprofloxacin IV Infusion 200mg',
        Batch_No: 'BAT-2026-44',
        Quantity: '6', // Low stock (<10)
        Expiry_Date: '2026-12-15', // Expiring in ~2 months (Within 3 months)
        Unit_Price: '$32.00',
        Total_Amount: '$192.00',
      },
      {
        Item_Code: 'MED-312',
        Product_Name: 'Paracetamol 650mg Fast-Action',
        Batch_No: 'BAT-2027-11',
        Quantity: '180',
        Expiry_Date: '2027-08-30',
        Unit_Price: '$4.20',
        Total_Amount: '$756.00',
      },
      {
        Item_Code: 'MED-415',
        Product_Name: 'Insulin Glargine Pen Cartridges',
        Batch_No: 'BAT-2026-88',
        Quantity: '2', // Low stock (<10)
        Expiry_Date: '2027-01-10', // Expiring in ~2.5 months (Within 3 months)
        Unit_Price: '$85.00',
        Total_Amount: '$170.00',
      },
      {
        Item_Code: 'MED-520',
        Product_Name: 'Automated Cryogenic Cold Storage Chamber',
        Batch_No: 'EQP-2026-01',
        Quantity: '1',
        Expiry_Date: '2030-12-31',
        Unit_Price: '$48,000.00',
        Total_Amount: '$48,000.00', // Anomaly: 5x higher than average
      },
      {
        Item_Code: 'MED-630',
        Product_Name: 'Sterile Surgical Glove Sets (L)',
        Batch_No: 'BAT-2027-52',
        Quantity: '420',
        Expiry_Date: '2028-04-15',
        Unit_Price: '$2.50',
        Total_Amount: '$1,050.00',
      },
      {
        Item_Code: 'MED-744',
        Product_Name: 'Pediatric Oral Rehydration Salts',
        Batch_No: 'BAT-2026-71',
        Quantity: '8', // Low stock (<10)
        Expiry_Date: '2026-12-05', // Expiring in ~1.5 months (Within 3 months)
        Unit_Price: '$3.80',
        Total_Amount: '$30.40',
      },
    ],
  },
  invoice: {
    filename: 'Commercial_Supplies_Invoice.pdf',
    columns: ['Item_No', 'Product_Name', 'Quantity', 'Expiry_Date', 'Unit_Price', 'Total_Amount'],
    rows: [
      {
        Item_No: 'SUP-01',
        Product_Name: 'Thermal Barcode Labels (Rolls)',
        Quantity: '5', // Low stock (<10)
        Expiry_Date: '2026-11-30', // Within 3 months
        Unit_Price: '$24.00',
        Total_Amount: '$120.00',
      },
      {
        Item_No: 'SUP-02',
        Product_Name: 'High-Purity Isopropyl Alcohol 99%',
        Quantity: '85',
        Expiry_Date: '2027-05-20',
        Unit_Price: '$15.00',
        Total_Amount: '$1,275.00',
      },
      {
        Item_No: 'SUP-03',
        Product_Name: 'Microscope Immersion Oil Specimen Kit',
        Quantity: '3', // Low stock (<10)
        Expiry_Date: '2026-12-10', // Within 3 months
        Unit_Price: '$45.00',
        Total_Amount: '$135.00',
      },
      {
        Item_No: 'SUP-04',
        Product_Name: 'Automated High-Throughput Spectrometer',
        Quantity: '1',
        Expiry_Date: '2032-01-01',
        Unit_Price: '$35,000.00',
        Total_Amount: '$35,000.00',
      },
    ],
  },
  payroll: {
    filename: 'Executive_Operations_Ledger.pdf',
    columns: ['Employee_ID', 'Product_Name', 'Department', 'Quantity', 'Expiry_Date', 'Total_Amount'],
    rows: [
      {
        Employee_ID: 'EMP-9021',
        Product_Name: 'Dr. Evelyn Vasquez (Lead Chemist)',
        Department: 'R&D Lab',
        Quantity: '1',
        Expiry_Date: '2026-11-15',
        Total_Amount: '$14,500.00',
      },
      {
        Employee_ID: 'EMP-8842',
        Product_Name: 'Marcus Sterling (QA Manager)',
        Department: 'Quality Assurance',
        Quantity: '1',
        Expiry_Date: '2027-04-30',
        Total_Amount: '$12,800.00',
      },
    ],
  },
};

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileMeta[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>('');
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [activeDocName, setActiveDocName] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistoryItems(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Failed to parse history:', err);
    }
  }, []);

  const saveToHistory = (item: HistoryItem) => {
    setHistoryItems((prev) => {
      const filtered = prev.filter((h) => h.id !== item.id);
      const updated = [item, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHistoryItems([]);
      showNotification('info', 'History cleared.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistoryItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
      }
      return updated;
    });
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // FEATURE 4: Instant Local Parsing for Imports (Zero AI Delay)
  const handleImportLocal = async (file: File) => {
    const startTime = performance.now();
    try {
      const { rows, columns: parsedCols, filename } = await parseFileLocally(file);
      const elapsed = Math.round(performance.now() - startTime);

      setExtractedData(rows);
      setColumns(parsedCols);
      setActiveDocName(filename);
      setSelectedFiles([]);

      const historyRecord: HistoryItem = {
        id: `import-${Date.now()}`,
        filename,
        extractedAt: new Date().toISOString(),
        data: rows,
        columns: parsedCols,
        isPDF: false,
      };
      saveToHistory(historyRecord);

      showNotification('success', `⚡ Imported ${rows.length} rows instantly (${elapsed}ms) with zero AI delay!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file locally.';
      showNotification('error', `Import error: ${msg}`);
    }
  };

  // High-speed sequential extraction with Flash model & canvas compression
  const handleExtractAll = async () => {
    if (selectedFiles.length === 0 || isExtracting) return;

    setIsExtracting(true);
    setNotification(null);
    setProcessedCount(0);

    const mergedRows: DataRow[] = [];
    const mergedColsSet = new Set<string>();

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const fileMeta = selectedFiles[i];
        setCurrentProcessingFile(fileMeta.name);
        setProcessedCount(i);

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Data: fileMeta.base64Data,
            mimeType: fileMeta.mimeType,
            filename: fileMeta.name,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) continue;

        const rows: DataRow[] = result.data || [];
        const cols: string[] = result.columns || [];

        if (selectedFiles.length > 1) {
          mergedColsSet.add('Source_Document');
        }

        cols.forEach((c) => mergedColsSet.add(c));

        rows.forEach((row, rowIdx) => {
          const newRow: DataRow = {
            ...row,
            _id: `batch-${i}-${rowIdx}-${Date.now()}`,
          };
          if (selectedFiles.length > 1) {
            newRow.Source_Document = fileMeta.name;
          }
          mergedRows.push(newRow);
        });
      }

      if (mergedRows.length === 0) {
        showNotification('info', 'No tabular data was detected in the uploaded file(s).');
        return;
      }

      const finalColumns = Array.from(mergedColsSet);
      const normalizedMergedRows = mergedRows.map((r) => {
        const fullRow: DataRow = { _id: r._id };
        finalColumns.forEach((c) => {
          fullRow[c] = r[c] !== undefined && r[c] !== null ? r[c] : '';
        });
        return fullRow;
      });

      const batchTitle =
        selectedFiles.length === 1
          ? selectedFiles[0].name
          : `Extraction_${selectedFiles.length}_Files`;

      setExtractedData(normalizedMergedRows);
      setColumns(finalColumns);
      setActiveDocName(batchTitle);

      const historyRecord: HistoryItem = {
        id: `ext-${Date.now()}`,
        filename: batchTitle,
        extractedAt: new Date().toISOString(),
        data: normalizedMergedRows,
        columns: finalColumns,
        isPDF: selectedFiles.some((f) => f.isPDF),
      };
      saveToHistory(historyRecord);

      showNotification('success', `Extracted ${normalizedMergedRows.length} rows successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Extraction error.';
      showNotification('error', `Extraction failed: ${msg}`);
    } finally {
      setIsExtracting(false);
      setCurrentProcessingFile('');
    }
  };

  const handleLoadSample = (sampleType: 'invoice' | 'inventory' | 'payroll') => {
    if (isExtracting) return;
    const sample = SAMPLES[sampleType];
    const formattedRows: DataRow[] = sample.rows.map((row, idx) => ({
      _id: `sample-${sampleType}-${idx}-${Date.now()}`,
      ...row,
    }));

    setExtractedData(formattedRows);
    setColumns(sample.columns);
    setActiveDocName(sample.filename);
    setSelectedFiles([]);

    const historyRecord: HistoryItem = {
      id: `sample-${Date.now()}`,
      filename: sample.filename,
      extractedAt: new Date().toISOString(),
      data: formattedRows,
      columns: sample.columns,
      isPDF: sample.filename.endsWith('.pdf'),
    };
    saveToHistory(historyRecord);

    showNotification('success', `⚡ Loaded "${sample.filename}" with ${formattedRows.length} items.`);
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    if (isExtracting) return;
    setExtractedData(item.data);
    setColumns(item.columns);
    setActiveDocName(item.filename);
    setSelectedFiles([]);
    showNotification('info', `Loaded "${item.filename}" from history.`);
  };

  const handleReset = () => {
    if (isExtracting) return;
    setExtractedData([]);
    setColumns([]);
    setSelectedFiles([]);
    setActiveDocName('');
    showNotification('info', 'Workspace reset.');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0F172A] flex flex-col font-sans text-base">
      {/* Top Navbar */}
      <Navbar
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={historyItems.length}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        hasData={extractedData.length > 0}
        onImportLocal={handleImportLocal}
        isExtracting={isExtracting}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2 duration-150">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-bold ${
              notification.type === 'success'
                ? 'bg-[#15803D] text-white'
                : notification.type === 'error'
                ? 'bg-[#DC2626] text-white'
                : 'bg-[#0B2540] text-white'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
            {notification.type === 'info' && <Info className="w-5 h-5 text-[#0EA5C9]" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Minimal Clean Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E8EC] pb-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              Intelligent Document Extraction Portal
            </h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              High-speed tabular OCR with smart search, expiry shortlists, and Excel export.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="mox-pill mox-pill-cyan text-xs font-bold py-1 px-2.5">
              ⚡ Flash Engine Active
            </span>
          </div>
        </section>

        {/* Upload Zone (Feature 1: 1024px/0.6 compression, Feature 3: animated stages, Feature 4: local import) */}
        <section className="max-w-4xl mx-auto">
          <UploadZone
            selectedFiles={selectedFiles}
            onFilesSelect={(files) => setSelectedFiles(files)}
            onExtract={handleExtractAll}
            isExtracting={isExtracting}
            currentProcessingFile={currentProcessingFile}
            processedCount={processedCount}
            onImportLocal={handleImportLocal}
          />
        </section>

        {/* Feature 3: Engaging Skeleton Table while extracting */}
        {isExtracting && (
          <section className="mox-card p-5 space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-6 w-48 bg-[#E2E8F0] rounded-md" />
              <div className="h-5 w-24 bg-[#E2E8F0] rounded-full" />
            </div>
            <div className="h-10 w-full bg-[#F1F5F9] rounded-lg" />
            <div className="space-y-2">
              <div className="h-12 w-full bg-[#F8FAFC] rounded border border-[#E5E8EC]" />
              <div className="h-12 w-full bg-[#F8FAFC] rounded border border-[#E5E8EC]" />
              <div className="h-12 w-full bg-[#F8FAFC] rounded border border-[#E5E8EC]" />
              <div className="h-12 w-full bg-[#F8FAFC] rounded border border-[#E5E8EC]" />
            </div>
          </section>
        )}

        {/* Extracted Data Workspace */}
        {!isExtracting && extractedData.length > 0 && (
          <section className="space-y-4 pt-1 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0EA5C9]" />
                <h2 className="text-lg font-extrabold text-[#0F172A]">
                  Extracted Data: <span className="font-semibold text-[#64748B]">{activeDocName}</span>
                </h2>
              </div>
              <span className="text-sm font-bold text-[#16A34A]">{extractedData.length} records</span>
            </div>

            {/* Smart Search & 16px DataTable */}
            <DataTable
              data={extractedData}
              columns={columns}
              filename={activeDocName || 'DocuMind_Export'}
              onDataChange={(newData, newColumns) => {
                setExtractedData(newData);
                if (newColumns) setColumns(newColumns);
              }}
            />

            {/* Collapsible Visual Analytics (Hidden by default) */}
            <DashboardCharts data={extractedData} columns={columns} />
          </section>
        )}
      </main>

      {/* History Drawer */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        onLoadItem={handleLoadFromHistory}
        onDeleteItem={handleDeleteHistoryItem}
        onClearAll={handleClearHistory}
      />

      {/* Clean Footer */}
      <footer className="border-t border-[#E5E8EC] bg-white py-3 text-xs text-[#64748B] mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <span>DocuMind AI Portal • Fast Multimodal Extraction</span>
          <span className="text-[#94A3B8]">Excel & CSV SheetJS Export</span>
        </div>
      </footer>
    </div>
  );
}
