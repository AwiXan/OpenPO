/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Workspace, FilterStatus, LintIssue, AppSettings, PoFileRecord } from './types/gettext';
import { INITIAL_SAMPLE_WORKSPACES } from './lib/sampleWorkspaces';
import { serializePoFile } from './lib/poParser';
import { compileMoBinary } from './lib/moCompiler';
import { getPluralRuleForLanguage } from './lib/pluralEngine';
import { lintEntry } from './lib/linter';
import { buildCategoryTree } from './lib/categorizer';
import { useTranslation } from './lib/i18n';
import { globalTranslationMemory } from './lib/translationMemory';
import { computeWorkspaceGitStatus } from './lib/gitEngine';

// Custom Hooks
import { useFileSystemSync } from './hooks/useFileSystemSync';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';

// Components
import { TopHeader } from './components/TopHeader';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { LanguageSelectorBar } from './components/LanguageSelectorBar';
import { SidebarCategories } from './components/SidebarCategories';
import { StringListTable } from './components/StringListTable';
import { TranslationEditor } from './components/TranslationEditor';
import { MultiLanguageGridView } from './components/MultiLanguageGridView';

// Modals
import { NewKeyModal } from './components/NewKeyModal';
import { AddLanguageModal } from './components/AddLanguageModal';
import { RawPoModal } from './components/RawPoModal';
import { MoCompilerModal } from './components/MoCompilerModal';
import { BatchOperationsModal } from './components/BatchOperationsModal';
import { SettingsModal } from './components/SettingsModal';
import { GitModal } from './components/GitModal';
import { AboutModal } from './components/AboutModal';

const DEFAULT_SETTINGS: AppSettings = {
  fuzzyMatchingThreshold: 80,
  autoMarkFuzzyUnder100: true,
  authorName: 'Translator',
  authorEmail: 'translator@example.com',
  autoSaveInterval: 0,
  poNamingScheme: 'domain_lang',
  autoCompileMoOnSave: true,
  autoNewlineOnEnter: true,
  showNewlinesVisible: true,
};

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const savedSession = localStorage.getItem('openpo_session_workspaces');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.length > 0) {
          globalTranslationMemory.indexWorkspaces(parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved session workspaces:', e);
      }
    }
    const initial = INITIAL_SAMPLE_WORKSPACES;
    globalTranslationMemory.indexWorkspaces(initial);
    return initial;
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('openpo_session_active_id') || workspaces[0]?.id || '';
  });

  useEffect(() => {
    try {
      localStorage.setItem('openpo_session_workspaces', JSON.stringify(workspaces));
      localStorage.setItem('openpo_session_active_id', activeWorkspaceId);
    } catch (e) {
      console.warn('Workspaces too large for LocalStorage. Please use Folder Sync to persist data.');
    }
  }, [workspaces, activeWorkspaceId]);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('openpo_zoom');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const { t } = useTranslation();

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const currentWorkspace = useMemo(() => workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0], [workspaces, activeWorkspaceId]);

  const {
    localDirState,
    folderInputRef,
    recentFolders,
    loadFolderNatively,
    handleOpenLocalFolder,
    handleFolderInputChange,
    handleDisconnectLocalFolder,
    handleSyncLocalFolder,
    triggerDiskSyncForPo,
    handleExportWorkspaceZip,
    handleImportFile
  } = useFileSystemSync(activeWorkspaceId, currentWorkspace, setWorkspaces, setActiveWorkspaceId, settings, showToast, t);

  const {
    pushHistorySnapshot, canUndo, canRedo, handleUndo, handleRedo,
    handleAddCategory, handleSelectEntry, handleSelectFile, handleUpdateEntry, handleSyncPotEntry, handleUpdateCategory,
    handleAddKey, handleDeleteKey, handleAddLanguage, handleDeleteLanguage, handleToggleFuzzy, handleMatrixUpdateTranslation,
    handleRenameDomain, handleCreateWorkspace, handleCloseWorkspace, handleBatchApplyTm, handleClearAllFuzzy, handleMarkUntranslatedFuzzy,
    handleReorderWorkspaces
  } = useWorkspaceActions(activeWorkspaceId, currentWorkspace, setWorkspaces, setActiveWorkspaceId, settings, triggerDiskSyncForPo, showToast, t);

  useEffect(() => {
    localStorage.setItem('openpo_zoom', zoomLevel.toString());
    const handleKeyZoom = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoomLevel((prev) => Math.min(prev + 10, 250)); }
        else if (e.key === '-') { e.preventDefault(); setZoomLevel((prev) => Math.max(prev - 10, 60)); }
        else if (e.key === '0') { e.preventDefault(); setZoomLevel(100); }
      }
    };
    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoomLevel((prev) => e.deltaY < 0 ? Math.min(prev + 10, 250) : Math.max(prev - 10, 50));
      }
    };
    window.addEventListener('keydown', handleKeyZoom, { passive: false });
    window.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyZoom);
      window.removeEventListener('wheel', handleWheelZoom);
    };
  }, [zoomLevel]);

  const [sidebarWidth, setSidebarWidth] = useState<number>(270);
  const [editorWidth, setEditorWidth] = useState<number>(540);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const scale = zoomLevel / 100;
      if (isDraggingSidebar) setSidebarWidth(Math.max(180, Math.min(520, e.clientX / scale)));
      else if (isDraggingEditor) setEditorWidth(Math.max(320, Math.min(860, (window.innerWidth - e.clientX) / scale)));
    };
    const handleMouseUp = () => { setIsDraggingSidebar(false); setIsDraggingEditor(false); };
    if (isDraggingSidebar || isDraggingEditor) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSidebar, isDraggingEditor, zoomLevel]);

  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isAddLanguageModalOpen, setIsAddLanguageModalOpen] = useState(false);
  const [isRawPoModalOpen, setIsRawPoModalOpen] = useState(false);
  const [isMoCompilerModalOpen, setIsMoCompilerModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const activeFileId = currentWorkspace.activeFileId;
  const isPotActive = activeFileId === 'pot';
  const currentPoFile = useMemo(() => currentWorkspace.poFiles.find((p) => p.id === activeFileId) || currentWorkspace.poFiles[0], [currentWorkspace, activeFileId]);
  const activeEntries = useMemo(() => isPotActive ? currentWorkspace.potFile.entries : currentPoFile?.entries || [], [isPotActive, currentWorkspace.potFile, currentPoFile]);
  const currentPluralRule = useMemo(() => (isPotActive || !currentPoFile) ? getPluralRuleForLanguage('en') : getPluralRuleForLanguage(currentPoFile.language, currentPoFile.header.pluralForms), [isPotActive, currentPoFile]);

  useEffect(() => { globalTranslationMemory.indexWorkspaces(workspaces); }, [workspaces]);

  const issuesMap = useMemo(() => {
    const map = new Map<string, LintIssue[]>();
    if (!isPotActive && currentPoFile) {
      currentPoFile.entries.forEach((entry) => {
        const issues = lintEntry(entry, entry.msgidPlural ? currentPluralRule.nplurals : 1);
        if (issues.length > 0) map.set(entry.id, issues);
      });
    }
    return map;
  }, [isPotActive, currentPoFile, currentPluralRule]);

  const stats = useMemo(() => {
    let [total, translated, untranslated, fuzzy, plurals, issues] = [activeEntries.length, 0, 0, 0, 0, 0];
    activeEntries.forEach((entry) => {
      if (entry.msgidPlural) plurals++;
      if (isPotActive) translated++;
      else {
        const isFilled = entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
        if (!isFilled) untranslated++;
        else if (entry.flags.includes('fuzzy')) fuzzy++;
        else translated++;
      }
    });
    issuesMap.forEach((list) => { if (list.some((i) => i.type === 'error' || i.type === 'warning')) issues++; });
    return { total, translated, untranslated, fuzzy, issues, plurals };
  }, [activeEntries, isPotActive, issuesMap]);

  const categoryIssuesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    issuesMap.forEach((issues, entryId) => map.set(entryId, issues.length));
    return map;
  }, [issuesMap]);

  const categoryData = useMemo(() => buildCategoryTree(activeEntries, categoryIssuesCountMap, currentWorkspace.customCategories || []), [activeEntries, categoryIssuesCountMap, currentWorkspace.customCategories]);

  const filteredEntries = useMemo(() => activeEntries.filter((entry) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!entry.msgid.toLowerCase().includes(q) && !entry.msgidPlural?.toLowerCase().includes(q) && !entry.msgctxt?.toLowerCase().includes(q) && !entry.references.some((r) => r.toLowerCase().includes(q)) && !entry.msgstr.some((s) => s.toLowerCase().includes(q))) return false;
    }
    if (selectedCategory && !categoryData.pathToEntryIdsMap.get(selectedCategory)?.includes(entry.id)) return false;
    if (filterStatus === 'all') return true;
    const isFilled = entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
    if (filterStatus === 'untranslated') return !isFilled;
    if (filterStatus === 'fuzzy') return entry.flags.includes('fuzzy');
    if (filterStatus === 'translated') return isFilled && !entry.flags.includes('fuzzy');
    if (filterStatus === 'issues') return issuesMap.has(entry.id);
    if (filterStatus === 'plurals') return Boolean(entry.msgidPlural);
    return true;
  }), [activeEntries, searchQuery, selectedCategory, filterStatus, categoryData, issuesMap]);

  const activeEntryId = currentWorkspace.activeEntryId || filteredEntries[0]?.id || null;
  const currentEntry = useMemo(() => activeEntries.find((e) => e.id === activeEntryId) || null, [activeEntries, activeEntryId]);
  
  const tmSuggestions = useMemo(() => {
    if (!currentEntry || isPotActive || !currentPoFile) return [];
    return globalTranslationMemory.query(currentEntry.msgid, currentPoFile.language, (settings.fuzzyMatchingThreshold || 80) / 100);
  }, [currentEntry, isPotActive, currentPoFile, settings.fuzzyMatchingThreshold]);

  const gitModifiedCount = useMemo(() => computeWorkspaceGitStatus(currentWorkspace).filter((s) => s.isStaged || s.status !== 'unmodified').length, [currentWorkspace]);

  const activePotEntryId = useMemo(() => {
    if (isPotActive) return activeEntryId;
    if (!currentEntry) return null;
    const potMatch = currentWorkspace.potFile.entries.find((e) => e.msgid === currentEntry.msgid && (e.msgctxt || '') === (currentEntry.msgctxt || ''));
    return potMatch ? potMatch.id : activeEntryId;
  }, [isPotActive, activeEntryId, currentEntry, currentWorkspace.potFile.entries]);

  const handleNextEntry = useCallback(() => {
    const currentIndex = filteredEntries.findIndex((e) => e.id === activeEntryId);
    if (currentIndex >= 0 && currentIndex < filteredEntries.length - 1) handleSelectEntry(filteredEntries[currentIndex + 1].id);
  }, [filteredEntries, activeEntryId, handleSelectEntry]);

  const handlePrevEntry = useCallback(() => {
    const currentIndex = filteredEntries.findIndex((e) => e.id === activeEntryId);
    if (currentIndex > 0) handleSelectEntry(filteredEntries[currentIndex - 1].id);
  }, [filteredEntries, activeEntryId, handleSelectEntry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') { e.preventDefault(); handleSyncLocalFolder(); }
      else if (isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((isCmdOrCtrl && e.key.toLowerCase() === 'y') || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); handleRedo(); }
      else if (isCmdOrCtrl && e.key === 'Enter') { e.preventDefault(); handleNextEntry(); }
      else if (isCmdOrCtrl && e.key === 'ArrowDown') { e.preventDefault(); handleNextEntry(); }
      else if (isCmdOrCtrl && e.key === 'ArrowUp') { e.preventDefault(); handlePrevEntry(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextEntry, handlePrevEntry, handleUndo, handleRedo, handleSyncLocalFolder]);

  return (
    <div
      className="app-container"
      style={{ transform: `scale(${zoomLevel / 100})`, width: `${10000 / zoomLevel}vw`, height: `${10000 / zoomLevel}vh` }}
    >
      {toastMessage && (
        <div className={`toast-container ${toastMessage.type === 'success' ? 'toast-success' : toastMessage.type === 'warning' ? 'toast-warning' : 'toast-info'}`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      <TopHeader
        currentWorkspace={currentWorkspace}
        onOpenNewKeyModal={() => setIsNewKeyModalOpen(true)}
        onOpenAddLanguageModal={() => setIsAddLanguageModalOpen(true)}
        onOpenRawPoModal={() => setIsRawPoModalOpen(true)}
        onOpenMoCompilerModal={() => setIsMoCompilerModalOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenGitModal={() => setIsGitModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        onImportFile={handleImportFile}
        onOpenLocalFolder={handleOpenLocalFolder}
        localDirState={localDirState}
        onSyncLocalFolder={handleSyncLocalFolder}
        onDisconnectLocalFolder={handleDisconnectLocalFolder}
        onExportWorkspaceZip={handleExportWorkspaceZip}
        viewMode={viewMode}
        setViewMode={setViewMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        fuzzyThreshold={settings.fuzzyMatchingThreshold}
        gitModifiedCount={gitModifiedCount}
        recentFolders={recentFolders}
        onOpenRecent={(path) => loadFolderNatively(path)}
      />

      <WorkspaceTabs
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
        onCloseWorkspace={handleCloseWorkspace}
        onNewWorkspace={handleCreateWorkspace}
        onReorderWorkspaces={handleReorderWorkspaces}
      />

      <LanguageSelectorBar
        workspace={currentWorkspace}
        activeFileId={activeFileId}
        onSelectFile={handleSelectFile}
        onAddLanguage={() => setIsAddLanguageModalOpen(true)}
        onDownloadPo={(po: PoFileRecord, e) => {
          e.stopPropagation();
          const content = serializePoFile(po.header, po.entries, false);
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = po.filename; a.click(); URL.revokeObjectURL(url);
        }}
        onDownloadMo={(po: PoFileRecord, e) => {
          e.stopPropagation();
          const binary = compileMoBinary(po.header, po.entries);
          const blob = new Blob([binary], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = po.filename.replace(/\.po$/, '.mo'); a.click(); URL.revokeObjectURL(url);
        }}
        onDeleteLanguage={handleDeleteLanguage}
      />

      {viewMode === 'matrix' ? (
        <MultiLanguageGridView
          workspace={currentWorkspace}
          onUpdateTranslation={handleMatrixUpdateTranslation}
          showNewlinesVisible={settings.showNewlinesVisible}
          activeEntryId={activePotEntryId}
          onNavigateToEditor={(potEntryId) => {
            let targetId = potEntryId;
            if (!isPotActive && currentPoFile) {
              const potEntry = currentWorkspace.potFile.entries.find((e) => e.id === potEntryId);
              if (potEntry) {
                const poMatch = currentPoFile.entries.find((e) => e.msgid === potEntry.msgid && (e.msgctxt || '') === (potEntry.msgctxt || ''));
                if (poMatch) targetId = poMatch.id;
              }
            }
            handleSelectEntry(targetId);
            setViewMode('editor');
          }}
        />
      ) : (
        <main className="flex-1 flex overflow-hidden relative">
          <div style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }} className="h-full shrink-0 flex overflow-hidden">
            <SidebarCategories
              categoryTree={categoryData.tree}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              stats={stats}
              onAddCategory={handleAddCategory}
              onAssignActiveEntryToCategory={(catPath) => { if (activeEntryId) handleUpdateCategory(activeEntryId, catPath); }}
              activeEntryId={activeEntryId}
            />
          </div>

          <div
            onMouseDown={() => setIsDraggingSidebar(true)}
            onDoubleClick={() => setSidebarWidth(270)}
            className={`split-resizer ${isDraggingSidebar ? 'split-resizer-active' : ''}`}
          ><div className="split-resizer-line" /></div>

          <div className="flex-1 min-w-[260px] h-full flex flex-col overflow-hidden">
            <StringListTable
              entries={filteredEntries}
              activeEntryId={activeEntryId}
              onSelectEntry={handleSelectEntry}
              onToggleFuzzy={handleToggleFuzzy}
              onDeleteEntry={handleDeleteKey}
              issuesMap={issuesMap}
              isPotTemplate={isPotActive}
            />
          </div>

          <div
            onMouseDown={() => setIsDraggingEditor(true)}
            onDoubleClick={() => setEditorWidth(540)}
            className={`split-resizer ${isDraggingEditor ? 'split-resizer-active' : ''}`}
          ><div className="split-resizer-line" /></div>

          <div style={{ width: `${editorWidth}px`, minWidth: `${editorWidth}px` }} className="h-full shrink-0 flex overflow-hidden">
            <TranslationEditor
              entry={currentEntry}
              language={isPotActive ? 'POT' : currentPoFile?.language || 'en'}
              languageName={isPotActive ? 'Template' : currentPoFile?.languageName || 'Target'}
              pluralRule={currentPluralRule}
              onUpdateEntry={handleUpdateEntry}
              onSyncPotEntry={handleSyncPotEntry}
              onNextEntry={handleNextEntry}
              onPrevEntry={handlePrevEntry}
              tmSuggestions={tmSuggestions}
              isPotTemplate={isPotActive}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              fuzzyThreshold={settings.fuzzyMatchingThreshold}
              autoMarkFuzzyUnder100={settings.autoMarkFuzzyUnder100}
              onUpdateCategory={handleUpdateCategory}
              availableCategories={categoryData.allGroups.map((g) => g.name)}
              onNavigateToMatrix={() => setViewMode('matrix')}
            />
          </div>
        </main>
      )}

      <footer className="footer-bar">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-[#8B949E]">UTF-8</span><span className="text-[#21262D]">|</span>
          <span className="text-[#C9D1D9] truncate max-w-[160px]" title={isPotActive ? currentWorkspace.potFile.filename : currentPoFile?.filename}>{isPotActive ? currentWorkspace.potFile.filename : currentPoFile?.filename || 'workspace'}</span>
          {currentEntry && (<><span className="text-[#21262D]">|</span><span className="truncate max-w-[180px]" title={currentEntry.msgid}>Key: {currentEntry.msgid}</span></>)}
          {localDirState.isConnected && (<><span className="text-[#21262D]">|</span><span className="text-[#7EE787] truncate max-w-[300px]" title={localDirState.dirName}>Disk: {localDirState.dirName} {settings.autoCompileMoOnSave ? '(auto .mo)' : ''}</span></>)}
          <span className="text-[#21262D]">|</span><span className="text-[#79C0FF]">git:{currentWorkspace.git?.branch || 'main'}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[#8B949E]">
          <span>scheme: {settings.poNamingScheme || 'domain_lang'}</span><span>|</span>
          <span>tm: {settings.fuzzyMatchingThreshold}%</span><span>|</span>
          <span className="text-[#C9D1D9]">{stats.total} total <span className="text-[#8B949E]">•</span> {stats.untranslated} untranslated <span className="text-[#8B949E]">•</span> {stats.fuzzy} fuzzy</span>
        </div>
      </footer>

      <NewKeyModal isOpen={isNewKeyModalOpen} onClose={() => setIsNewKeyModalOpen(false)} onAddKey={(data) => { handleAddKey(data); if (data.category) handleAddCategory(data.category); }} availableCategories={categoryData.allGroups.map((g) => g.name)} defaultCategory={selectedCategory || ''} />
      <AddLanguageModal isOpen={isAddLanguageModalOpen} onClose={() => setIsAddLanguageModalOpen(false)} onAddLanguage={handleAddLanguage} existingLanguages={currentWorkspace.poFiles.map((p) => p.language)} />
      <RawPoModal isOpen={isRawPoModalOpen} onClose={() => setIsRawPoModalOpen(false)} filename={isPotActive ? currentWorkspace.potFile.filename : currentPoFile?.filename || 'messages.po'} header={isPotActive ? currentWorkspace.potFile.header : currentPoFile?.header || currentWorkspace.potFile.header} entries={isPotActive ? currentWorkspace.potFile.entries : currentPoFile?.entries || []} isPot={isPotActive} onSaveRaw={(newHeader, newEntries) => {
        pushHistorySnapshot(currentWorkspace);
        setWorkspaces((prev) => prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;
          if (isPotActive) return { ...w, potFile: { ...w.potFile, header: newHeader, entries: newEntries, isModified: true }, isModified: true };
          return { ...w, poFiles: w.poFiles.map((p) => p.id === currentPoFile?.id ? { ...p, header: newHeader, entries: newEntries, isModified: true } : p), isModified: true };
        }));
      }} />
      <MoCompilerModal isOpen={isMoCompilerModalOpen} onClose={() => setIsMoCompilerModalOpen(false)} workspace={currentWorkspace} />
      <BatchOperationsModal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} workspace={currentWorkspace} onBatchApplyTm={handleBatchApplyTm} onClearAllFuzzy={handleClearAllFuzzy} onMarkUntranslatedFuzzy={handleMarkUntranslatedFuzzy} fuzzyThreshold={settings.fuzzyMatchingThreshold} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSaveSettings={setSettings} domainName={currentWorkspace.domainName || currentWorkspace.potFile.domainName || 'messages'} onRenameDomain={handleRenameDomain} />
      <GitModal isOpen={isGitModalOpen} onClose={() => setIsGitModalOpen(false)} folderPath={localDirState.isConnected ? localDirState.dirName : null} authorName={settings.authorName} authorEmail={settings.authorEmail} />
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} onOpenSettings={() => { setIsAboutModalOpen(false); setIsSettingsModalOpen(true); }} />

      <input ref={folderInputRef} type="file" multiple onChange={handleFolderInputChange} className="hidden" />
    </div>
  );
}