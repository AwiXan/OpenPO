import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Copy,
  Clock,
  AlertCircle,
  HelpCircle,
  Save,
  Check,
  Undo2,
  Redo2,
  CornerDownLeft,
  Eye,
  EyeOff,
  Folder,
  Tag,
  Edit3,
} from 'lucide-react';
import { PoEntry, PluralRuleInfo, LintIssue, TmSuggestion } from '../types/gettext';
import { extractVariables, lintEntry } from '../lib/linter';
import { evaluatePluralIndex } from '../lib/pluralEngine';
import { deriveCategory } from '../lib/categorizer';
import { useTranslation } from '../lib/i18n';

interface TranslationEditorProps {
  entry: PoEntry | null;
  language: string;
  languageName: string;
  pluralRule: PluralRuleInfo;
  onUpdateEntry: (updatedEntry: PoEntry) => void;
  onSyncPotEntry: (updatedPotEntry: PoEntry) => void;
  onNextEntry: () => void;
  onPrevEntry: () => void;
  tmSuggestions: TmSuggestion[];
  isPotTemplate: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  fuzzyThreshold?: number;
  autoMarkFuzzyUnder100?: boolean;
  onUpdateCategory?: (entryId: string, newCategory: string) => void;
  availableCategories?: string[];
}

export const TranslationEditor: React.FC<TranslationEditorProps> = ({
  entry,
  language,
  languageName,
  pluralRule,
  onUpdateEntry,
  onSyncPotEntry,
  onNextEntry,
  onPrevEntry,
  tmSuggestions,
  isPotTemplate,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  fuzzyThreshold = 80,
  autoMarkFuzzyUnder100 = true,
  onUpdateCategory,
  availableCategories = [],
}) => {
  const { t } = useTranslation();

  // Local state for editing fields
  const [localMsgid, setLocalMsgid] = useState('');
  const [localMsgidPlural, setLocalMsgidPlural] = useState('');
  const [localMsgctxt, setLocalMsgctxt] = useState('');
  const [localComments, setLocalComments] = useState('');
  const [localMsgstr, setLocalMsgstr] = useState<string[]>([]);
  const [localCategory, setLocalCategory] = useState('');
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [activePluralTab, setActivePluralTab] = useState(0);
  const [testNumber, setTestNumber] = useState<number>(1);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Newline convenience tools state
  const [showWhitespaceMarks, setShowWhitespaceMarks] = useState<boolean>(true);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync state when entry changes
  useEffect(() => {
    if (!entry) return;
    setLocalMsgid(entry.msgid);
    setLocalMsgidPlural(entry.msgidPlural || '');
    setLocalMsgctxt(entry.msgctxt || '');
    setLocalComments(entry.comments.join('\n'));
    setLocalCategory(entry.category || deriveCategory(entry));
    setIsEditingCategory(false);

    // Ensure array has enough elements for all required plural forms
    const requiredForms = entry.msgidPlural ? pluralRule.nplurals : 1;
    const current = [...entry.msgstr];
    while (current.length < requiredForms) {
      current.push('');
    }
    setLocalMsgstr(current);
    setActivePluralTab(0);
  }, [entry?.id, entry?.msgid, pluralRule.nplurals, entry?.msgstr, entry?.category]);

  if (!entry) {
    return (
      <div className="w-full h-full bg-[#16191E] flex items-center justify-center text-[#64748B] text-xs">
        {t('table.noStrings')}
      </div>
    );
  }

  // Extract placeholders / tokens
  const formatTokens = extractVariables(entry.msgid);
  if (entry.msgidPlural) {
    formatTokens.push(...extractVariables(entry.msgidPlural));
  }
  const uniqueTokens: string[] = Array.from(new Set(formatTokens));

  // Run linter on current state
  const currentIssues: LintIssue[] = !isPotTemplate
    ? lintEntry(
        {
          ...entry,
          msgstr: localMsgstr,
        },
        entry.msgidPlural ? pluralRule.nplurals : 1
      )
    : [];

  const handleMsgstrChange = (index: number, val: string) => {
    const updated = [...localMsgstr];
    updated[index] = val;
    setLocalMsgstr(updated);
    onUpdateEntry({
      ...entry,
      msgstr: updated,
    });
  };

  // Helper to insert \n at the current cursor position in active textarea
  const handleInsertNewline = (index: number) => {
    const textarea = activeTextareaRef.current;
    const currentVal = localMsgstr[index] || '';

    if (textarea) {
      const start = textarea.selectionStart ?? currentVal.length;
      const end = textarea.selectionEnd ?? currentVal.length;
      const newVal = currentVal.substring(0, start) + '\\n' + currentVal.substring(end);
      handleMsgstrChange(index, newVal);

      // Restore cursor right after \n
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(start + 2, start + 2);
        }
      }, 0);
    } else {
      handleMsgstrChange(index, currentVal + '\\n');
    }
  };

  const handleApplyTm = (suggested: string, similarity: number) => {
    const updated = [...localMsgstr];
    updated[activePluralTab] = suggested;
    setLocalMsgstr(updated);

    let nextFlags = [...entry.flags];
    if (similarity < 100 && autoMarkFuzzyUnder100) {
      if (!nextFlags.includes('fuzzy')) nextFlags.push('fuzzy');
    } else if (similarity === 100) {
      nextFlags = nextFlags.filter((f) => f !== 'fuzzy');
    }

    onUpdateEntry({
      ...entry,
      msgstr: updated,
      flags: nextFlags,
    });
  };

  const handleInsertToken = (token: string) => {
    const current = localMsgstr[activePluralTab] || '';
    const updated = [...localMsgstr];
    updated[activePluralTab] = current + token;
    setLocalMsgstr(updated);
    onUpdateEntry({
      ...entry,
      msgstr: updated,
    });
    setCopiedVar(token);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const handleToggleFuzzy = () => {
    const hasFuzzy = entry.flags.includes('fuzzy');
    const nextFlags = hasFuzzy
      ? entry.flags.filter((f) => f !== 'fuzzy')
      : [...entry.flags, 'fuzzy'];
    onUpdateEntry({
      ...entry,
      flags: nextFlags,
    });
  };

  const handleSavePotTemplateChanges = () => {
    const updatedPotEntry: PoEntry = {
      ...entry,
      msgid: localMsgid,
      msgidPlural: localMsgidPlural.trim() ? localMsgidPlural : undefined,
      msgctxt: localMsgctxt.trim() ? localMsgctxt : undefined,
      comments: localComments.split('\n').filter((l) => l.trim() !== ''),
    };
    onSyncPotEntry(updatedPotEntry);
  };

  const evaluatedPluralIndex = evaluatePluralIndex(testNumber, pluralRule);

  // Check newline counts for warning indicator
  const sourceNewlineCount = (entry.msgid.match(/\\n|\n/g) || []).length;
  const currentTranslation = localMsgstr[activePluralTab] || '';
  const targetNewlineCount = (currentTranslation.match(/\\n|\n/g) || []).length;
  const hasNewlineMismatch = sourceNewlineCount > 0 && sourceNewlineCount !== targetNewlineCount;

  return (
    <div className="w-full flex flex-col bg-[#16191E] h-full overflow-hidden text-[#E2E8F0] select-none">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 border-b border-[#2D3139] flex items-center justify-between bg-[#1C2128]">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-[#3B82F6] font-bold">✎</span>
          <span className="font-mono text-xs font-semibold text-[#E2E8F0] truncate">
            {entry.msgid}
          </span>
          <button
            onClick={handleToggleFuzzy}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
              entry.flags.includes('fuzzy')
                ? 'bg-[#F59E0B1A] text-[#F59E0B] border-[#F59E0B33] hover:bg-[#F59E0B33]'
                : 'bg-[#16191E] text-[#64748B] border-[#2D3139] hover:text-[#94A3B8]'
            }`}
            title="Click to toggle fuzzy translation status"
          >
            {entry.flags.includes('fuzzy') ? t('editor.fuzzy') : t('editor.translated')}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Undo / Redo controls */}
          {(onUndo || onRedo) && (
            <div className="flex items-center bg-[#090B0E] p-0.5 rounded border border-[#2D3139]">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  canUndo
                    ? 'text-[#E2E8F0] hover:bg-[#1C2128] hover:text-[#38BDF8]'
                    : 'text-[#64748B] opacity-40 cursor-not-allowed'
                }`}
                title="Undo edit (Ctrl+Z)"
              >
                <Undo2 className="w-3 h-3" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  canRedo
                    ? 'text-[#E2E8F0] hover:bg-[#1C2128] hover:text-[#38BDF8]'
                    : 'text-[#64748B] opacity-40 cursor-not-allowed'
                }`}
                title="Redo edit (Ctrl+Y)"
              >
                <Redo2 className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="text-[10px] text-[#64748B] font-mono">
            <span>{entry.references[0] || 'inline'}</span>
          </div>
        </div>
      </div>

      {/* Category & Context Metadata Strip */}
      <div className="px-4 py-1.5 bg-[#121418] border-b border-[#2D3139] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-[#64748B] flex items-center gap-1">
            <Folder className="w-3 h-3 text-[#F59E0B]" />
            {t('category.title')}:
          </span>
          {isEditingCategory ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                list="category-suggestions"
                value={localCategory}
                onChange={(e) => setLocalCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onUpdateCategory) onUpdateCategory(entry.id, localCategory);
                    setIsEditingCategory(false);
                  } else if (e.key === 'Escape') {
                    setLocalCategory(entry.category || deriveCategory(entry));
                    setIsEditingCategory(false);
                  }
                }}
                autoFocus
                placeholder="e.g. UI / Dialogs or Inventory"
                className="bg-[#1C2128] border border-[#3B82F6] rounded px-2 py-0.5 text-xs font-mono text-[#38BDF8] focus:outline-none"
              />
              <datalist id="category-suggestions">
                {availableCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button
                onClick={() => {
                  if (onUpdateCategory) onUpdateCategory(entry.id, localCategory);
                  setIsEditingCategory(false);
                }}
                className="px-2 py-0.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[10px] font-medium cursor-pointer"
              >
                {t('common.save')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-[#1C2128] text-[#38BDF8] border border-[#2D3139] font-mono text-[11px]">
                {localCategory || 'General'}
              </span>
              <button
                onClick={() => setIsEditingCategory(true)}
                className="text-[10px] text-[#64748B] hover:text-[#E2E8F0] p-1 rounded hover:bg-[#1E293B] cursor-pointer transition-colors"
                title="Change or set custom category path"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {entry.msgctxt && (
          <div className="flex items-center gap-1 text-[10px] text-[#94A3B8] font-mono">
            <Tag className="w-2.5 h-2.5 text-[#38BDF8]" />
            <span>ctxt: {entry.msgctxt}</span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Source Text / POT Template Section */}
        <div className="bg-[#090B0E] rounded border border-[#2D3139] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
              <span>{t('editor.sourceHeader')}</span>
              {sourceNewlineCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[#3B82F61A] text-[#38BDF8] border border-[#3B82F633] text-[9px] font-mono lowercase">
                  ↵ {sourceNewlineCount} \n
                </span>
              )}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(entry.msgid);
                setCopiedVar('msgid');
                setTimeout(() => setCopiedVar(null), 1200);
              }}
              className="text-[10px] text-[#64748B] hover:text-[#E2E8F0] flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedVar === 'msgid' ? <Check className="w-3 h-3 text-[#4ADE80]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedVar === 'msgid' ? t('editor.copied') : t('editor.copySource')}</span>
            </button>
          </div>

          {isPotTemplate ? (
            /* Inline POT Master Editor */
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] text-[#64748B] uppercase block mb-1">msgid (Key/Source):</label>
                <textarea
                  value={localMsgid}
                  onChange={(e) => setLocalMsgid(e.target.value)}
                  className="w-full bg-[#16191E] border border-[#2D3139] rounded p-2 text-xs font-mono text-[#E2E8F0] focus:border-[#3B82F6] outline-none resize-none h-16"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] uppercase block mb-1">msgid_plural (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. %d items in your cart"
                  value={localMsgidPlural}
                  onChange={(e) => setLocalMsgidPlural(e.target.value)}
                  className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] focus:border-[#3B82F6] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase block mb-1">msgctxt (Context):</label>
                  <input
                    type="text"
                    placeholder="e.g. Menu | Button"
                    value={localMsgctxt}
                    onChange={(e) => setLocalMsgctxt(e.target.value)}
                    className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] focus:border-[#3B82F6] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase block mb-1">Developer Notes:</label>
                  <input
                    type="text"
                    placeholder="Notes for translators"
                    value={localComments}
                    onChange={(e) => setLocalComments(e.target.value)}
                    className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-sans text-[#E2E8F0] focus:border-[#3B82F6] outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSavePotTemplateChanges}
                className="w-full py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('editor.savePot')}</span>
              </button>
            </div>
          ) : (
            /* Standard Read-Only Source View */
            <div className="space-y-2 text-xs">
              <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] font-mono text-[#E2E8F0] select-text whitespace-pre-wrap leading-relaxed">
                {entry.msgid}
              </div>

              {entry.msgidPlural && (
                <div className="bg-[#16191E] p-2 rounded border border-[#2D3139] text-xs font-mono select-text whitespace-pre-wrap">
                  <span className="text-[10px] text-[#3B82F6] uppercase font-bold mr-2">Plural:</span>
                  <span className="text-[#94A3B8]">{entry.msgidPlural}</span>
                </div>
              )}

              {entry.comments.length > 0 && (
                <div className="text-[11px] text-[#94A3B8] italic flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-[#3B82F6] shrink-0" />
                  <span>{entry.comments.join(' ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Variable / Token Pills */}
          {uniqueTokens.length > 0 && (
            <div className="pt-2 border-t border-[#2D3139] flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-[#64748B] uppercase">{t('editor.insertToken')}</span>
              {uniqueTokens.map((token, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInsertToken(token)}
                  className="px-2 py-0.5 rounded bg-[#16191E] hover:bg-[#2D3748] border border-[#2D3139] text-[11px] font-mono text-[#3B82F6] hover:text-white transition-colors cursor-pointer"
                >
                  {token}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Translation Target Section (Hidden if viewing POT template) */}
        {!isPotTemplate && (
          <div className="space-y-3">
            {/* Header with language, \n helpers, and fuzzy toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#4ADE80] uppercase tracking-wider">
                  {languageName} ({language})
                </span>
                {entry.msgidPlural && (
                  <span className="text-[10px] font-mono text-[#64748B]">
                    {pluralRule.nplurals} plural forms
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Insert \n convenience button */}
                <button
                  onClick={() => handleInsertNewline(activePluralTab)}
                  className="text-[10px] font-mono text-[#38BDF8] hover:text-white px-2 py-1 rounded bg-[#090B0E] hover:bg-[#1E293B] border border-[#2D3139] transition-colors cursor-pointer flex items-center gap-1"
                  title="Insert \n newline at cursor position"
                >
                  <CornerDownLeft className="w-3 h-3 text-[#38BDF8]" />
                  <span>{t('editor.insertNewline')}</span>
                </button>

                {/* Toggle \n visualization */}
                <button
                  onClick={() => setShowWhitespaceMarks(!showWhitespaceMarks)}
                  className={`p-1 rounded text-xs border transition-colors cursor-pointer ${
                    showWhitespaceMarks
                      ? 'bg-[#1E293B] text-[#38BDF8] border-[#3B82F6]'
                      : 'bg-[#090B0E] text-[#64748B] border-[#2D3139]'
                  }`}
                  title={showWhitespaceMarks ? 'Hide visible \\n markers' : 'Show visible \\n markers'}
                >
                  {showWhitespaceMarks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => {
                    const updated = [...localMsgstr];
                    updated[activePluralTab] = entry.msgid;
                    setLocalMsgstr(updated);
                    onUpdateEntry({ ...entry, msgstr: updated });
                  }}
                  className="text-[10px] text-[#94A3B8] hover:text-[#E2E8F0] px-2 py-1 rounded bg-[#090B0E] border border-[#2D3139] transition-colors cursor-pointer"
                >
                  {t('editor.copySource')}
                </button>

                <button
                  onClick={handleToggleFuzzy}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                    entry.flags.includes('fuzzy')
                      ? 'bg-[#F59E0B1A] border border-[#F59E0B] text-[#F59E0B]'
                      : 'bg-[#090B0E] border border-[#2D3139] text-[#64748B] hover:text-[#E2E8F0]'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{t('editor.fuzzy')}</span>
                </button>
              </div>
            </div>

            {/* Plural Form Tabs */}
            {entry.msgidPlural ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-[#2D3139] pb-1 overflow-x-auto">
                  {Array.from({ length: pluralRule.nplurals }).map((_, formIndex) => {
                    const formName = pluralRule.names[formIndex] || `Form ${formIndex}`;
                    const isTabActive = activePluralTab === formIndex;
                    const isFilled =
                      localMsgstr[formIndex] && localMsgstr[formIndex].trim() !== '';

                    return (
                      <button
                        key={formIndex}
                        onClick={() => setActivePluralTab(formIndex)}
                        className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          isTabActive
                            ? 'bg-[#1E293B] border-t-2 border-[#3B82F6] text-[#E2E8F0] font-semibold'
                            : 'text-[#94A3B8] hover:bg-[#1C2128]'
                        }`}
                      >
                        <span className="font-mono text-[10px]">msgstr[{formIndex}]</span>
                        <span className="text-[10px] text-[#64748B]">({formName})</span>
                        {isFilled && <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Plural Interactive Test Counter */}
                <div className="bg-[#090B0E] p-2.5 rounded border border-[#2D3139] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase">{t('editor.testPlural')}</span>
                    <input
                      type="number"
                      min={0}
                      value={testNumber}
                      onChange={(e) => setTestNumber(parseInt(e.target.value) || 0)}
                      className="w-16 bg-[#16191E] border border-[#2D3139] rounded px-2 py-0.5 text-xs font-mono text-center text-[#E2E8F0]"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[#64748B]">{t('editor.activeForm')}</span>
                    <span className="font-mono font-bold text-[#3B82F6]">
                      msgstr[{evaluatedPluralIndex}] (
                      {pluralRule.names[evaluatedPluralIndex] || 'default'})
                    </span>
                  </div>
                </div>

                {/* Textarea for active plural form */}
                <div className="relative">
                  <textarea
                    ref={activeTextareaRef}
                    value={localMsgstr[activePluralTab] || ''}
                    onChange={(e) => handleMsgstrChange(activePluralTab, e.target.value)}
                    placeholder={`Translation for ${pluralRule.names[activePluralTab] || `Form ${activePluralTab}`} (msgstr[${activePluralTab}])...`}
                    className="w-full bg-[#090B0E] border border-[#2D3139] rounded p-3 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-none h-24 leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              /* Singular Textarea */
              <div className="relative">
                <textarea
                  ref={activeTextareaRef}
                  value={localMsgstr[0] || ''}
                  onChange={(e) => handleMsgstrChange(0, e.target.value)}
                  placeholder={t('editor.placeholder')}
                  className="w-full bg-[#090B0E] border border-[#2D3139] rounded p-3 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-none h-28 leading-relaxed"
                />
              </div>
            )}

            {/* Newline mismatch alert */}
            {hasNewlineMismatch && (
              <div className="p-2 rounded bg-[#3B82F615] border border-[#3B82F644] text-[11px] text-[#38BDF8] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>
                    Source contains {sourceNewlineCount} newline (\n), but translation has {targetNewlineCount}.
                  </span>
                </div>
                <button
                  onClick={() => handleInsertNewline(activePluralTab)}
                  className="px-2 py-0.5 rounded bg-[#3B82F6] text-white text-[10px] font-semibold hover:bg-[#2563EB] cursor-pointer"
                >
                  Append \n
                </button>
              </div>
            )}

            {/* Linter Warning Notices */}
            {currentIssues.length > 0 && (
              <div className="space-y-1.5">
                {currentIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                      issue.type === 'error'
                        ? 'bg-rose-950/40 border border-rose-800 text-rose-300'
                        : 'bg-amber-950/40 border border-amber-800 text-amber-300'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Translation Memory Suggestions */}
            {tmSuggestions.length > 0 && (
              <div className="bg-[#090B0E] rounded border border-[#2D3139] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>{t('editor.tmSuggestions')}</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#F59E0B1A] text-[#F59E0B] font-mono text-[9px] border border-[#F59E0B33]">
                      ≥ {fuzzyThreshold}% match
                    </span>
                  </div>
                  <span className="text-[10px] text-[#64748B]">{t('editor.crossTm')}</span>
                </div>

                <div className="space-y-1.5">
                  {tmSuggestions.slice(0, 3).map((match, idx) => (
                    <div
                      key={idx}
                      className="bg-[#16191E] p-2 rounded border border-[#2D3139] flex items-center justify-between text-xs"
                    >
                      <div className="overflow-hidden mr-2">
                        <div className="font-mono text-[#E2E8F0] truncate">{match.suggestedMsgstr}</div>
                        <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                          <span className={`font-semibold ${match.similarity === 100 ? 'text-[#4ADE80]' : 'text-[#38BDF8]'}`}>
                            {t('editor.tmMatch')}: {match.similarity}%
                          </span>
                          <span>•</span>
                          <span className="truncate">{match.originWorkspace || 'Workspace TM'}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleApplyTm(match.suggestedMsgstr, match.similarity)}
                        className="px-2.5 py-1 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium shrink-0 cursor-pointer shadow-xs"
                      >
                        {t('editor.apply')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="h-10 border-t border-[#2D3139] px-4 flex items-center justify-between bg-[#090B0E] text-xs">
        <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
          <span>{t('editor.ctrlEnterHint')}</span>
          <span>•</span>
          <span>{t('editor.ctrlArrowHint')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrevEntry}
            className="px-2.5 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1 border border-[#2D3139] cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>{t('editor.prev')}</span>
          </button>

          <button
            onClick={onNextEntry}
            className="px-3.5 py-1 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <span>{t('editor.next')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
