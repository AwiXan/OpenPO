import React, { useState, useEffect } from 'react';
import { X, Code2, Copy, Check, Download, AlertCircle, Save } from 'lucide-react';
import { PoHeader, PoEntry } from '../types/gettext';
import { serializePoFile, parsePoContent } from '../lib/poParser';

interface RawPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  header: PoHeader;
  entries: PoEntry[];
  isPot?: boolean;
  onSaveRaw: (header: PoHeader, entries: PoEntry[]) => void;
}

export const RawPoModal: React.FC<RawPoModalProps> = ({
  isOpen,
  onClose,
  filename,
  header,
  entries,
  isPot = false,
  onSaveRaw,
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const text = serializePoFile(header, entries, isPot);
    setRawText(text);
    setParseError(null);
  }, [header, entries, isPot]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    try {
      const parsed = parsePoContent(rawText);
      onSaveRaw(parsed.header, parsed.entries);
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse raw PO syntax.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-lg w-full max-w-4xl h-[85vh] shadow-2xl text-[#E2E8F0] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2D3139] flex items-center justify-between bg-[#090B0E]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#3B82F61A] text-[#3B82F6]">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Raw Gettext Source: {filename}</h3>
              <p className="text-[11px] text-[#64748B] font-mono">
                {entries.length} entries • UTF-8 Gettext format
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1 border border-[#2D3139] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-2.5 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1 border border-[#2D3139] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1C2128] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4 bg-[#090B0E] flex flex-col overflow-hidden">
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setParseError(null);
            }}
            spellCheck={false}
            className="flex-1 w-full bg-[#16191E] border border-[#2D3139] rounded p-3.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-none leading-relaxed select-text"
          />

          {parseError && (
            <div className="mt-2 p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2D3139] bg-[#090B0E] flex items-center justify-between text-xs">
          <span className="text-[#64748B] text-[11px]">
            Directly edit raw PO blocks. Click "Save & Sync Workspace" to parse back into state.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Sync Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
