import React, { useState, useRef, useMemo } from 'react';
import { Workspace, PoEntry } from '../types/gettext';
import { useTranslation } from '../lib/i18n';
import {
  CornerDownLeft,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  FolderTree,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Folder,
} from 'lucide-react';
import { deriveCategoryPath } from '../lib/categorizer';

interface MultiLanguageGridViewProps {
  workspace: Workspace;
  onUpdateTranslation: (poFileId: string, entryId: string, msgstr: string[]) => void;
  showNewlinesVisible?: boolean;
}

export const MultiLanguageGridView: React.FC<MultiLanguageGridViewProps> = ({
  workspace,
  onUpdateTranslation,
  showNewlinesVisible: initialShowNewlines = true,
}) => {
  const { t } = useTranslation();
  const potEntries = workspace.potFile.entries;
  const poFiles = workspace.poFiles;

  const [showWhitespaceMarks, setShowWhitespaceMarks] = useState<boolean>(initialShowNewlines);
  const [expandAllRows, setExpandAllRows] = useState<boolean>(false);
  const [groupByCategory, setGroupByCategory] = useState<boolean>(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Store refs to textareas for precise cursor manipulation: key = `${poId}_${entryId}_${idx}`
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const categoryRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const setTextareaRef = (key: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRefs.current.set(key, el);
    } else {
      textareaRefs.current.delete(key);
    }
  };

  const setCategoryRowRef = (categoryName: string, el: HTMLTableRowElement | null) => {
    if (el) {
      categoryRowRefs.current.set(categoryName, el);
    } else {
      categoryRowRefs.current.delete(categoryName);
    }
  };

  // Group entries by category
  const categorizedGroups = useMemo(() => {
    const map = new Map<string, PoEntry[]>();
    for (const entry of potEntries) {
      const catPath = deriveCategoryPath(entry);
      const catName = catPath.join(' / ') || 'General';
      if (!map.has(catName)) {
        map.set(catName, []);
      }
      map.get(catName)!.push(entry);
    }

    // Sort categories alphabetically with General at the end if present
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    });
  }, [potEntries]);

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const expandAllCategories = () => {
    setCollapsedCategories(new Set());
  };

  const collapseAllCategories = () => {
    setCollapsedCategories(new Set(categorizedGroups.map(([catName]) => catName)));
  };

  const handleScrollToCategory = (catName: string) => {
    // If collapsed, expand it so it's visible
    if (collapsedCategories.has(catName)) {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        next.delete(catName);
        return next;
      });
    }

    setTimeout(() => {
      const el = categoryRowRefs.current.get(catName);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Cursor-aware insertion of \n
  const handleInsertNewlineInGrid = (
    poId: string,
    potEntryId: string,
    currentArr: string[],
    idx: number
  ) => {
    const key = `${poId}_${potEntryId}_${idx}`;
    const textarea = textareaRefs.current.get(key);
    const currentVal = currentArr[idx] || '';

    if (textarea) {
      const start = textarea.selectionStart ?? currentVal.length;
      const end = textarea.selectionEnd ?? currentVal.length;
      const newVal = currentVal.substring(0, start) + '\\n' + currentVal.substring(end);

      const updated = [...currentArr];
      updated[idx] = newVal;
      onUpdateTranslation(poId, potEntryId, updated);

      setTimeout(() => {
        const el = textareaRefs.current.get(key);
        if (el) {
          el.focus();
          el.setSelectionRange(start + 2, start + 2);
        }
      }, 0);
    } else {
      const updated = [...currentArr];
      updated[idx] = currentVal + '\\n';
      onUpdateTranslation(poId, potEntryId, updated);
    }
  };

  const renderEntryRow = (potEntry: PoEntry) => {
    const hasNewlines = potEntry.msgid.includes('\\n') || potEntry.msgid.includes('\n');
    const newlineCount = (potEntry.msgid.match(/\\n|\n/g) || []).length;

    return (
      <tr
        key={potEntry.id}
        className="border-b border-[#16191E] hover:bg-[#1E293B20] transition-colors"
      >
        {/* Source Column */}
        <td className="p-3 border-r border-[#2D3139] bg-[#090B0E] align-top w-80">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="font-semibold text-[#E2E8F0] select-text break-words whitespace-pre-wrap leading-relaxed">
              {potEntry.msgid}
            </div>
            {showWhitespaceMarks && hasNewlines && (
              <span
                className="shrink-0 px-1 py-0.2 rounded bg-[#3B82F622] text-[#38BDF8] border border-[#3B82F644] text-[9px] font-mono select-none"
                title={`${newlineCount} newlines in source key`}
              >
                ↵ {newlineCount}\n
              </span>
            )}
          </div>
          {potEntry.msgidPlural && (
            <div className="text-[10px] text-[#3B82F6] mt-1 whitespace-pre-wrap">
              Plural: {potEntry.msgidPlural}
            </div>
          )}
          {potEntry.comments.length > 0 && (
            <div className="text-[10px] text-[#64748B] font-sans italic mt-1 truncate">
              {potEntry.comments[0]}
            </div>
          )}
        </td>

        {/* Language Input Columns */}
        {poFiles.map((po) => {
          const poEntry = po.entries.find((e) => e.id === potEntry.id);
          const currentMsgstr = poEntry?.msgstr || [''];
          const isFuzzy = poEntry?.flags.includes('fuzzy');

          return (
            <td key={po.id} className="p-2.5 border-r border-[#2D3139] align-top bg-[#090B0E]">
              <div className="space-y-1.5">
                {currentMsgstr.map((strVal, idx) => {
                  const refKey = `${po.id}_${potEntry.id}_${idx}`;
                  const valNewlineCount = (strVal.match(/\\n|\n/g) || []).length;

                  return (
                    <div key={idx} className="relative group/cell">
                      <div className="flex items-start gap-1">
                        {currentMsgstr.length > 1 && (
                          <span className="text-[9px] font-mono text-[#64748B] w-5 shrink-0 pt-1">
                            [{idx}]
                          </span>
                        )}

                        <div className="flex-1 relative">
                          <textarea
                            ref={(el) => setTextareaRef(refKey, el)}
                            rows={expandAllRows ? 3 : 2}
                            value={strVal}
                            onChange={(e) => {
                              const updated = [...currentMsgstr];
                              updated[idx] = e.target.value;
                              onUpdateTranslation(po.id, potEntry.id, updated);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            placeholder={`${t('matrix.translatePlaceholder')} (${po.language})...`}
                            className={`w-full bg-[#16191E] border rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-y min-h-[44px] leading-relaxed transition-colors ${
                              isFuzzy ? 'border-[#F59E0B]' : 'border-[#2D3139]'
                            }`}
                          />

                          {showWhitespaceMarks && valNewlineCount > 0 && (
                            <span
                              className="absolute bottom-1 right-2 px-1 py-0.2 rounded bg-[#3B82F622] text-[#38BDF8] border border-[#3B82F633] text-[9px] font-mono select-none pointer-events-none"
                              title={`${valNewlineCount} newlines`}
                            >
                              ↵ {valNewlineCount}\n
                            </span>
                          )}
                        </div>

                        {/* Quick Insert \n Button with cursor restore */}
                        <button
                          onClick={() =>
                            handleInsertNewlineInGrid(po.id, potEntry.id, currentMsgstr, idx)
                          }
                          className="p-1 rounded bg-[#16191E] hover:bg-[#1E293B] text-[#64748B] hover:text-[#38BDF8] border border-[#2D3139] transition-colors cursor-pointer shrink-0 mt-0.5"
                          title="Insert \n newline at cursor"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#090B0E] overflow-hidden text-[#E2E8F0]">
      {/* Header Info Bar */}
      <div className="p-3 border-b border-[#2D3139] bg-[#16191E] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>{t('matrix.title')}</span>
            <span className="px-1.5 py-0.2 rounded bg-[#3B82F61A] text-[#38BDF8] border border-[#3B82F633] text-[9px] font-mono lowercase">
              \n multi-row editor
            </span>
          </h2>
          <p className="text-[11px] text-[#94A3B8]">
            {t('matrix.subtitle')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Categorize Preference Toggle */}
          <button
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
              groupByCategory
                ? 'bg-[#1E293B] text-[#38BDF8] border-[#3B82F6] font-medium shadow-xs'
                : 'bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border-[#2D3139]'
            }`}
            title="Group strings by category in the matrix"
          >
            <FolderTree className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>{t('matrix.groupByCategory')}</span>
          </button>

          {/* Jump to category dropdown and expand/collapse button group if grouped */}
          {groupByCategory && categorizedGroups.length > 1 && (
            <div className="flex items-center gap-1.5">
              {/* Stylized Jump to Category select box */}
              <div className="relative flex items-center">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleScrollToCategory(e.target.value);
                    }
                  }}
                  defaultValue=""
                  className="bg-[#1C2128] hover:bg-[#2D3748] border border-[#2D3139] hover:border-[#3B82F644] text-[#E2E8F0] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer font-sans transition-colors appearance-none pr-7"
                >
                  <option value="" disabled className="bg-[#16191E] text-[#94A3B8]">
                    {t('matrix.jumpToCategory')}
                  </option>
                  {categorizedGroups.map(([catName, entries]) => (
                    <option key={catName} value={catName} className="bg-[#16191E] text-[#E2E8F0]">
                      {catName} ({entries.length})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
              </div>

              {/* Connected Expand All / Collapse All button group */}
              <div className="flex bg-[#090B0E] p-0.5 rounded border border-[#2D3139] items-center">
                <button
                  onClick={expandAllCategories}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1C2128] transition-all cursor-pointer"
                  title={t('matrix.expandAllCats')}
                >
                  <ChevronsDown className="w-3 h-3 text-[#38BDF8]" />
                  <span>{t('matrix.expandAllCats')}</span>
                </button>
                <div className="h-3.5 w-[1px] bg-[#2D3139] mx-0.5" />
                <button
                  onClick={collapseAllCategories}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1C2128] transition-all cursor-pointer"
                  title={t('matrix.collapseAllCats')}
                >
                  <ChevronsUp className="w-3 h-3 text-[#94A3B8]" />
                  <span>{t('matrix.collapseAllCats')}</span>
                </button>
              </div>
            </div>
          )}

          <div className="h-4 w-[1px] bg-[#2D3139] mx-0.5 shrink-0" />

          {/* Toggle whitespace badges */}
          <button
            onClick={() => setShowWhitespaceMarks(!showWhitespaceMarks)}
            className={`px-2.5 py-1.5 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${
              showWhitespaceMarks
                ? 'bg-[#1E293B] text-[#38BDF8] border-[#3B82F6] font-medium shadow-xs'
                : 'bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border-[#2D3139]'
            }`}
            title="Toggle visible \n newline markers"
          >
            {showWhitespaceMarks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showWhitespaceMarks ? t('matrix.hideNewlines') : t('matrix.showNewlines')}</span>
          </button>

          {/* Expand all rows toggle */}
          <button
            onClick={() => setExpandAllRows(!expandAllRows)}
            className={`px-2.5 py-1.5 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${
              expandAllRows
                ? 'bg-[#1E293B] text-[#4ADE80] border-[#4ADE80] font-medium shadow-xs'
                : 'bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border-[#2D3139]'
            }`}
            title="Toggle expanded multiline rows"
          >
            {expandAllRows ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{expandAllRows ? t('matrix.compactRows') : t('matrix.expandRows')}</span>
          </button>

          <div className="text-xs font-mono text-[#64748B] pl-2 border-l border-[#2D3139]">
            {potEntries.length} {t('matrix.keysCount')} • {poFiles.length} {t('matrix.targetLangs')}
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-[#16191E] border-b border-[#2D3139] text-[10px] font-bold text-[#64748B] uppercase tracking-wider z-20 shadow-sm">
            <tr>
              <th className="p-3 w-80 border-r border-[#2D3139] bg-[#16191E]">
                {t('matrix.sourceCol')} ({workspace.potFile.filename})
              </th>
              {poFiles.map((po) => (
                <th
                  key={po.id}
                  className="p-3 min-w-[280px] border-r border-[#2D3139] bg-[#16191E]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#3B82F6] font-mono font-bold uppercase">{po.language}</span>
                      <span className="text-[#E2E8F0] font-medium">{po.languageName}</span>
                    </div>
                    <span className="text-[9px] font-mono text-[#64748B]">
                      {po.entries.filter((e) => e.msgstr.some((s) => s.trim() !== '')).length}/{po.entries.length}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {groupByCategory ? (
              categorizedGroups.map(([catName, entries]) => {
                const isCollapsed = collapsedCategories.has(catName);
                const totalColSpan = 1 + poFiles.length;

                return (
                  <React.Fragment key={catName}>
                    {/* Category Header Row */}
                    <tr
                      ref={(el) => setCategoryRowRef(catName, el)}
                      onClick={() => toggleCategory(catName)}
                      className="bg-[#12151B] border-y border-[#2D3139] hover:bg-[#1A1F26] cursor-pointer transition-colors sticky top-[41px] z-10 select-none"
                    >
                      <td colSpan={totalColSpan} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[#94A3B8] hover:text-white">
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-[#38BDF8]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[#38BDF8]" />
                              )}
                            </span>
                            <Folder className="w-3.5 h-3.5 text-[#F59E0B]" />
                            <span className="font-semibold text-white font-sans text-xs tracking-wide">
                              {catName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#1C2128] text-[#38BDF8] border border-[#2D3139] text-[10px] font-mono font-bold">
                              {entries.length} {t('matrix.categoryKeys')}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-sans text-[#64748B]">
                            <span>{isCollapsed ? 'Click to expand' : 'Click to collapse'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Group entries if not collapsed */}
                    {!isCollapsed && entries.map((entry) => renderEntryRow(entry))}
                  </React.Fragment>
                );
              })
            ) : (
              potEntries.map((potEntry) => renderEntryRow(potEntry))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

