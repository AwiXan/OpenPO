import React from 'react';
import {
  Clock,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { PoEntry, LintIssue } from '../types/gettext';
import { useTranslation } from '../lib/i18n';

interface StringListTableProps {
  entries: PoEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onToggleFuzzy: (id: string, e: React.MouseEvent) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  issuesMap: Map<string, LintIssue[]>;
  isPotTemplate: boolean;
}

export const StringListTable: React.FC<StringListTableProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onToggleFuzzy,
  onDeleteEntry,
  issuesMap,
  isPotTemplate,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col bg-[#090B0E] border-r border-[#2D3139] overflow-hidden select-none">
      {/* Table Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#16191E] border-b border-[#2D3139] text-[10px] font-bold text-[#64748B] uppercase tracking-wider z-10">
            <tr>
              <th className="px-3 py-2.5 w-6 text-center"></th>
              <th className="px-3 py-2.5">{t('table.sourceMsgid')}</th>
              <th className="px-3 py-2.5 w-28">{t('table.status')}</th>
              <th className="px-3 py-2.5 w-36">{t('table.validation')}</th>
              <th className="px-3 py-2.5 w-14 text-right"></th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {entries.map((entry) => {
              const isSelected = entry.id === activeEntryId;
              const isFilled =
                entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
              const isFuzzy = entry.flags.includes('fuzzy');
              const isPlural = Boolean(entry.msgidPlural);
              const issues = issuesMap.get(entry.id) || [];
              const hasError = issues.some((i) => i.type === 'error');
              const hasWarning = issues.some((i) => i.type === 'warning');
              const issueSeverity = hasError ? 'error' : hasWarning ? 'warning' : 'info';
              const IssueIcon = hasError ? AlertCircle : hasWarning ? AlertTriangle : Info;
              const pluralIssues = issues.filter((issue) => issue.field === 'plural');

              // Determine status dot color
              let dotColor = 'text-[#64748B]';
              if (isPotTemplate) {
                dotColor = 'text-[#3B82F6]';
              } else if (hasError) {
                dotColor = 'text-[#EF4444]';
              } else if (isFuzzy) {
                dotColor = 'text-[#F59E0B]';
              } else if (isFilled) {
                dotColor = 'text-[#4ADE80]';
              }

              return (
                <tr
                  key={entry.id}
                  onClick={() => onSelectEntry(entry.id)}
                  className={`group border-b border-[#16191E] cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#1E293B] border-l-2 border-[#3B82F6]'
                      : 'hover:bg-[#1E293B40]'
                  }`}
                >
                  {/* Status Dot */}
                  <td className={`px-3 py-2.5 text-center text-xs ${dotColor}`}>
                    ●
                  </td>

                  {/* Message ID / Content */}
                  <td className="px-3 py-2.5 overflow-hidden max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#E2E8F0] truncate">{entry.msgid}</span>
                      {isPlural && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#3B82F61A] text-[#3B82F6] font-mono shrink-0">
                          plural
                        </span>
                      )}
                      {entry.msgctxt && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#1C2128] text-[#94A3B8] font-mono truncate shrink-0 border border-[#2D3139]">
                          [{entry.msgctxt}]
                        </span>
                      )}
                    </div>

                    {!isPotTemplate && (
                      <div className="text-[11px] text-[#94A3B8] font-sans truncate mt-0.5">
                        {isFilled ? entry.msgstr[0] : <span className="text-[#64748B] italic">{t('table.untranslatedBadge')}</span>}
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-2.5">
                    {isPotTemplate ? (
                      <span className="text-[#3B82F6] bg-[#3B82F61A] px-2 py-0.5 rounded text-[10px] font-mono">
                        TEMPLATE
                      </span>
                    ) : !isFilled ? (
                      <span className="text-[#64748B] bg-[#64748B1A] px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('table.untranslatedBadge')}
                      </span>
                    ) : isFuzzy ? (
                      <span className="text-[#F59E0B] bg-[#F59E0B1A] px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('table.fuzzyBadge')}
                      </span>
                    ) : (
                      <span className="text-[#4ADE80] bg-[#4ADE801A] px-2 py-0.5 rounded text-[10px] font-mono">
                        {t('editor.translated')}
                      </span>
                    )}
                  </td>

                  {/* Validation Issues */}
                  <td className="px-3 py-2.5">
                    {issues.length > 0 ? (
                      <div
                        className={`flex items-center gap-1.5 rounded px-1.5 py-1 border ${
                          issueSeverity === 'error'
                            ? 'border-rose-800/70 bg-rose-950/30'
                            : issueSeverity === 'warning'
                              ? 'border-amber-800/70 bg-amber-950/20'
                              : 'border-sky-800/70 bg-sky-950/20'
                        }`}
                        title={issues.map((issue) => issue.message).join('\n')}
                      >
                        <IssueIcon className={`w-3.5 h-3.5 shrink-0 ${issueSeverity === 'error' ? 'text-rose-400' : issueSeverity === 'warning' ? 'text-amber-400' : 'text-sky-400'}`} />
                        <span className={`text-[10px] font-semibold ${issueSeverity === 'error' ? 'text-rose-300' : issueSeverity === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}>
                          {issues.length}
                        </span>
                        <span
                          className={`text-[10px] truncate max-w-[100px] ${
                            hasError ? 'text-rose-400' : 'text-[#F59E0B]'
                          }`}
                        >
                          {pluralIssues.length > 0 ? `${pluralIssues.length} ${t('table.pluralIssues')}` : t(`table.${issueSeverity}`)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#4ADE80] text-[10px]">{t('table.valid')}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isPotTemplate && (
                        <button
                          onClick={(e) => onToggleFuzzy(entry.id, e)}
                          className={`p-1 rounded hover:bg-[#2D3139] ${
                            isFuzzy ? 'text-[#F59E0B]' : 'text-[#64748B] hover:text-[#E2E8F0]'
                          }`}
                          title="Toggle fuzzy status"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => onDeleteEntry(entry.id, e)}
                        className="p-1 rounded hover:bg-rose-950/40 text-[#64748B] hover:text-[#EF4444]"
                        title={t('table.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#64748B] font-sans">
                  {t('table.noStrings')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
