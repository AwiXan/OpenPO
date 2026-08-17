import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  Download,
  FileCode,
  Sparkles,
  Layers,
  FileSpreadsheet,
  Binary,
  Code2,
  Undo2,
  Redo2,
  GitBranch,
  Settings,
  FolderSync,
  RefreshCw,
  Unlink,
  Check,
  HelpCircle,
} from 'lucide-react';
import { Workspace, LocalDirectoryState } from '../types/gettext';
import { useTranslation, SUPPORTED_UI_LANGUAGES, UiLanguage } from '../lib/i18n';

interface TopHeaderProps {
  currentWorkspace: Workspace;
  onOpenNewKeyModal: () => void;
  onOpenAddLanguageModal: () => void;
  onOpenRawPoModal: () => void;
  onOpenMoCompilerModal: () => void;
  onOpenBatchModal: () => void;
  onOpenGitModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAboutModal: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLocalFolder: () => void;
  localDirState: LocalDirectoryState;
  onSyncLocalFolder: () => void;
  onDisconnectLocalFolder: () => void;
  onExportWorkspaceZip: () => void;
  viewMode: 'editor' | 'matrix';
  setViewMode: (mode: 'editor' | 'matrix') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  fuzzyThreshold: number;
  gitModifiedCount: number;
}

type MenuKey = 'file' | 'edit' | 'view' | 'tools' | 'language' | 'help' | null;

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentWorkspace,
  onOpenNewKeyModal,
  onOpenAddLanguageModal,
  onOpenRawPoModal,
  onOpenMoCompilerModal,
  onOpenBatchModal,
  onOpenGitModal,
  onOpenSettingsModal,
  onOpenAboutModal,
  onImportFile,
  onOpenLocalFolder,
  localDirState,
  onSyncLocalFolder,
  onDisconnectLocalFolder,
  onExportWorkspaceZip,
  viewMode,
  setViewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  fuzzyThreshold,
  gitModifiedCount,
}) => {
  const { language: currentUiLang, setLanguage: setUiLanguage, t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarScrollRef = useRef<HTMLDivElement>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll bounds for quick actions toolbar
  const checkToolbarScroll = () => {
    const el = toolbarScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkToolbarScroll();
    const el = toolbarScrollRef.current;
    if (!el) return;

    // Support mousewheel horizontal scrolling
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        el.scrollLeft += delta;
        checkToolbarScroll();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', checkToolbarScroll, { passive: true });
    window.addEventListener('resize', checkToolbarScroll);

    // Initial re-check after slight layout settle
    const timer = setTimeout(checkToolbarScroll, 100);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('scroll', checkToolbarScroll);
      window.removeEventListener('resize', checkToolbarScroll);
    };
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLangInfo =
    SUPPORTED_UI_LANGUAGES.find((l) => l.code === currentUiLang) || SUPPORTED_UI_LANGUAGES[0];

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onSyncLocalFolder();
    setTimeout(() => setIsSyncing(false), 500);
  };

  const handleMenuToggle = (menu: MenuKey) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuHover = (menu: MenuKey) => {
    if (activeMenu !== null) {
      setActiveMenu(menu);
    }
  };

  return (
    <header className="bg-[#16191E] border-b border-[#2D3139] text-[#E2E8F0] select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onImportFile}
        accept=".po,.pot"
        multiple
        className="hidden"
      />

      {/* Top Application Window Bar & Native Desktop Menu */}
      <div
        ref={menuBarRef}
        className="h-9 px-3 flex items-center justify-between border-b border-[#2D3139] text-xs bg-[#090B0E] relative z-40"
      >
        <div className="flex items-center space-x-2.5">
          {/* App Branding */}
          <div className="flex items-center space-x-1.5 font-medium text-[#E2E8F0] pr-2">
            <span className="text-[#3B82F6] font-bold text-sm">◇</span>
            <span className="tracking-tight font-semibold text-xs text-white">OpenPO</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1C2128] text-[#38BDF8] border border-[#2D3139] font-mono">
              v1.0
            </span>
          </div>

          {/* Desktop Menu Bar (File, Edit, View, Tools, Language, Help) */}
          <nav className="flex items-center space-x-0.5 text-xs text-[#94A3B8]">
            {/* FILE MENU */}
            <div className="relative">
              <button
                id="menu-file-btn"
                onClick={() => handleMenuToggle('file')}
                onMouseEnter={() => handleMenuHover('file')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'file'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                {t('menu.file')}
              </button>

              {activeMenu === 'file' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenLocalFolder();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderSync className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.openFolder')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-[#3B82F6]" />
                      <span>{t('menu.openFiles')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">.po / .pot</span>
                  </button>

                  <div className="border-t border-[#2D3139] my-1" />

                  <button
                    onClick={() => {
                      onOpenNewKeyModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#4ADE80]" />
                      <span>{t('menu.newKey')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">Ctrl+N</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenAddLanguageModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#4ADE80]" />
                      <span>{t('menu.addLanguage')}</span>
                    </div>
                  </button>

                  <div className="border-t border-[#2D3139] my-1" />

                  <button
                    onClick={() => {
                      if (localDirState.isConnected) {
                        handleManualSync();
                      } else {
                        onOpenLocalFolder();
                      }
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.saveSync')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">Ctrl+S</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenMoCompilerModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.compileMo')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">.mo</span>
                  </button>

                  <button
                    onClick={() => {
                      onExportWorkspaceZip();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-[#3B82F6]" />
                      <span>{t('menu.exportZip')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">.zip</span>
                  </button>

                  {localDirState.isConnected && (
                    <>
                      <div className="border-t border-[#2D3139] my-1" />
                      <button
                        onClick={() => {
                          onDisconnectLocalFolder();
                          setActiveMenu(null);
                        }}
                        className="w-full px-3 py-1.5 flex items-center justify-between text-left text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Unlink className="w-4 h-4 text-rose-400" />
                          <span>{t('menu.disconnectFolder')}</span>
                        </div>
                        <span className="text-[10px] font-mono truncate max-w-[80px]">
                          {localDirState.dirName}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* EDIT MENU */}
            <div className="relative">
              <button
                id="menu-edit-btn"
                onClick={() => handleMenuToggle('edit')}
                onMouseEnter={() => handleMenuHover('edit')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'edit'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                {t('menu.edit')}
              </button>

              {activeMenu === 'edit' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      if (canUndo) onUndo();
                      setActiveMenu(null);
                    }}
                    disabled={!canUndo}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      canUndo
                        ? 'text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8]'
                        : 'text-[#64748B] opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Undo2 className="w-4 h-4" />
                      <span>{t('header.undo')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">Ctrl+Z</span>
                  </button>

                  <button
                    onClick={() => {
                      if (canRedo) onRedo();
                      setActiveMenu(null);
                    }}
                    disabled={!canRedo}
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      canRedo
                        ? 'text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8]'
                        : 'text-[#64748B] opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Redo2 className="w-4 h-4" />
                      <span>{t('header.redo')}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono">Ctrl+Y</span>
                  </button>

                  <div className="border-t border-[#2D3139] my-1" />

                  <button
                    onClick={() => {
                      onOpenBatchModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                      <span>{t('menu.batchTm')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* VIEW MENU */}
            <div className="relative">
              <button
                id="menu-view-btn"
                onClick={() => handleMenuToggle('view')}
                onMouseEnter={() => handleMenuHover('view')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'view'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                {t('menu.view')}
              </button>

              {activeMenu === 'view' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      setViewMode('editor');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.viewEditor')}</span>
                    </div>
                    {viewMode === 'editor' && <Check className="w-3.5 h-3.5 text-[#38BDF8]" />}
                  </button>

                  <button
                    onClick={() => {
                      setViewMode('matrix');
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.viewMatrix')}</span>
                    </div>
                    {viewMode === 'matrix' && <Check className="w-3.5 h-3.5 text-[#38BDF8]" />}
                  </button>

                  <div className="border-t border-[#2D3139] my-1" />

                  <button
                    onClick={() => {
                      onOpenRawPoModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#94A3B8]" />
                      <span>{t('menu.viewRaw')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* TOOLS MENU */}
            <div className="relative">
              <button
                id="menu-tools-btn"
                onClick={() => handleMenuToggle('tools')}
                onMouseEnter={() => handleMenuHover('tools')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'tools'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                {t('menu.tools')}
              </button>

              {activeMenu === 'tools' && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenMoCompilerModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Binary className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('header.compileMo')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenGitModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('header.git')}</span>
                    </div>
                    {gitModifiedCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-[#3B82F6] text-white text-[9px] font-mono font-bold">
                        {gitModifiedCount}
                      </span>
                    )}
                  </button>

                  <div className="border-t border-[#2D3139] my-1" />

                  <button
                    onClick={() => {
                      onOpenSettingsModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#94A3B8]" />
                      <span>{t('menu.preferences')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* LANGUAGE MENU (App UI Languages) */}
            <div className="relative">
              <button
                id="menu-language-btn"
                onClick={() => handleMenuToggle('language')}
                onMouseEnter={() => handleMenuHover('language')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                  activeMenu === 'language'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                <span>{t('menu.language')}</span>
                <span className="text-[10px] text-[#38BDF8] uppercase font-mono font-bold ml-0.5">
                  ({activeLangInfo.code})
                </span>
              </button>

              {activeMenu === 'language' && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#2D3139]">
                    {t('settings.languageTab')}
                  </div>
                  {SUPPORTED_UI_LANGUAGES.map((lang) => {
                    const isCurrent = currentUiLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setUiLanguage(lang.code as UiLanguage);
                          setActiveMenu(null);
                        }}
                        className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#1E293B] text-[#38BDF8] font-semibold'
                            : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.nativeName}</span>
                        </div>
                        {isCurrent ? (
                          <Check className="w-3.5 h-3.5 text-[#38BDF8]" />
                        ) : (
                          <span className="font-mono text-[10px] text-[#64748B] uppercase">
                            {lang.code}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HELP MENU */}
            <div className="relative">
              <button
                id="menu-help-btn"
                onClick={() => handleMenuToggle('help')}
                onMouseEnter={() => handleMenuHover('help')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer text-xs ${
                  activeMenu === 'help'
                    ? 'bg-[#2D3748] text-white font-medium'
                    : 'hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                }`}
              >
                {t('menu.help')}
              </button>

              {activeMenu === 'help' && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-[#16191E] border border-[#2D3139] rounded-lg shadow-2xl py-1 z-50 text-xs font-sans">
                  <button
                    onClick={() => {
                      onOpenAboutModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('menu.about')}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onOpenSettingsModal();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[#E2E8F0] hover:bg-[#1E293B] hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#94A3B8]" />
                      <span>{t('menu.shortcuts')}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Status Indicator, Local Folder Sync, Git & TM Badges */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Local Folder Connected Status Badge */}
          {localDirState.isConnected ? (
            <div className="flex items-center gap-1.5 bg-[#4ADE801A] border border-[#4ADE8044] px-2 py-0.5 rounded text-[11px] font-mono text-[#4ADE80]">
              <FolderSync className="w-3 h-3 animate-pulse" />
              <span className="font-semibold max-w-[120px] truncate" title={localDirState.dirName}>
                {localDirState.dirName}
              </span>
              <span className="text-[9px] text-[#94A3B8]">
                {localDirState.autoCompileMo ? '(Auto .MO)' : '(Disk Sync)'}
              </span>
              <button
                onClick={handleManualSync}
                className="hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                title="Force Sync & Compile .MO to Disk"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onDisconnectLocalFolder}
                className="hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                title="Disconnect local folder"
              >
                <Unlink className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLocalFolder}
              className="flex items-center gap-1.5 text-[11px] font-mono bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Open a local directory containing .pot and .po files for direct disk editing and automatic .mo generation"
            >
              <FolderSync className="w-3 h-3 text-[#38BDF8]" />
              <span>Open Local Folder</span>
            </button>
          )}

          {/* Git Quick Status Badge */}
          <button
            id="btn-git-header"
            onClick={onOpenGitModal}
            className="flex items-center gap-1.5 text-[11px] font-mono bg-[#1C2128] hover:bg-[#2D3748] border border-[#2D3139] px-2 py-0.5 rounded transition-colors cursor-pointer text-[#38BDF8]"
            title="Open Git Source Control & Commit History"
          >
            <GitBranch className="w-3 h-3 text-[#38BDF8]" />
            <span>{currentWorkspace.git?.branch || 'main'}</span>
            {gitModifiedCount > 0 && (
              <span className="px-1 py-0.2 rounded bg-[#3B82F6] text-white text-[9px] font-bold">
                {gitModifiedCount}
              </span>
            )}
          </button>

          {/* TM Threshold Badge */}
          <button
            id="btn-tm-settings-badge"
            onClick={onOpenSettingsModal}
            className="flex items-center gap-1 text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B1A] border border-[#F59E0B33] px-2 py-0.5 rounded cursor-pointer hover:bg-[#F59E0B33] transition-colors"
            title="Translation Memory Fuzzy Threshold - Click to configure"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>TM ≥{fuzzyThreshold}%</span>
          </button>
        </div>
      </div>

      {/* Main Tool Bar (Pinned Ends + Scrollable Middle Track) */}
      <div className="relative flex items-center h-11 px-3 bg-[#16191E] border-t border-[#23272F]">
        {/* Left Pinned Items: History & New Key */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {/* Undo / Redo */}
          <div className="flex items-center bg-[#090B0E] p-0.5 rounded border border-[#2D3139]">
            <button
              id="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                canUndo
                  ? 'text-[#E2E8F0] hover:bg-[#1C2128] hover:text-[#38BDF8]'
                  : 'text-[#64748B] opacity-40 cursor-not-allowed'
              }`}
              title={t('header.undo')}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                canRedo
                  ? 'text-[#E2E8F0] hover:bg-[#1C2128] hover:text-[#38BDF8]'
                  : 'text-[#64748B] opacity-40 cursor-not-allowed'
              }`}
              title={t('header.redo')}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Key */}
          <button
            id="btn-add-key"
            onClick={onOpenNewKeyModal}
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-2.5 sm:px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            title="Add new msgid key to .pot and sync all .po files"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('header.addKey')}</span>
          </button>
        </div>

        <div className="h-5 w-[1px] bg-[#2D3139] mx-1 shrink-0" />

        {/* Middle Scrollable Section with End Gradients */}
        <div className="relative flex-1 flex items-center min-w-0 overflow-hidden h-full">
          {/* Left fading edge gradient */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#16191E] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Scrollable buttons track (scrollable by drag or mousewheel) */}
          <div
            ref={toolbarScrollRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1.5 py-1"
          >
            {/* File Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-open-folder"
                onClick={onOpenLocalFolder}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Open local directory with .pot/.po files for live disk sync and automatic .mo compilation"
              >
                <FolderSync className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>{t('header.openFolder')}</span>
              </button>

              <button
                id="btn-import-file"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Import single or multiple .po / .pot files"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>{t('header.open')}</span>
              </button>

              <button
                id="btn-add-language"
                onClick={onOpenAddLanguageModal}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Add target language .po file"
              >
                <Layers className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>{t('header.addLanguage')}</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#2D3139] mx-0.5 shrink-0" />

            {/* Tools & Operations */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-batch-tm"
                onClick={onOpenBatchModal}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Batch operations & Translation Memory fill"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>{t('header.batchTm')}</span>
              </button>

              <button
                id="btn-mo-compiler"
                onClick={onOpenMoCompilerModal}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Compile GNU gettext .MO binary files"
              >
                <Binary className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>{t('header.compileMo')}</span>
              </button>

              <button
                id="btn-view-git"
                onClick={onOpenGitModal}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Open Git Source Control & Commit History"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>{t('header.git')}</span>
                {gitModifiedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-[#3B82F6] text-white text-[10px] font-bold font-mono">
                    {gitModifiedCount}
                  </span>
                )}
              </button>

              <button
                id="btn-view-raw-po"
                onClick={onOpenRawPoModal}
                className="px-2 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs border border-[#2D3139] transition-colors cursor-pointer"
                title="Inspect & Edit Raw PO/POT source"
              >
                <Code2 className="w-3.5 h-3.5 text-[#94A3B8]" />
              </button>

              <button
                id="btn-export-zip"
                onClick={onExportWorkspaceZip}
                className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                title="Export full workspace with all .po and compiled .mo files as ZIP"
              >
                <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>{t('header.exportZip')}</span>
              </button>
            </div>
          </div>

          {/* Right fading edge gradient */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#16191E] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* Right Pinned Items: Settings & View Mode Switcher */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#2D3139] shrink-0">
          {/* Settings Button */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettingsModal}
            className="px-2.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer shrink-0"
            title="Preferences, Modular Settings, and TM"
          >
            <Settings className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="hidden sm:inline">{t('header.settings')}</span>
          </button>

          <div className="flex bg-[#090B0E] p-0.5 rounded border border-[#2D3139] shrink-0">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'editor'
                  ? 'bg-[#2D3748] text-white font-medium shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0]'
              }`}
              title="Standard Single Language Editor"
            >
              <FileCode className="w-3 h-3" />
              <span>{t('header.editor')}</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'matrix'
                  ? 'bg-[#2D3748] text-white font-medium shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0]'
              }`}
              title="Multi-Language Matrix (Side-by-side editing)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>{t('header.matrix')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input for single or multiple .po / .pot files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".po,.pot"
        onChange={onImportFile}
        className="hidden"
      />
    </header>
  );
};
