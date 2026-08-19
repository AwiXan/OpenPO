import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Download,
  Binary,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Workspace, PoFileRecord } from '../types/gettext';
import { useTranslation } from '../lib/i18n';

interface LanguageSelectorBarProps {
  workspace: Workspace;
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onAddLanguage: () => void;
  onDownloadPo: (poFile: PoFileRecord, e: React.MouseEvent) => void;
  onDownloadMo: (poFile: PoFileRecord, e: React.MouseEvent) => void;
  onDeleteLanguage: (poFileId: string, e: React.MouseEvent) => void;
  viewMode?: 'editor' | 'matrix';
  hiddenMatrixFiles?: Set<string>;
  onToggleMatrixFile?: (fileId: string) => void;
}

export const LanguageSelectorBar: React.FC<LanguageSelectorBarProps> = ({
  workspace,
  viewMode, hiddenMatrixFiles, onToggleMatrixFile,
  activeFileId,
  onSelectFile,
  onAddLanguage,
  onDownloadPo,
  onDownloadMo,
  onDeleteLanguage,
}) => {
  const { t } = useTranslation();
  const isPotActive = activeFileId === 'pot';
  const potTotal = workspace.potFile.entries.length;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll bounds
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [workspace.poFiles.length]);

  // Scroll active tab into view on switch
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-id="${activeFileId}"]`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeFileId]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 240;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 300);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  return (
    <div className="bg-[#16191E] border-b border-[#2D3139] px-2 py-1.5 flex items-center justify-between gap-2 select-none relative group">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-1 z-20 p-1 rounded-md bg-[#090B0E]/95 hover:bg-[#1E293B] border border-[#2D3139] text-[#38BDF8] shadow-md transition-all cursor-pointer"
          title={t('langBar.scrollLeft')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Horizontal Scrollable Tabs Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        onWheel={handleWheel}
        className="flex-1 flex items-center gap-2 overflow-x-auto py-0.5 px-2 scroll-smooth custom-scrollbar no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* POT Master Template Tab */}
        {(() => {
          const isPotTabActive = viewMode === 'matrix' ? !hiddenMatrixFiles?.has('pot') : isPotActive;
          return (
            <button
              data-tab-id="pot"
              onClick={() => {
                if (viewMode === 'matrix' && onToggleMatrixFile) onToggleMatrixFile('pot');
                else onSelectFile('pot');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all border cursor-pointer shrink-0 ${
                isPotTabActive
                  ? 'bg-[#1E293B] border-[#3B82F6] text-[#E2E8F0] font-semibold shadow-xs'
                  : 'bg-[#090B0E] border-[#2D3139] text-[#64748B] hover:bg-[#1C2128] hover:text-[#E2E8F0] opacity-60 hover:opacity-100'
              }`}
              title={t('langBar.potTooltip')}
            >
              <FileText className={`w-3.5 h-3.5 ${isPotTabActive ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} />
              <span className="font-mono">{workspace.potFile.filename}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#090B0E] text-[10px] font-mono text-[#94A3B8] border border-[#2D3139]">
                {potTotal} {t('langBar.keys')}
              </span>
            </button>
          );
        })()}

        <div className="h-4 w-[1px] bg-[#2D3139] mx-0.5 shrink-0" />

        {/* PO Target Language Tabs */}
        {workspace.poFiles.map((po) => {
          const isPoTabActive = viewMode === 'matrix' ? !hiddenMatrixFiles?.has(po.id) : activeFileId === po.id;
          const total = po.entries.length;
          
          let translated = 0;
          let fuzzy = 0;
          let untranslated = 0;

          po.entries.forEach((e) => {
            const isFilled = e.msgstr.length > 0 && e.msgstr.some((s) => s && s.trim() !== '');
            if (!isFilled) {
              untranslated++;
            } else if (e.flags.includes('fuzzy')) {
              fuzzy++;
            } else {
              translated++;
            }
          });

          const pct = total > 0 ? Math.round((translated / total) * 100) : 0;
          const isComplete = pct === 100 && fuzzy === 0;

          return (
            <div
              key={po.id}
              data-tab-id={po.id}
              onClick={() => {
                if (viewMode === 'matrix' && onToggleMatrixFile) onToggleMatrixFile(po.id);
                else onSelectFile(po.id);
              }}
              className={`group/tab relative flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer transition-all border shrink-0 ${
                isPoTabActive
                  ? 'bg-[#1E293B] border-[#3B82F6] text-[#E2E8F0] font-semibold shadow-xs'
                  : 'bg-[#090B0E] border-[#2D3139] text-[#64748B] hover:bg-[#1C2128] hover:text-[#E2E8F0] opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="uppercase font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-[#16191E] text-[#38BDF8] border border-[#2D3139]">
                  {po.language}
                </span>
                <span className="text-[#E2E8F0] font-medium whitespace-nowrap">{po.languageName}</span>
              </div>

              {/* Progress Bar & Indicators */}
              <div className="flex items-center gap-1.5 pl-0.5">
                <div className="w-7 bg-[#090B0E] rounded-full h-1 overflow-hidden border border-[#2D3139]/40 shrink-0">
                  <div
                    className={`h-full transition-all ${
                      isComplete ? 'bg-[#4ADE80]' : pct > 50 ? 'bg-[#3B82F6]' : 'bg-[#F59E0B]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-[10px] font-mono whitespace-nowrap ${isComplete ? 'text-[#4ADE80] font-semibold' : 'text-[#64748B]'}`}>
                  {pct}%
                </span>

                {untranslated > 0 && (
                  <span
                    className="px-1 py-0.2 rounded bg-[#EF44441A] text-[#EF4444] text-[9px] font-mono border border-[#EF444433] shrink-0"
                    title={`${untranslated} untranslated`}
                  >
                    {untranslated}
                  </span>
                )}

                {fuzzy > 0 && (
                  <span
                    className="px-1 py-0.2 rounded bg-[#F59E0B1A] text-[#F59E0B] text-[9px] font-mono border border-[#F59E0B33] shrink-0"
                    title={`${fuzzy} fuzzy`}
                  >
                    {fuzzy}f
                  </span>
                )}
              </div>

              {/* Quick Actions (Download .PO, Download .MO, Delete) */}
              <div className="flex items-center gap-0.5 opacity-40 group-hover/tab:opacity-100 transition-opacity pl-1 border-l border-[#2D3139] shrink-0">
                <button
                  onClick={(e) => onDownloadPo(po, e)}
                  className="p-0.5 rounded hover:bg-[#2D3139] text-[#94A3B8] hover:text-[#E2E8F0]"
                  title={t('langBar.downloadPo')}
                >
                  <Download className="w-3 h-3 text-[#3B82F6]" />
                </button>
                <button
                  onClick={(e) => onDownloadMo(po, e)}
                  className="p-0.5 rounded hover:bg-[#2D3139] text-[#94A3B8] hover:text-[#4ADE80]"
                  title={t('langBar.downloadMo')}
                >
                  <Binary className="w-3 h-3 text-[#4ADE80]" />
                </button>
                {workspace.poFiles.length > 1 && (
                  <button
                    onClick={(e) => onDeleteLanguage(po.id, e)}
                    className="p-0.5 rounded hover:bg-red-500/20 text-[#64748B] hover:text-[#EF4444]"
                    title={t('langBar.removeLang')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Language Button */}
        <button
          id="btn-langbar-add-language"
          onClick={onAddLanguage}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-[#090B0E] hover:bg-[#1C2128] text-[#94A3B8] hover:text-[#4ADE80] border border-dashed border-[#2D3139] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 text-[#4ADE80]" />
          <span>{t('langBar.addLanguage')}</span>
        </button>
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-1 z-20 p-1 rounded-md bg-[#090B0E]/95 hover:bg-[#1E293B] border border-[#2D3139] text-[#38BDF8] shadow-md transition-all cursor-pointer"
          title={t('langBar.scrollRight')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="text-[10px] text-[#64748B] font-mono flex items-center gap-2 shrink-0 pl-2 border-l border-[#2D3139]/60 hidden md:flex">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
          <span>{t('langBar.autoReady')}</span>
        </span>
      </div>
    </div>
  );
};
