import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Code2,
  Copy,
  Check,
  AlertCircle,
  Save,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Replace as ReplaceIcon,
  CaseSensitive,
} from 'lucide-react';
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

  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);


  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormat('po');
      setRawText(serializePoFile(header, entries, isPot));
      setParseError(null);
      setIsFindOpen(false);
      setIsReplaceOpen(false);
      setSearchQuery('');
    }
  }, [header, entries, isPot, isOpen]);


  const linesCount = useMemo(() => rawText.split('\n').length, [rawText]);


  const matches = useMemo(() => {
    if (!searchQuery) return [];
    const results: number[] = [];
    const target = matchCase ? rawText : rawText.toLowerCase();
    const query = matchCase ? searchQuery : searchQuery.toLowerCase();
    let pos = 0;
    while ((pos = target.indexOf(query, pos)) !== -1) {
      results.push(pos);
      pos += query.length;
    }
    return results;
  }, [rawText, searchQuery, matchCase]);

  const jumpToMatch = useCallback((index: number) => {
    if (matches.length === 0 || !textareaRef.current) return;
    const clampedIndex = (index + matches.length) % matches.length;
    setCurrentMatchIndex(clampedIndex);
    const start = matches[clampedIndex];
    const end = start + searchQuery.length;

    const textarea = textareaRef.current;
    textarea.focus();
    textarea.setSelectionRange(start, end);

    const textBefore = rawText.slice(0, start);
    const lineIndex = textBefore.split('\n').length - 1;
    const lineHeight = 20;
    textarea.scrollTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight / 2);
  }, [matches, rawText, searchQuery]);

  const handleNextMatch = () => jumpToMatch(currentMatchIndex + 1);
  const handlePrevMatch = () => jumpToMatch(currentMatchIndex - 1);


  const handleReplaceOne = () => {
    if (matches.length === 0 || !textareaRef.current) return;
    const start = matches[currentMatchIndex];
    const end = start + searchQuery.length;
    const updated = rawText.slice(0, start) + replaceQuery + rawText.slice(end);
    setRawText(updated);
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const flags = matchCase ? 'g' : 'gi';
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updated = rawText.replace(new RegExp(escaped, flags), replaceQuery);
    setRawText(updated);
  };

  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const updateCursorStats = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = rawText.slice(0, pos);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (isCtrlOrCmd && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      setIsFindOpen(true);
      const selected = rawText.slice(start, end);
      if (selected && !selected.includes('\n')) {
        setSearchQuery(selected);
      }
      setTimeout(() => findInputRef.current?.select(), 50);
      return;
    }

    if (isCtrlOrCmd && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      setIsFindOpen(true);
      setIsReplaceOpen(true);
      return;
    }

    if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      let word = rawText.slice(start, end);

      if (!word) {
        let l = start;
        let r = start;
        while (l > 0 && /[a-zA-Z0-9_]/.test(rawText[l - 1])) l--;
        while (r < rawText.length && /[a-zA-Z0-9_]/.test(rawText[r])) r++;
        if (l !== r) {
          textarea.setSelectionRange(l, r);
          setSearchQuery(rawText.slice(l, r));
        }
        return;
      }

      const nextPos = rawText.indexOf(word, end);
      if (nextPos !== -1) {
        textarea.setSelectionRange(nextPos, nextPos + word.length);
        const lineIdx = rawText.slice(0, nextPos).split('\n').length - 1;
        textarea.scrollTop = Math.max(0, lineIdx * 20 - textarea.clientHeight / 2);
      } else {

        const wrapPos = rawText.indexOf(word, 0);
        if (wrapPos !== -1) {
          textarea.setSelectionRange(wrapPos, wrapPos + word.length);
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start === end) {
        const updated = rawText.slice(0, start) + '  ' + rawText.slice(end);
        setRawText(updated);
        setTimeout(() => textarea.setSelectionRange(start + 2, start + 2), 0);
      } else {
        const linesBefore = rawText.slice(0, start).split('\n');
        const startLineIdx = linesBefore.length - 1;
        const allLines = rawText.split('\n');
        const linesSelected = rawText.slice(start, end).split('\n').length;

        for (let i = 0; i < linesSelected; i++) {
          const idx = startLineIdx + i;
          if (e.shiftKey) {
            if (allLines[idx].startsWith('  ')) allLines[idx] = allLines[idx].slice(2);
            else if (allLines[idx].startsWith(' ')) allLines[idx] = allLines[idx].slice(1);
          } else {
            allLines[idx] = '  ' + allLines[idx];
          }
        }
        setRawText(allLines.join('\n'));
      }
      return;
    }

    if (isCtrlOrCmd && e.key === '/') {
      e.preventDefault();
      const allLines = rawText.split('\n');
      const startLine = rawText.slice(0, start).split('\n').length - 1;
      const numLines = rawText.slice(start, end).split('\n').length;

      const areAllCommented = Array.from({ length: numLines }).every((_, i) =>
        allLines[startLine + i].trim().startsWith('#')
      );

      for (let i = 0; i < numLines; i++) {
        const idx = startLine + i;
        if (areAllCommented) {
          allLines[idx] = allLines[idx].replace(/^#\s?/, '');
        } else {
          allLines[idx] = '# ' + allLines[idx];
        }
      }
      setRawText(allLines.join('\n'));
      return;
    }

    if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const allLines = rawText.split('\n');
      const currentLine = rawText.slice(0, start).split('\n').length - 1;

      if (e.key === 'ArrowUp' && currentLine > 0) {
        const temp = allLines[currentLine];
        allLines[currentLine] = allLines[currentLine - 1];
        allLines[currentLine - 1] = temp;
        setRawText(allLines.join('\n'));
      } else if (e.key === 'ArrowDown' && currentLine < allLines.length - 1) {
        const temp = allLines[currentLine];
        allLines[currentLine] = allLines[currentLine + 1];
        allLines[currentLine + 1] = temp;
        setRawText(allLines.join('\n'));
      }
      return;
    }

    if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const allLines = rawText.split('\n');
      const currentLine = rawText.slice(0, start).split('\n').length - 1;
      allLines.splice(currentLine, 0, allLines[currentLine]);
      setRawText(allLines.join('\n'));
      return;
    }
  };

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
      <div className="flex items-center gap-3 text-[#64748B] font-mono text-[11px]">
        <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        <span>•</span>
        <span>{linesCount} {linesCount === 1 ? 'line' : 'lines'}</span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">UTF-8</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
        >
          {t('common.cancel')}
        </button>
        {format === 'po' && (
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t('rawPo.save')}</span>
          </button>
        )}
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
      maxWidth="max-w-5xl"
      footer={modalFooter}
    >
      <div className="space-y-2.5 flex flex-col w-full">

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded border border-[#2D3139] bg-[#090B0E] p-0.5">
            {(['po', 'json', 'csv'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchFormat(option)}
                className={`px-2.5 py-1 text-xs rounded cursor-pointer transition-colors ${
                  format === option ? 'bg-[#1E293B] text-white font-medium' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {option === 'po' ? 'PO' : option.toUpperCase()}
              </button>
            ))}
          </div>

          {format === 'json' && (
            <DropdownMenu
              value={jsonFormat}
              onChange={switchJsonFormat}
              options={[
                { value: 'key-first', label: t('transfer.jsonKeyFirst') },
                { value: 'language-first', label: t('transfer.jsonLanguageFirst') },
              ]}
              className="min-w-[170px]"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFindOpen((prev) => !prev);
                setTimeout(() => findInputRef.current?.focus(), 50);
              }}
              className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isFindOpen
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border-[#2D3139]'
              }`}
              title="Find (Ctrl+F) / Replace (Ctrl+H)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{t('sidebar.searchPlaceholder') || 'Find'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-xs text-[#94A3B8] hover:text-[#E2E8F0] flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('editor.copied') : t('editor.copy')}</span>
            </button>
          </div>
        </div>


        <div className="relative border border-[#2D3139] rounded-lg bg-[#090B0E] overflow-hidden flex flex-col">

          {isFindOpen && (
            <div className="absolute top-2 right-4 z-30 bg-[#16191E] border border-[#2D3139] shadow-2xl rounded-md p-2 flex flex-col gap-1.5 animate-in fade-in duration-150 text-xs">
              <div className="flex items-center gap-1.5">
                <input
                  ref={findInputRef}
                  type="text"
                  placeholder="Find"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentMatchIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) handlePrevMatch();
                      else handleNextMatch();
                    } else if (e.key === 'Escape') {
                      setIsFindOpen(false);
                    }
                  }}
                  className="bg-[#090B0E] border border-[#2D3139] focus:border-[#3B82F6] rounded px-2 py-1 text-xs text-white font-mono outline-none w-44"
                />

                <span className="text-[10px] text-[#64748B] font-mono min-w-[50px] text-center">
                  {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No results'}
                </span>

                <button
                  type="button"
                  onClick={() => setMatchCase((prev) => !prev)}
                  className={`p-1 rounded transition-colors ${matchCase ? 'bg-[#3B82F6] text-white' : 'text-[#64748B] hover:text-white'}`}
                  title="Match Case"
                >
                  <CaseSensitive className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handlePrevMatch}
                  disabled={matches.length === 0}
                  className="p-1 rounded text-[#64748B] hover:text-white disabled:opacity-30"
                  title="Previous Match (Shift+Enter)"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleNextMatch}
                  disabled={matches.length === 0}
                  className="p-1 rounded text-[#64748B] hover:text-white disabled:opacity-30"
                  title="Next Match (Enter)"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsReplaceOpen((prev) => !prev)}
                  className={`p-1 rounded transition-colors ${isReplaceOpen ? 'text-[#38BDF8]' : 'text-[#64748B] hover:text-white'}`}
                  title="Toggle Replace"
                >
                  <ReplaceIcon className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsFindOpen(false)}
                  className="p-1 rounded text-[#64748B] hover:text-white ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {isReplaceOpen && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-[#2D3139]/60">
                  <input
                    type="text"
                    placeholder="Replace"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReplaceOne();
                    }}
                    className="bg-[#090B0E] border border-[#2D3139] focus:border-[#3B82F6] rounded px-2 py-1 text-xs text-white font-mono outline-none w-44"
                  />
                  <button
                    type="button"
                    onClick={handleReplaceOne}
                    disabled={matches.length === 0}
                    className="px-2 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[10px] text-white border border-[#2D3139] disabled:opacity-30 cursor-pointer"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceAll}
                    disabled={matches.length === 0}
                    className="px-2 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[10px] text-white border border-[#2D3139] disabled:opacity-30 cursor-pointer"
                  >
                    All
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex w-full min-h-[52vh] max-h-[62vh] relative font-mono text-xs">

            <div
              ref={gutterRef}
              className="w-12 bg-[#0d1117] text-[#484f58] py-3 text-right pr-3 select-none overflow-hidden shrink-0 border-r border-[#2D3139]/60 font-mono text-[11px] leading-[20px]"
            >
              {Array.from({ length: linesCount }).map((_, i) => (
                <div
                  key={i}
                  className={`${cursorPos.line === i + 1 ? 'text-[#38BDF8] font-bold' : ''}`}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => {
                if (format !== 'po') return;
                setRawText(e.target.value);
                setParseError(null);
              }}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={updateCursorStats}
              onClick={updateCursorStats}
              onSelect={updateCursorStats}
              onScroll={handleScroll}
              readOnly={format !== 'po'}
              spellCheck={false}
              wrap="off"
              className="flex-1 bg-transparent py-3 pl-3 pr-4 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] outline-none resize-none leading-[20px] select-text custom-scrollbar overflow-auto"
            />
          </div>
        </div>

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