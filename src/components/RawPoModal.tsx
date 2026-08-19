import React, { useState, useEffect } from 'react';
import { Code2, Copy, Check, AlertCircle, Save } from 'lucide-react';
import { PoHeader, PoEntry, Workspace } from '../types/gettext';
import { serializePoFile, parsePoContent } from '../lib/poParser';
import { JsonFormat, serializeTranslationsCsv, serializeTranslationsJson } from '../lib/translationFormats';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';
import { DropdownMenu } from './ui/DropdownMenu';

interface RawPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  header: PoHeader;
  entries: PoEntry[];
  isPot?: boolean;
  onSaveRaw: (header: PoHeader, entries: PoEntry[]) => void;
  workspace: Workspace;
  csvPluralSuffix?: string;
}

export const RawPoModal: React.FC<RawPoModalProps> = ({
  isOpen,
  onClose,
  filename,
  header,
  entries,
  isPot = false,
  onSaveRaw,
  workspace,
  csvPluralSuffix = '_P%d',
}) => {
  const [format, setFormat] = useState<'po' | 'json' | 'csv'>('po');
  const [jsonFormat, setJsonFormat] = useState<JsonFormat>('key-first');
  const [rawText, setRawText] = useState('');
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormat('po');
      setRawText(serializePoFile(header, entries, isPot));
      setParseError(null);
    }
  }, [header, entries, isPot, isOpen]);

  const switchFormat = (nextFormat: 'po' | 'json' | 'csv') => {
    setFormat(nextFormat);
    if (nextFormat === 'po') setRawText(serializePoFile(header, entries, isPot));
    if (nextFormat === 'csv') setRawText(serializeTranslationsCsv(workspace, csvPluralSuffix));
    if (nextFormat === 'json') setRawText(serializeTranslationsJson(workspace, csvPluralSuffix, jsonFormat));
    setParseError(null);
  };

  const switchJsonFormat = (nextFormat: JsonFormat) => {
    setJsonFormat(nextFormat);
    setRawText(serializeTranslationsJson(workspace, csvPluralSuffix, nextFormat));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (format !== 'po') return;
    try {
      const parsed = parsePoContent(rawText);
      onSaveRaw(parsed.header, parsed.entries);
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse raw PO syntax.');
    }
  };

  const modalFooter = (
    <div className="w-full flex items-center justify-between text-xs">
      <span className="text-[#64748B] text-[11px] hidden sm:inline">
          {format === 'po' ? t('rawPo.hint') : t('rawPo.previewHint')}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
        >
          {t('common.cancel')}
        </button>
        {format === 'po' && <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{t('rawPo.save')}</span>
        </button>}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('rawPo.title')}: ${filename}`}
      subtitle={t('rawPo.subtitle').replace('${count}', entries.length.toString())}
      icon={<Code2 className="w-4 h-4" />}
      maxWidth="max-w-4xl"
      footer={modalFooter}
    >
      <div className="space-y-3 flex flex-col w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded border border-[#2D3139] bg-[#090B0E] p-0.5">
            {(['po', 'json', 'csv'] as const).map((option) => (
              <button key={option} onClick={() => switchFormat(option)} className={`px-2.5 py-1 text-xs rounded cursor-pointer ${format === option ? 'bg-[#1E293B] text-white' : 'text-[#94A3B8] hover:text-white'}`}>
                {option === 'po' ? 'PO' : option.toUpperCase()}
              </button>
            ))}
          </div>
          {format === 'json' && (
            <DropdownMenu value={jsonFormat} onChange={switchJsonFormat} options={[{ value: 'key-first', label: t('transfer.jsonKeyFirst') }, { value: 'language-first', label: t('transfer.jsonLanguageFirst') }]} className="min-w-[170px]" />
          )}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('editor.copied') : t('editor.copy')}</span>
          </button>

        </div>

        <textarea
          value={rawText}
          onChange={(e) => {
            if (format !== 'po') return;
            setRawText(e.target.value);
            setParseError(null);
          }}
          readOnly={format !== 'po'}
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