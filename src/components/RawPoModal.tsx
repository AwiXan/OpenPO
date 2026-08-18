import React, { useState, useEffect } from 'react';
import { Code2, Copy, Check, Download, AlertCircle, Save } from 'lucide-react';
import { PoHeader, PoEntry } from '../types/gettext';
import { serializePoFile, parsePoContent } from '../lib/poParser';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';

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
  const [rawText, setRawText] = useState('');
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const text = serializePoFile(header, entries, isPot);
      setRawText(text);
      setParseError(null);
    }
  }, [header, entries, isPot, isOpen]);

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

  const modalFooter = (
    <div className="w-full flex items-center justify-between text-xs">
      <span className="text-[#64748B] text-[11px] hidden sm:inline">
        {t('rawPo.hint')}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t('rawPo.save')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Raw Gettext Source: ${filename}`}
      subtitle={t('rawPo.subtitle').replace('${count}', entries.length.toString())}
      icon={<Code2 className="w-4 h-4" />}
      maxWidth="max-w-4xl"
      footer={modalFooter}
    >
      <div className="space-y-3 flex flex-col w-full">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('editor.copied') : t('editor.copy')}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>{t('rawPo.download')}</span>
          </button>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setParseError(null);
          }}
          spellCheck={false}
          className="w-full min-h-[50vh] bg-[#090B0E] border border-[#2D3139] rounded p-3.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-y leading-relaxed select-text custom-scrollbar"
        />

        {parseError && (
          <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};