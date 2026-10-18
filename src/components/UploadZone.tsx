import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  Files,
  FileSpreadsheet,
} from 'lucide-react';
import { compressImageFile } from '../utils/imageCompressor';

export interface SelectedFileMeta {
  file: File;
  name: string;
  size: number;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
  isPDF: boolean;
  status?: 'pending' | 'processing' | 'done' | 'error';
}

interface UploadZoneProps {
  onFilesSelect: (files: SelectedFileMeta[]) => void;
  selectedFiles: SelectedFileMeta[];
  onExtract: () => void;
  isExtracting: boolean;
  currentProcessingFile?: string;
  processedCount?: number;
  onImportLocal: (file: File) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelect,
  selectedFiles,
  onExtract,
  isExtracting,
  currentProcessingFile,
  processedCount = 0,
  onImportLocal,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<'compressing' | 'reading' | 'structuring'>('compressing');
  const [progressPercent, setProgressPercent] = useState(15);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Engaging animated loading stages: "Compressing image..." -> "AI is reading..." -> "Structuring data..."
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;

    if (isExtracting) {
      setLoadingStage('compressing');
      setProgressPercent(20);

      t1 = setTimeout(() => {
        setLoadingStage('reading');
        setProgressPercent(60);
      }, 700);

      t2 = setTimeout(() => {
        setLoadingStage('structuring');
        setProgressPercent(90);
      }, 1600);
    } else {
      setProgressPercent(15);
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [isExtracting]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setErrorMessage(null);

      if (rejectedFiles.length > 0) {
        setErrorMessage('Some files were rejected. Please select PDF, PNG, JPG, or WEBP under 25MB.');
      }

      if (acceptedFiles.length === 0) return;

      // Check if dropped file is CSV or JSON: trigger INSTANT local parsing with zero delay!
      const firstFile = acceptedFiles[0];
      const isLocalFormat =
        firstFile.name.toLowerCase().endsWith('.csv') ||
        firstFile.name.toLowerCase().endsWith('.json') ||
        firstFile.name.toLowerCase().endsWith('.xlsx');

      if (isLocalFormat && acceptedFiles.length === 1) {
        onImportLocal(firstFile);
        return;
      }

      try {
        const filePromises = acceptedFiles.map(async (file) => {
          const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
          // Heavy compression (1024px max, 0.6 quality)
          const { base64Data, mimeType } = await compressImageFile(file);
          const previewUrl = isPDF ? '' : URL.createObjectURL(file);

          return {
            file,
            name: file.name,
            size: file.size,
            mimeType,
            base64Data,
            previewUrl,
            isPDF,
            status: 'pending' as const,
          };
        });

        const newMetas = await Promise.all(filePromises);
        const existingNames = new Set(selectedFiles.map((f) => f.name));
        const filtered = newMetas.filter((f) => !existingNames.has(f.name));
        onFilesSelect([...selectedFiles, ...filtered]);
      } catch (err) {
        console.error(err);
        setErrorMessage('Failed to read and optimize uploaded files.');
      }
    },
    [selectedFiles, onFilesSelect, onImportLocal]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    maxSize: 25 * 1024 * 1024,
    disabled: isExtracting,
    multiple: true,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleRemoveFile = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesSelect(selectedFiles.filter((f) => f.name !== fileName));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesSelect([]);
    setErrorMessage(null);
  };

  const stageTextMap = {
    compressing: 'Compressing image (1024px, 0.6 quality)...',
    reading: 'AI is reading document layout...',
    structuring: 'Structuring data into verified rows...',
  };

  return (
    <div className="w-full space-y-3">
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-[#FEF4F4] border border-[#F7CACA] text-[#B91C1C] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-[#B91C1C] hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hidden file input for instant Local Import */}
      <input
        ref={importInputRef}
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

      {/* Main Drag & Drop / Preview Card */}
      <div
        {...getRootProps()}
        className={`relative group rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer overflow-hidden bg-white ${
          isExtracting
            ? 'pointer-events-none border-[#0EA5C9] bg-[#F2FBFE]'
            : isDragReject
            ? 'border-[#DC2626] bg-[#FEF4F4]'
            : isDragActive
            ? 'border-[#0EA5C9] bg-[#F2FBFE]'
            : selectedFiles.length > 0
            ? 'border-[#CBD5E1] hover:border-[#0EA5C9]'
            : 'border-[#CBD5E1] hover:border-[#0EA5C9] hover:bg-[#F8FAFC]'
        }`}
      >
        <input {...getInputProps()} />

        {/* Animated Scanner Laser */}
        {isExtracting && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-[#0EA5C9] to-transparent shadow-[0_0_16px_#0EA5C9] animate-scan" />
            <div className="absolute inset-0 bg-[#0EA5C9]/5 animate-pulse" />
          </div>
        )}

        {isExtracting ? (
          /* Feature 3: Skeleton / Engaging Multi-Stage Progress Animation */
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[#E0F4FA] border-2 border-[#0EA5C9] flex items-center justify-center shadow-lg shadow-[#0EA5C9]/20">
                <Loader2 className="w-9 h-9 text-[#0EA5C9] animate-spin" />
              </div>
              <Sparkles className="w-5 h-5 text-[#F59E0B] absolute -top-1 -right-1 animate-bounce" />
            </div>

            {/* Dynamic Stage Text */}
            <h3 className="text-xl font-extrabold text-[#0F172A] mb-1.5">
              {stageTextMap[loadingStage]}
            </h3>

            <p className="text-sm text-[#64748B] max-w-md mb-4 font-medium">
              {currentProcessingFile
                ? `Active document: "${currentProcessingFile}"`
                : 'Extracting product names, stock, and expiry dates via Gemini Flash...'}
            </p>

            {/* Stage Progress Bar */}
            <div className="w-80 h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#0EA5C9] via-[#38BDF8] to-[#16A34A] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center gap-6 mt-3 text-xs text-[#64748B] font-medium">
              <span className={loadingStage === 'compressing' ? 'text-[#0EA5C9] font-bold' : ''}>
                1. Compress
              </span>
              <span>•</span>
              <span className={loadingStage === 'reading' ? 'text-[#0EA5C9] font-bold' : ''}>
                2. OCR Scan
              </span>
              <span>•</span>
              <span className={loadingStage === 'structuring' ? 'text-[#16A34A] font-bold' : ''}>
                3. Structure JSON
              </span>
            </div>
          </div>
        ) : selectedFiles.length > 0 ? (
          /* Files Queued State */
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E5E8EC]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#E0F4FA] border border-[#BFE3EE] flex items-center justify-center text-[#0EA5C9]">
                  <Files className="w-5 h-5 text-[#0EA5C9]" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#0F172A]">
                    {selectedFiles.length} Document{selectedFiles.length === 1 ? '' : 's'} Selected
                  </h4>
                  <p className="text-xs text-[#64748B]">Ready for fast extraction</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExtract();
                  }}
                  className="mox-btn mox-btn-cy text-sm font-bold py-2.5 px-5 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Extract Tabular Data</span>
                </button>

                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={handleClearAll}
                  className="mox-btn text-xs py-2 px-3 text-[#64748B] hover:text-[#DC2626] disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* List of Files */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[200px] overflow-y-auto">
              {selectedFiles.map((fileMeta, idx) => (
                <div
                  key={`${fileMeta.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E5E8EC] hover:border-[#0EA5C9] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {fileMeta.isPDF ? (
                      <div className="w-8 h-8 rounded bg-[#FDECEC] border border-[#FECACA] flex items-center justify-center text-[#DC2626] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#E0F4FA] border border-[#BFE3EE] overflow-hidden flex items-center justify-center shrink-0">
                        {fileMeta.previewUrl ? (
                          <img src={fileMeta.previewUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#0EA5C9]" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A] truncate" title={fileMeta.name}>
                        {fileMeta.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] font-mono">{formatFileSize(fileMeta.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {fileMeta.previewUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePreviewUrl(fileMeta.previewUrl);
                        }}
                        className="p-1 text-[#94A3B8] hover:text-[#0EA5C9] rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={(e) => handleRemoveFile(fileMeta.name, e)}
                      className="p-1 text-[#94A3B8] hover:text-[#DC2626] rounded disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty Drag & Drop State */
          <div className="py-10 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[#E0F4FA] border border-[#BFE3EE] flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6 text-[#0EA5C9]" />
            </div>

            <h3 className="text-base font-bold text-[#0F172A] mb-1">
              Drag & drop images/PDFs here, or <span className="text-[#0EA5C9] underline">browse</span>
            </h3>

            <p className="text-xs text-[#64748B] max-w-sm mb-4">
              Auto-compressed on canvas for instant upload and fast AI extraction.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {/* Feature 4: Zero AI Delay Import Button */}
              <button
                type="button"
                disabled={isExtracting}
                onClick={(e) => {
                  e.stopPropagation();
                  importInputRef.current?.click();
                }}
                className="mox-btn text-xs py-2 px-3.5 bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] shadow-xs font-bold"
                title="Instant frontend parsing with zero AI delay"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                <span>Import CSV / JSON (Instant)</span>
              </button>

              <button
                type="button"
                disabled={isExtracting}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await fetch('/samples/sample_invoice.svg');
                    const svgText = await res.text();
                    const base64 = btoa(unescape(encodeURIComponent(svgText)));
                    const base64Data = `data:image/svg+xml;base64,${base64}`;
                    const file = new File([svgText], 'Pharma_Inventory_Stock.svg', {
                      type: 'image/svg+xml',
                    });
                    onFilesSelect([
                      {
                        file,
                        name: 'Pharma_Inventory_Stock.svg',
                        size: svgText.length,
                        mimeType: 'image/svg+xml',
                        base64Data,
                        previewUrl: base64Data,
                        isPDF: false,
                        status: 'pending',
                      },
                    ]);
                  } catch (err) {
                    console.error('Failed to load sample document:', err);
                  }
                }}
                className="mox-btn mox-btn-pri text-xs py-2 px-3.5 shadow-sm font-bold disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Load Sample Inventory File</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activePreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2540]/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setActivePreviewUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white border border-[#E5E8EC] rounded-xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePreviewUrl(null)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-[#0B2540] text-white hover:bg-[#15385A]"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={activePreviewUrl}
              alt="Document Preview"
              className="max-h-[85vh] w-auto mx-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadZone;
