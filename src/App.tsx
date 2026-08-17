/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import {
  Workspace,
  PoEntry,
  PoFileRecord,
  PotFileRecord,
  PoHeader,
  FilterStatus,
  LintIssue,
  AppSettings,
  WorkspaceSnapshot,
  LocalDirectoryState,
} from './types/gettext';
import { INITIAL_SAMPLE_WORKSPACES } from './lib/sampleWorkspaces';
import { parsePoContent, serializePoFile, generateEntryId } from './lib/poParser';
import { compileMoBinary } from './lib/moCompiler';
import { getPluralRuleForLanguage } from './lib/pluralEngine';
import { lintEntry } from './lib/linter';
import { buildCategoryTree, normalizeCategoryPath } from './lib/categorizer';
import { useTranslation } from './lib/i18n';
import { globalTranslationMemory } from './lib/translationMemory';
import {
  scanLocalDirectory,
  scanFileList,
  savePoAndMoToDirectory,
  saveWorkspaceToDirectory,
  formatPoFilename,
  formatMoFilename,
} from './lib/localDirectoryManager';
import {
  initGitRepository,
  stageGitFile,
  unstageGitFile,
  stageAllGitFiles,
  unstageAllGitFiles,
  commitStagedChanges,
  revertFileToHead,
  restoreCommitSnapshot,
  computeWorkspaceGitStatus,
} from './lib/gitEngine';

import { TopHeader } from './components/TopHeader';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { LanguageSelectorBar } from './components/LanguageSelectorBar';
import { SidebarCategories } from './components/SidebarCategories';
import { StringListTable } from './components/StringListTable';
import { TranslationEditor } from './components/TranslationEditor';
import { MultiLanguageGridView } from './components/MultiLanguageGridView';

import { pickNativeDirectory, scanNativeDirectoryFiles, writeNativeTextFile, writeNativeBinaryFile } from './lib/nativeFS';

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
    const initial = INITIAL_SAMPLE_WORKSPACES;
    globalTranslationMemory.indexWorkspaces(initial);
    return initial;
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    INITIAL_SAMPLE_WORKSPACES[0]?.id || ''
  );

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('openpo_zoom');
    return saved ? parseInt(saved, 10) : 100;
  });

  useEffect(() => {
    localStorage.setItem('openpo_zoom', zoomLevel.toString());
  }, [zoomLevel]);

  useEffect(() => {
    const handleKeyZoom = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoomLevel((prev) => Math.min(prev + 10, 250)); // Max 250%
        } else if (e.key === '-') {
          e.preventDefault();
          setZoomLevel((prev) => Math.max(prev - 10, 60)); // Min 50%
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(100); // Сброс на 100%
        }
      }
    };

    const handleWheelZoom = (e: WheelEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomLevel((prev) => Math.min(prev + 10, 250));
        } else {
          setZoomLevel((prev) => Math.max(prev - 10, 50));
        }
      }
    };

    window.addEventListener('keydown', handleKeyZoom, { passive: false });
    window.addEventListener('wheel', handleWheelZoom, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyZoom);
      window.removeEventListener('wheel', handleWheelZoom);
    };
  }, []);

  const [localDirState, setLocalDirState] = useState<LocalDirectoryState>({
    isConnected: false,
    dirName: '',
    dirHandle: null,
    autoCompileMo: true,
    totalFiles: 0,
  });

  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const { t } = useTranslation();

  // Status notification banner
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const handleAddCategory = useCallback(
    (categoryPath: string) => {
      if (!categoryPath || !categoryPath.trim()) return;
      const normalized = normalizeCategoryPath(categoryPath);
      if (!normalized) return;
      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;
          const existing = w.customCategories || [];
          if (existing.includes(normalized)) return w;
          return {
            ...w,
            customCategories: [...existing, normalized],
            isModified: true,
          };
        })
      );
      showToast(`${t('category.category')}: ${normalized}`, 'success');
    },
    [activeWorkspaceId, showToast, t]
  );

  // Resizable split widths
  const [sidebarWidth, setSidebarWidth] = useState<number>(270);
  const [editorWidth, setEditorWidth] = useState<number>(540);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);

  // Mouse move / up handler for dragging dividers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        // Clamp sidebar between 180px and 520px
        const newWidth = Math.max(180, Math.min(520, e.clientX));
        setSidebarWidth(newWidth);
      } else if (isDraggingEditor) {
        // Clamp editor between 320px and 860px from right edge
        const newWidth = Math.max(320, Math.min(860, window.innerWidth - e.clientX));
        setEditorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingEditor(false);
    };

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
  }, [isDraggingSidebar, isDraggingEditor]);

  // History state for Undo / Redo per workspace
  const [historyMap, setHistoryMap] = useState<
    Record<string, { past: WorkspaceSnapshot[]; future: WorkspaceSnapshot[] }>
  >({});

  // Modals state
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isAddLanguageModalOpen, setIsAddLanguageModalOpen] = useState(false);
  const [isRawPoModalOpen, setIsRawPoModalOpen] = useState(false);
  const [isMoCompilerModalOpen, setIsMoCompilerModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Active workspace
  const currentWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Active file in workspace ('pot' or po.id)
  const activeFileId = currentWorkspace.activeFileId;
  const isPotActive = activeFileId === 'pot';

  const currentPoFile = useMemo(() => {
    return currentWorkspace.poFiles.find((p) => p.id === activeFileId) || currentWorkspace.poFiles[0];
  }, [currentWorkspace, activeFileId]);

  const activeEntries = useMemo(() => {
    if (isPotActive) {
      return currentWorkspace.potFile.entries;
    }
    return currentPoFile?.entries || [];
  }, [isPotActive, currentWorkspace.potFile, currentPoFile]);

  // Active Plural Rule
  const currentPluralRule = useMemo(() => {
    if (isPotActive || !currentPoFile) {
      return getPluralRuleForLanguage('en');
    }
    return getPluralRuleForLanguage(currentPoFile.language, currentPoFile.header.pluralForms);
  }, [isPotActive, currentPoFile]);

  // Index TM when workspaces update
  useEffect(() => {
    globalTranslationMemory.indexWorkspaces(workspaces);
  }, [workspaces]);

  // Compute Linter issues map
  const issuesMap = useMemo(() => {
    const map = new Map<string, LintIssue[]>();
    if (!isPotActive && currentPoFile) {
      currentPoFile.entries.forEach((entry) => {
        const required = entry.msgidPlural ? currentPluralRule.nplurals : 1;
        const issues = lintEntry(entry, required);
        if (issues.length > 0) {
          map.set(entry.id, issues);
        }
      });
    }
    return map;
  }, [isPotActive, currentPoFile, currentPluralRule]);

  // Compute statistics
  const stats = useMemo(() => {
    const total = activeEntries.length;
    let translated = 0;
    let untranslated = 0;
    let fuzzy = 0;
    let plurals = 0;

    activeEntries.forEach((entry) => {
      const isPlural = Boolean(entry.msgidPlural);
      if (isPlural) plurals++;

      if (isPotActive) {
        translated++;
      } else {
        const isFilled = entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
        if (!isFilled) {
          untranslated++;
        } else if (entry.flags.includes('fuzzy')) {
          fuzzy++;
        } else {
          translated++;
        }
      }
    });

    let issues = 0;
    issuesMap.forEach((list) => {
      if (list.some((i) => i.type === 'error' || i.type === 'warning')) {
        issues++;
      }
    });

    return { total, translated, untranslated, fuzzy, issues, plurals };
  }, [activeEntries, isPotActive, issuesMap]);

  // Grouped Categories & Hierarchical Tree
  const categoryIssuesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    issuesMap.forEach((issues, entryId) => {
      map.set(entryId, issues.length);
    });
    return map;
  }, [issuesMap]);

  const categoryData = useMemo(() => {
    return buildCategoryTree(
      activeEntries,
      categoryIssuesCountMap,
      currentWorkspace.customCategories || []
    );
  }, [activeEntries, categoryIssuesCountMap, currentWorkspace.customCategories]);

  // Filtered entries for string table
  const filteredEntries = useMemo(() => {
    return activeEntries.filter((entry) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = entry.msgid.toLowerCase().includes(q);
        const matchesPlural = entry.msgidPlural?.toLowerCase().includes(q) || false;
        const matchesContext = entry.msgctxt?.toLowerCase().includes(q) || false;
        const matchesRef = entry.references.some((r) => r.toLowerCase().includes(q));
        const matchesStr = entry.msgstr.some((s) => s.toLowerCase().includes(q));
        if (!matchesId && !matchesPlural && !matchesContext && !matchesRef && !matchesStr) {
          return false;
        }
      }

      // 2. Hierarchical Category Filter
      if (selectedCategory) {
        const matchingIds = categoryData.pathToEntryIdsMap.get(selectedCategory);
        if (matchingIds && !matchingIds.includes(entry.id)) {
          return false;
        }
      }

      // 3. Status Filter
      if (filterStatus === 'all') return true;

      const isFilled = entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim() !== '');
      const isFuzzy = entry.flags.includes('fuzzy');
      const isPlural = Boolean(entry.msgidPlural);
      const hasIssues = issuesMap.has(entry.id);

      if (filterStatus === 'untranslated') return !isFilled;
      if (filterStatus === 'fuzzy') return isFuzzy;
      if (filterStatus === 'translated') return isFilled && !isFuzzy;
      if (filterStatus === 'issues') return hasIssues;
      if (filterStatus === 'plurals') return isPlural;

      return true;
    });
  }, [activeEntries, searchQuery, selectedCategory, filterStatus, categoryData, issuesMap]);

  // Active Entry
  const activeEntryId = currentWorkspace.activeEntryId || filteredEntries[0]?.id || null;
  const currentEntry = useMemo(() => {
    return activeEntries.find((e) => e.id === activeEntryId) || null;
  }, [activeEntries, activeEntryId]);

  // TM suggestions for current entry using user configured threshold
  const tmSuggestions = useMemo(() => {
    if (!currentEntry || isPotActive || !currentPoFile) return [];
    const minSim = (settings.fuzzyMatchingThreshold || 80) / 100;
    return globalTranslationMemory.query(currentEntry.msgid, currentPoFile.language, minSim);
  }, [currentEntry, isPotActive, currentPoFile, settings.fuzzyMatchingThreshold]);

  // Git modified files count
  const gitModifiedCount = useMemo(() => {
    const statuses = computeWorkspaceGitStatus(currentWorkspace);
    return statuses.filter((s) => s.isStaged || s.status !== 'unmodified').length;
  }, [currentWorkspace]);

  // -------------------------------------------------------------
  // Local Directory Live Disk Sync & Auto .MO Generation
  // -------------------------------------------------------------
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('mozdirectory', '');
    }
  }, []);

  const loadFolderNatively = async (dirPath: string) => {
    try {
      const files = await scanNativeDirectoryFiles(dirPath);
      if (files.length === 0) {
        showToast(`No gettext files found in: ${dirPath}`, 'warning');
        return false;
      }

      const potFileScanned = files.find((f) => f.name.endsWith('.pot'));
      const poFilesScanned = files.filter((f) => f.name.endsWith('.po'));

      const domainName = potFileScanned ? potFileScanned.name.replace(/\.pot$/, '') : 'messages';
      
      const parsedPot = potFileScanned 
        ? parsePoContent(potFileScanned.content)
        : { header: { mimeVersion: '1.0', contentType: 'text/plain; charset=UTF-8', contentTransferEncoding: '8bit' }, entries: [] };

      const potRecord: PotFileRecord = {
        id: `pot_${Date.now()}`,
        filename: potFileScanned ? potFileScanned.name : `${domainName}.pot`,
        domainName,
        header: parsedPot.header,
        entries: parsedPot.entries,
      };

      const poRecords: PoFileRecord[] = poFilesScanned.map((f, i) => {
        const parsed = parsePoContent(f.content);
        const langCode = parsed.header.language || f.name.replace(/\.po$/, '');
        return {
          id: `po_${langCode}_${Date.now()}_${i}`,
          filename: f.name,
          language: langCode,
          languageName: langCode.toUpperCase(),
          header: parsed.header,
          entries: parsed.entries,
        };
      });

      const loadedWorkspace: Workspace = {
        id: `ws_${Date.now()}`,
        name: domainName,
        domainName,
        potFile: potRecord,
        poFiles: poRecords,
        activeFileId: poRecords[0]?.id || 'pot',
        activeEntryId: potRecord.entries[0]?.id || null,
        createdAt: new Date().toISOString(),
      };

      setWorkspaces([loadedWorkspace]);
      setActiveWorkspaceId(loadedWorkspace.id);
      setLocalDirState({
        isConnected: true,
        dirName: dirPath,
        dirHandle: null,
        autoCompileMo: settings.autoCompileMoOnSave ?? true,
        totalFiles: files.length,
      });

      // Обновляем список недавних папок (поднимаем текущую наверх)
      setRecentFolders((prev) => {
        const filtered = prev.filter((p) => p !== dirPath);
        return [dirPath, ...filtered].slice(0, 10); // Храним только 10 последних
      });

      showToast(`Loaded workspace from: ${dirPath}`, 'success');
      return true;
    } catch (err: any) {
      console.error('Failed to load native directory:', err);
      const errorMessage = err?.message || err;
      showToast(`Error loading directory: ${errorMessage}`, 'warning');
      return false;
    }
  };

  const handleOpenLocalFolder = async () => {
    const dirPath = await pickNativeDirectory();
    if (!dirPath) return;
    await loadFolderNatively(dirPath);
  };

  useEffect(() => {
    const savedRecents = JSON.parse(localStorage.getItem('openpo_recents') || '[]');
    if (savedRecents && savedRecents.length > 0) {
      loadFolderNatively(savedRecents[0]).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const result = await scanFileList(files);
      if (result.workspaces.length === 0) {
        showToast('No .pot or .po gettext files found in selected folder.', 'warning');
        return;
      }

      setWorkspaces(result.workspaces);
      setActiveWorkspaceId(result.workspaces[0].id);
      setLocalDirState({
        isConnected: true,
        dirName: result.dirName,
        dirHandle: null, // Read-only loaded in frame
        autoCompileMo: settings.autoCompileMoOnSave ?? true,
        totalFiles: result.totalFilesFound,
      });

      showToast(
        `Loaded folder "${result.dirName}" with ${result.workspaces.length} domain(s) and ${result.totalFilesFound} file(s)!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to parse selected folder:', err);
      showToast(err.message || 'Failed to read files from folder', 'warning');
    }

    e.target.value = '';
  };

  const handleDisconnectLocalFolder = () => {
    setLocalDirState({
      isConnected: false,
      dirName: '',
      dirHandle: null,
      autoCompileMo: true,
      totalFiles: 0,
    });
    showToast('Local folder disconnected from live disk sync.', 'info');
  };

  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem('openpo_recents');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('openpo_recents', JSON.stringify(recentFolders));
  }, [recentFolders]);

  const handleSyncLocalFolder = async () => {
    if (!localDirState.isConnected) {
      showToast('No local folder is currently connected.', 'warning');
      return;
    }

    // If loaded in iframe without direct filesystem handle, export updated bundle as ZIP
    if (!localDirState.dirHandle) {
      handleExportWorkspaceZip();
      showToast(
        `Exported updated PO and compiled MO bundle for "${localDirState.dirName}". (Open in new tab for direct two-way live disk write)`,
        'success'
      );
      return;
    }

    try {
      const summary = await saveWorkspaceToDirectory(
        localDirState.dirHandle,
        currentWorkspace,
        settings.autoCompileMoOnSave ?? true,
        settings.poNamingScheme || 'domain_lang'
      );

      showToast(
        `Synced ${summary.savedPoCount} .po files and compiled ${summary.savedMoCount} .mo binaries directly to disk at ${summary.timestamp}!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to sync to local directory:', err);
      showToast(`Disk sync failed: ${err.message}`, 'warning');
    }
  };

  // Helper to persist to disk if local directory is active
  const triggerDiskSyncForPo = useCallback(
    async (poRecord: PoFileRecord) => {
      if (!localDirState.isConnected || !localDirState.dirHandle) return;
      try {
        const domain = currentWorkspace.domainName || 'messages';
        const res = await savePoAndMoToDirectory(
          localDirState.dirHandle,
          poRecord,
          settings.autoCompileMoOnSave ?? true,
          domain,
          settings.poNamingScheme || 'domain_lang'
        );
        if (res.moFilename) {
          console.log(`[Disk Sync] Saved ${res.poFilename} and compiled ${res.moFilename}`);
        }
      } catch (err) {
        console.warn('Failed background auto-save to disk:', err);
      }
    },
    [localDirState, currentWorkspace.domainName, settings.autoCompileMoOnSave, settings.poNamingScheme]
  );

  // -------------------------------------------------------------
  // Undo / Redo History Engine
  // -------------------------------------------------------------
  const pushHistorySnapshot = useCallback(
    (ws: Workspace, description = 'Edit') => {
      const snapshot: WorkspaceSnapshot = {
        timestamp: Date.now(),
        description,
        potFile: JSON.parse(JSON.stringify(ws.potFile)),
        poFiles: JSON.parse(JSON.stringify(ws.poFiles)),
        activeFileId: ws.activeFileId,
        activeEntryId: ws.activeEntryId,
      };

      setHistoryMap((prev) => {
        const currentHist = prev[ws.id] || { past: [], future: [] };
        const newPast = [...currentHist.past, snapshot].slice(-50);
        return {
          ...prev,
          [ws.id]: {
            past: newPast,
            future: [],
          },
        };
      });
    },
    []
  );

  const canUndo = (historyMap[activeWorkspaceId]?.past.length || 0) > 0;
  const canRedo = (historyMap[activeWorkspaceId]?.future.length || 0) > 0;

  const handleUndo = useCallback(() => {
    const currentHist = historyMap[activeWorkspaceId];
    if (!currentHist || currentHist.past.length === 0) return;

    const previousSnapshot = currentHist.past[currentHist.past.length - 1];
    const newPast = currentHist.past.slice(0, -1);

    const currentSnapshot: WorkspaceSnapshot = {
      timestamp: Date.now(),
      description: 'State before undo',
      potFile: JSON.parse(JSON.stringify(currentWorkspace.potFile)),
      poFiles: JSON.parse(JSON.stringify(currentWorkspace.poFiles)),
      activeFileId: currentWorkspace.activeFileId,
      activeEntryId: currentWorkspace.activeEntryId,
    };

    setHistoryMap((prev) => ({
      ...prev,
      [activeWorkspaceId]: {
        past: newPast,
        future: [currentSnapshot, ...currentHist.future],
      },
    }));

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        return {
          ...w,
          potFile: JSON.parse(JSON.stringify(previousSnapshot.potFile)),
          poFiles: JSON.parse(JSON.stringify(previousSnapshot.poFiles)),
          activeFileId: previousSnapshot.activeFileId,
          activeEntryId: previousSnapshot.activeEntryId,
          isModified: true,
        };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, historyMap]);

  const handleRedo = useCallback(() => {
    const currentHist = historyMap[activeWorkspaceId];
    if (!currentHist || currentHist.future.length === 0) return;

    const nextSnapshot = currentHist.future[0];
    const newFuture = currentHist.future.slice(1);

    const currentSnapshot: WorkspaceSnapshot = {
      timestamp: Date.now(),
      description: 'State before redo',
      potFile: JSON.parse(JSON.stringify(currentWorkspace.potFile)),
      poFiles: JSON.parse(JSON.stringify(currentWorkspace.poFiles)),
      activeFileId: currentWorkspace.activeFileId,
      activeEntryId: currentWorkspace.activeEntryId,
    };

    setHistoryMap((prev) => ({
      ...prev,
      [activeWorkspaceId]: {
        past: [...currentHist.past, currentSnapshot],
        future: newFuture,
      },
    }));

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        return {
          ...w,
          potFile: JSON.parse(JSON.stringify(nextSnapshot.potFile)),
          poFiles: JSON.parse(JSON.stringify(nextSnapshot.poFiles)),
          activeFileId: nextSnapshot.activeFileId,
          activeEntryId: nextSnapshot.activeEntryId,
          isModified: true,
        };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, historyMap]);

  // Select entry
  const handleSelectEntry = (id: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? { ...w, activeEntryId: id } : w))
    );
  };

  // Select file in workspace
  const handleSelectFile = (fileId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? { ...w, activeFileId: fileId } : w))
    );
  };

  // Update entry in active PO or POT file (Single string / Plural editor)
  const handleUpdateEntry = useCallback(
    (updated: PoEntry) => {
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          if (isPotActive) {
            const updatedEntries = w.potFile.entries.map((e) =>
              e.id === updated.id ? updated : e
            );
            return {
              ...w,
              potFile: { ...w.potFile, entries: updatedEntries, isModified: true },
              isModified: true,
            };
          }

          const updatedPoFiles = w.poFiles.map((po) => {
            if (po.id !== w.activeFileId) return po;
            const updatedEntries = po.entries.map((e) => (e.id === updated.id ? updated : e));
            const updatedPo = { ...po, entries: updatedEntries, isModified: true };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });

          return { ...w, poFiles: updatedPoFiles, isModified: true };
        })
      );
    },
    [activeWorkspaceId, isPotActive, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Sync POT key changes to all subordinate PO files
  const handleSyncPotEntry = useCallback(
    (updatedPotEntry: PoEntry) => {
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          // 1. Update master POT entry
          const updatedPotEntries = w.potFile.entries.map((e) =>
            e.id === updatedPotEntry.id ? updatedPotEntry : e
          );

          // 2. Sync to all subordinate PO files
          const updatedPoFiles = w.poFiles.map((po) => {
            const existingPoEntry = po.entries.find((e) => e.id === updatedPotEntry.id);
            if (!existingPoEntry) return po;

            const syncedEntry: PoEntry = {
              ...existingPoEntry,
              msgid: updatedPotEntry.msgid,
              msgidPlural: updatedPotEntry.msgidPlural,
              msgctxt: updatedPotEntry.msgctxt,
              comments: updatedPotEntry.comments,
              references: updatedPotEntry.references,
            };

            const updatedPo = {
              ...po,
              entries: po.entries.map((e) => (e.id === updatedPotEntry.id ? syncedEntry : e)),
              isModified: true,
            };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });

          return {
            ...w,
            potFile: { ...w.potFile, entries: updatedPotEntries, isModified: true },
            poFiles: updatedPoFiles,
            isModified: true,
          };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Update category of an entry across workspace
  const handleUpdateCategory = useCallback(
    (entryId: string, newCategory: string) => {
      const normalized = normalizeCategoryPath(newCategory);
      if (normalized) {
        handleAddCategory(normalized);
      }
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          const targetEntry =
            w.potFile.entries.find((e) => e.id === entryId) ||
            w.poFiles.flatMap((p) => p.entries).find((e) => e.id === entryId);

          const updatedPotEntries = w.potFile.entries.map((e) => {
            if (e.id === entryId || (targetEntry && e.msgid === targetEntry.msgid && e.msgctxt === targetEntry.msgctxt)) {
              return { ...e, category: normalized || undefined };
            }
            return e;
          });

          const updatedPoFiles = w.poFiles.map((po) => {
            const updatedEntries = po.entries.map((e) => {
              if (e.id === entryId || (targetEntry && e.msgid === targetEntry.msgid && e.msgctxt === targetEntry.msgctxt)) {
                return { ...e, category: normalized || undefined };
              }
              return e;
            });
            const updatedPo = { ...po, entries: updatedEntries, isModified: true };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });

          return {
            ...w,
            potFile: { ...w.potFile, entries: updatedPotEntries, isModified: true },
            poFiles: updatedPoFiles,
            isModified: true,
          };
        })
      );
      showToast(t('category.categoryAssigned'), 'success');
    },
    [activeWorkspaceId, currentWorkspace, handleAddCategory, pushHistorySnapshot, showToast, t, triggerDiskSyncForPo]
  );

  // Add new string key to POT and all PO files
  const handleAddKey = useCallback(
    (newEntry: PoEntry) => {
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          // Add to POT
          const potEntries = [...w.potFile.entries, newEntry];

          // Add empty translation entry to all PO files
          const poFiles = w.poFiles.map((po) => {
            const rule = getPluralRuleForLanguage(po.language, po.header.pluralForms);
            const emptyMsgstr = newEntry.msgidPlural
              ? Array.from({ length: rule.nplurals }, () => '')
              : [''];

            const poEntry: PoEntry = {
              ...newEntry,
              msgstr: emptyMsgstr,
            };

            const updatedPo = {
              ...po,
              entries: [...po.entries, poEntry],
              isModified: true,
            };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });

          return {
            ...w,
            potFile: { ...w.potFile, entries: potEntries, isModified: true },
            poFiles,
            activeEntryId: newEntry.id,
            isModified: true,
          };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Delete key from POT and all PO files
  const handleDeleteKey = useCallback(
    (entryId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          const potEntries = w.potFile.entries.filter((en) => en.id !== entryId);
          const poFiles = w.poFiles.map((po) => {
            const updatedPo = {
              ...po,
              entries: po.entries.filter((en) => en.id !== entryId),
              isModified: true,
            };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });

          const nextActiveId = potEntries[0]?.id || null;

          return {
            ...w,
            potFile: { ...w.potFile, entries: potEntries, isModified: true },
            poFiles,
            activeEntryId: nextActiveId,
            isModified: true,
          };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Add new language to workspace
  const handleAddLanguage = useCallback(
    (langCode: string, langName: string, pluralForms: string) => {
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;

          const domain = w.domainName || w.potFile.domainName || 'messages';
          const scheme = settings.poNamingScheme || 'domain_lang';
          const filename = formatPoFilename(domain, langCode, scheme);

          const poHeader: PoHeader = {
            projectIdVersion: w.potFile.header.projectIdVersion || `${w.name} 1.0`,
            language: langCode,
            pluralForms,
            mimeVersion: '1.0',
            contentType: 'text/plain; charset=UTF-8',
            contentTransferEncoding: '8bit',
            xGenerator: 'PoCraft Gettext Studio',
            rawHeaders: {},
          };

          const rule = getPluralRuleForLanguage(langCode, pluralForms);

          const poEntries: PoEntry[] = w.potFile.entries.map((potEntry) => ({
            ...potEntry,
            msgstr: potEntry.msgidPlural ? Array.from({ length: rule.nplurals }, () => '') : [''],
            flags: [],
          }));

          const newPoRecord: PoFileRecord = {
            id: `po_${langCode}_${Date.now()}`,
            filename,
            language: langCode,
            languageName: langName,
            header: poHeader,
            entries: poEntries,
            isModified: true,
          };

          triggerDiskSyncForPo(newPoRecord);

          return {
            ...w,
            poFiles: [...w.poFiles, newPoRecord],
            activeFileId: newPoRecord.id,
            isModified: true,
          };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, settings.poNamingScheme, triggerDiskSyncForPo]
  );

  // Remove language from workspace
  const handleDeleteLanguage = useCallback(
    (poFileId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;
          const poFiles = w.poFiles.filter((p) => p.id !== poFileId);
          const nextActive = w.activeFileId === poFileId ? 'pot' : w.activeFileId;
          return { ...w, poFiles, activeFileId: nextActive, isModified: true };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot]
  );

  // Toggle Fuzzy
  const handleToggleFuzzy = useCallback(
    (entryId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;
          const poFiles = w.poFiles.map((po) => {
            if (po.id !== w.activeFileId) return po;
            const updatedEntries = po.entries.map((entry) => {
              if (entry.id !== entryId) return entry;
              const hasFuzzy = entry.flags.includes('fuzzy');
              const nextFlags = hasFuzzy
                ? entry.flags.filter((f) => f !== 'fuzzy')
                : [...entry.flags, 'fuzzy'];
              return { ...entry, flags: nextFlags };
            });
            const updatedPo = { ...po, entries: updatedEntries, isModified: true };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });
          return { ...w, poFiles, isModified: true };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Matrix translation updater
  const handleMatrixUpdateTranslation = useCallback(
    (poFileId: string, entryId: string, newMsgstr: string[]) => {
      pushHistorySnapshot(currentWorkspace);

      setWorkspaces((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorkspaceId) return w;
          const poFiles = w.poFiles.map((po) => {
            if (po.id !== poFileId) return po;
            const updatedEntries = po.entries.map((e) =>
              e.id === entryId ? { ...e, msgstr: newMsgstr } : e
            );
            const updatedPo = { ...po, entries: updatedEntries, isModified: true };
            triggerDiskSyncForPo(updatedPo);
            return updatedPo;
          });
          return { ...w, poFiles, isModified: true };
        })
      );
    },
    [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, triggerDiskSyncForPo]
  );

  // Rename domain for modular game modes / components
  const handleRenameDomain = useCallback((newDomain: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const safeDomain = newDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
        const updatedPot = {
          ...w.potFile,
          filename: `${safeDomain}.pot`,
          domainName: safeDomain,
        };
        const updatedPos = w.poFiles.map((po) => ({
          ...po,
          filename: formatPoFilename(safeDomain, po.language, settings.poNamingScheme),
        }));
        return {
          ...w,
          domainName: safeDomain,
          potFile: updatedPot,
          poFiles: updatedPos,
          isModified: true,
        };
      })
    );
  }, [activeWorkspaceId, settings.poNamingScheme]);

  // Navigate next / prev entry
  const handleNextEntry = () => {
    const currentIndex = filteredEntries.findIndex((e) => e.id === activeEntryId);
    if (currentIndex >= 0 && currentIndex < filteredEntries.length - 1) {
      handleSelectEntry(filteredEntries[currentIndex + 1].id);
    }
  };

  const handlePrevEntry = () => {
    const currentIndex = filteredEntries.findIndex((e) => e.id === activeEntryId);
    if (currentIndex > 0) {
      handleSelectEntry(filteredEntries[currentIndex - 1].id);
    }
  };

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+Enter, Ctrl+Up, Ctrl+Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (isCmdOrCtrl && e.key.toLowerCase() === 'y') ||
        (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        handleNextEntry();
      } else if (isCmdOrCtrl && e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextEntry();
      } else if (isCmdOrCtrl && e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevEntry();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredEntries, activeEntryId, handleUndo, handleRedo]);

  // Download individual PO file
  const handleDownloadPo = (po: PoFileRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const content = serializePoFile(po.header, po.entries, false);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = po.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download individual MO binary
  const handleDownloadMo = (po: PoFileRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const binary = compileMoBinary(po.header, po.entries);
    const moFilename = po.filename.replace(/\.po$/, '.mo');
    const blob = new Blob([binary], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = moFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export full workspace as ZIP with modular PO and MO files
  const handleExportWorkspaceZip = async () => {
    const zip = new JSZip();
    const domain = currentWorkspace.domainName || currentWorkspace.potFile.domainName || 'messages';
    const wsFolder = zip.folder(currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_')) || zip;

    // 1. Add .pot master template
    const potContent = serializePoFile(
      currentWorkspace.potFile.header,
      currentWorkspace.potFile.entries,
      true
    );
    const potName = currentWorkspace.potFile.filename || `${domain}.pot`;
    wsFolder.file(potName, potContent);

    // 2. Add all .po files and compiled .mo binaries
    currentWorkspace.poFiles.forEach((po) => {
      const poText = serializePoFile(po.header, po.entries, false);
      const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
      wsFolder.file(poFilename, poText);

      const moBinary = compileMoBinary(po.header, po.entries);
      const moFilename = formatMoFilename(domain, po.language, settings.poNamingScheme);
      wsFolder.file(moFilename, moBinary);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWorkspace.name.replace(/\s+/g, '_')}_i18n_bundle.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import PO / POT files from disk
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      const { header, entries } = parsePoContent(text);
      const filename = file.name;
      const isPot = filename.endsWith('.pot') || !header.language;

      if (isPot) {
        // Create new workspace or replace POT template
        const domainName = filename.replace(/\.pot$/, '');
        const newPot: PotFileRecord = {
          id: `pot_${Date.now()}_${i}`,
          filename,
          domainName,
          header,
          entries,
        };

        const newWs: Workspace = {
          id: `ws_${Date.now()}_${i}`,
          name: domainName,
          domainName,
          potFile: newPot,
          poFiles: [],
          activeFileId: 'pot',
          activeEntryId: entries[0]?.id || null,
          createdAt: new Date().toISOString(),
        };

        newWs.git = initGitRepository(
          newWs,
          `Initial commit for ${filename}`,
          settings.authorName,
          settings.authorEmail
        );

        setWorkspaces((prev) => [...prev, newWs]);
        setActiveWorkspaceId(newWs.id);
      } else {
        // Add as subordinate PO file to current workspace
        const langCode = header.language || filename.replace(/\.po$/, '');
        const newPo: PoFileRecord = {
          id: `po_${langCode}_${Date.now()}`,
          filename,
          language: langCode,
          languageName: langCode.toUpperCase(),
          header,
          entries,
        };

        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === activeWorkspaceId
              ? { ...w, poFiles: [...w.poFiles, newPo], activeFileId: newPo.id, isModified: true }
              : w
          )
        );
      }
    }

    // Reset input
    e.target.value = '';
  };

  // New Workspace
  const handleCreateWorkspace = () => {
    const newPot: PotFileRecord = {
      id: `pot_${Date.now()}`,
      filename: 'messages.pot',
      domainName: 'messages',
      header: {
        projectIdVersion: 'New App 1.0',
        mimeVersion: '1.0',
        contentType: 'text/plain; charset=UTF-8',
        contentTransferEncoding: '8bit',
        xGenerator: 'PoCraft Gettext Studio',
        rawHeaders: {},
      },
      entries: [
        {
          id: generateEntryId(),
          msgid: 'APP_WELCOME',
          msgstr: [''],
          comments: ['Welcome greeting'],
          extractedComments: [],
          references: ['src/App.tsx:10'],
          flags: [],
        },
      ],
    };

    const newWs: Workspace = {
      id: `ws_${Date.now()}`,
      name: 'Untitled Project',
      domainName: 'messages',
      potFile: newPot,
      poFiles: [],
      activeFileId: 'pot',
      activeEntryId: newPot.entries[0].id,
      createdAt: new Date().toISOString(),
    };

    newWs.git = initGitRepository(
      newWs,
      'Initial localization project workspace',
      settings.authorName,
      settings.authorEmail
    );

    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  // Close workspace tab
  const handleCloseWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return;

    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(remaining[0].id);
    }
  };

  // Batch operations with configurable similarity threshold
  const handleBatchApplyTm = (poFileId: string, minSimilarity = 0.8) => {
    pushHistorySnapshot(currentWorkspace);
    let appliedCount = 0;

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const poFiles = w.poFiles.map((po) => {
          if (po.id !== poFileId) return po;
          const updatedEntries = po.entries.map((entry) => {
            const isFilled = entry.msgstr.length > 0 && entry.msgstr.some((s) => s && s.trim());
            if (isFilled) return entry;

            const matches = globalTranslationMemory.query(entry.msgid, po.language, minSimilarity);
            if (matches.length > 0) {
              appliedCount++;
              const match = matches[0];
              let flags = [...entry.flags];
              if (match.similarity < 100 && settings.autoMarkFuzzyUnder100) {
                if (!flags.includes('fuzzy')) flags.push('fuzzy');
              } else if (match.similarity === 100) {
                flags = flags.filter((f) => f !== 'fuzzy');
              }

              return {
                ...entry,
                msgstr: [match.suggestedMsgstr],
                flags,
              };
            }
            return entry;
          });
          const updatedPo = { ...po, entries: updatedEntries, isModified: true };
          triggerDiskSyncForPo(updatedPo);
          return updatedPo;
        });
        return { ...w, poFiles, isModified: true };
      })
    );
    return appliedCount;
  };

  const handleClearAllFuzzy = (poFileId: string) => {
    pushHistorySnapshot(currentWorkspace);

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const poFiles = w.poFiles.map((po) => {
          if (po.id !== poFileId) return po;
          const updatedEntries = po.entries.map((e) => ({
            ...e,
            flags: e.flags.filter((f) => f !== 'fuzzy'),
          }));
          const updatedPo = { ...po, entries: updatedEntries, isModified: true };
          triggerDiskSyncForPo(updatedPo);
          return updatedPo;
        });
        return { ...w, poFiles, isModified: true };
      })
    );
  };

  const handleMarkUntranslatedFuzzy = (poFileId: string) => {
    pushHistorySnapshot(currentWorkspace);

    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const poFiles = w.poFiles.map((po) => {
          if (po.id !== poFileId) return po;
          const updatedEntries = po.entries.map((e) => {
            const isFilled = e.msgstr.length > 0 && e.msgstr.some((s) => s && s.trim());
            if (isFilled && !e.flags.includes('fuzzy')) {
              return { ...e, flags: [...e.flags, 'fuzzy'] };
            }
            return e;
          });
          const updatedPo = { ...po, entries: updatedEntries, isModified: true };
          triggerDiskSyncForPo(updatedPo);
          return updatedPo;
        });
        return { ...w, poFiles, isModified: true };
      })
    );
  };

  // -------------------------------------------------------------
  // Git Actions Handlers
  // -------------------------------------------------------------
  const handleInitGit = () => {
    const git = initGitRepository(
      currentWorkspace,
      'Initial localization catalogue commit',
      settings.authorName,
      settings.authorEmail
    );
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? { ...w, git } : w))
    );
  };

  const handleStageFile = (filename: string) => {
    const updated = stageGitFile(currentWorkspace, filename);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleUnstageFile = (filename: string) => {
    const updated = unstageGitFile(currentWorkspace, filename);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleStageAll = () => {
    const updated = stageAllGitFiles(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleUnstageAll = () => {
    const updated = unstageAllGitFiles(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleCommit = (message: string) => {
    const updated = commitStagedChanges(
      currentWorkspace,
      message,
      settings.authorName,
      settings.authorEmail
    );
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleRevertFile = (filename: string) => {
    pushHistorySnapshot(currentWorkspace);
    const updated = revertFileToHead(currentWorkspace, filename);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  const handleRestoreCommit = (commitId: string) => {
    pushHistorySnapshot(currentWorkspace);
    const updated = restoreCommitSnapshot(currentWorkspace, commitId);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === activeWorkspaceId ? updated : w))
    );
  };

  return (
    <div 
      className="flex flex-col bg-[#090B0E] text-[#E2E8F0] font-sans antialiased overflow-hidden origin-top-left"
      style={{
        transform: `scale(${zoomLevel / 100})`,
        width: `${10000 / zoomLevel}vw`,
        height: `${10000 / zoomLevel}vh`,
      }}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-12 right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-[#10B9811A] border-[#10B981] text-[#4ADE80] backdrop-blur-md'
              : toastMessage.type === 'warning'
              ? 'bg-[#F59E0B1A] border-[#F59E0B] text-[#F59E0B] backdrop-blur-md'
              : 'bg-[#3B82F61A] border-[#3B82F6] text-[#38BDF8] backdrop-blur-md'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Desktop Window Top Header */}
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

      {/* 2. VS Code Style Workspaces Tab Bar */}
      <WorkspaceTabs
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={setActiveWorkspaceId}
        onCloseWorkspace={handleCloseWorkspace}
        onNewWorkspace={handleCreateWorkspace}
      />

      {/* 3. Subordinate Languages Selection Bar */}
      <LanguageSelectorBar
        workspace={currentWorkspace}
        activeFileId={activeFileId}
        onSelectFile={handleSelectFile}
        onAddLanguage={() => setIsAddLanguageModalOpen(true)}
        onDownloadPo={handleDownloadPo}
        onDownloadMo={handleDownloadMo}
        onDeleteLanguage={handleDeleteLanguage}
      />

      {/* 4. Main Workspace Canvas */}
      {viewMode === 'matrix' ? (
        <MultiLanguageGridView
          workspace={currentWorkspace}
          onUpdateTranslation={handleMatrixUpdateTranslation}
          showNewlinesVisible={settings.showNewlinesVisible}
        />
      ) : (
        <main className="flex-1 flex overflow-hidden relative">
          {/* Left Column: Categorized Groups & Filters (Resizable) */}
          <div
            style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
            className="h-full shrink-0 flex overflow-hidden"
          >
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
              onAssignActiveEntryToCategory={(catPath) => {
                if (activeEntryId) {
                  handleUpdateCategory(activeEntryId, catPath);
                }
              }}
              activeEntryId={activeEntryId}
            />
          </div>

          {/* Resizer 1: Sidebar <-> String Table */}
          <div
            onMouseDown={() => setIsDraggingSidebar(true)}
            onDoubleClick={() => setSidebarWidth(270)}
            className={`w-1.5 hover:w-2 bg-[#2D3139] hover:bg-[#3B82F6] cursor-col-resize transition-all z-20 flex items-center justify-center shrink-0 select-none group relative ${
              isDraggingSidebar ? 'bg-[#3B82F6] !w-2 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : ''
            }`}
            title="Drag to resize filters & categories sidebar (double-click to reset)"
          >
            <div className="w-0.5 h-6 bg-[#64748B] group-hover:bg-white rounded-full transition-colors opacity-60 group-hover:opacity-100" />
          </div>

          {/* Middle Column: Strings List Table */}
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

          {/* Resizer 2: String Table <-> Translation Editor */}
          <div
            onMouseDown={() => setIsDraggingEditor(true)}
            onDoubleClick={() => setEditorWidth(540)}
            className={`w-1.5 hover:w-2 bg-[#2D3139] hover:bg-[#3B82F6] cursor-col-resize transition-all z-20 flex items-center justify-center shrink-0 select-none group relative ${
              isDraggingEditor ? 'bg-[#3B82F6] !w-2 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : ''
            }`}
            title="Drag to resize translation editor (double-click to reset)"
          >
            <div className="w-0.5 h-6 bg-[#64748B] group-hover:bg-white rounded-full transition-colors opacity-60 group-hover:opacity-100" />
          </div>

          {/* Right Column: Active Translation & Plural Editor Pane (Resizable) */}
          <div
            style={{ width: `${editorWidth}px`, minWidth: `${editorWidth}px` }}
            className="h-full shrink-0 flex overflow-hidden"
          >
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
            />
          </div>
        </main>
      )}

      {/* 5. Sleek Technical Status Footer */}
      <footer className="h-6 bg-[#16191E] border-t border-[#2D3139] flex items-center px-4 justify-between text-[10px] text-[#64748B] select-none font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span>⌨ UTF-8</span>
          <span>☰ {isPotActive ? currentWorkspace.potFile.filename : currentPoFile?.filename || 'workspace'}</span>
          <span>{currentEntry ? `Active Key: ${currentEntry.msgid.slice(0, 20)}...` : 'Ready'}</span>
          {localDirState.isConnected && (
            <span className="text-[#4ADE80] font-semibold">
              📁 Live Disk: {localDirState.dirName} (Auto .MO: {settings.autoCompileMoOnSave ? 'ON' : 'OFF'})
            </span>
          )}
          <span className="text-[#38BDF8]">
            Git: {currentWorkspace.git?.branch || 'main'} ({currentWorkspace.git?.commits.length || 0} commits)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span>Scheme: {settings.poNamingScheme || 'domain_lang'}</span>
          <span>•</span>
          <span>TM Threshold: {settings.fuzzyMatchingThreshold}%</span>
          <span>•</span>
          <span>
            {stats.total} strings | {stats.untranslated} untranslated | {stats.fuzzy} fuzzy
          </span>
          <span className="text-[#3B82F6] font-bold">POCRAFT v2.5</span>
        </div>
      </footer>

      {/* Modals */}
      <NewKeyModal
        isOpen={isNewKeyModalOpen}
        onClose={() => setIsNewKeyModalOpen(false)}
        onAddKey={(newKeyData) => {
          handleAddKey(newKeyData);
          if (newKeyData.category) {
            handleAddCategory(newKeyData.category);
          }
        }}
        availableCategories={categoryData.allGroups.map((g) => g.name)}
        defaultCategory={selectedCategory || ''}
      />

      <AddLanguageModal
        isOpen={isAddLanguageModalOpen}
        onClose={() => setIsAddLanguageModalOpen(false)}
        onAddLanguage={handleAddLanguage}
        existingLanguages={currentWorkspace.poFiles.map((p) => p.language)}
      />

      <RawPoModal
        isOpen={isRawPoModalOpen}
        onClose={() => setIsRawPoModalOpen(false)}
        filename={isPotActive ? currentWorkspace.potFile.filename : currentPoFile?.filename || 'messages.po'}
        header={isPotActive ? currentWorkspace.potFile.header : currentPoFile?.header || currentWorkspace.potFile.header}
        entries={isPotActive ? currentWorkspace.potFile.entries : currentPoFile?.entries || []}
        isPot={isPotActive}
        onSaveRaw={(newHeader, newEntries) => {
          pushHistorySnapshot(currentWorkspace);
          if (isPotActive) {
            setWorkspaces((prev) =>
              prev.map((w) =>
                w.id === activeWorkspaceId
                  ? {
                      ...w,
                      potFile: { ...w.potFile, header: newHeader, entries: newEntries, isModified: true },
                      isModified: true,
                    }
                  : w
              )
            );
          } else if (currentPoFile) {
            setWorkspaces((prev) =>
              prev.map((w) => {
                if (w.id !== activeWorkspaceId) return w;
                const updatedPoFiles = w.poFiles.map((p) =>
                  p.id === currentPoFile.id ? { ...p, header: newHeader, entries: newEntries, isModified: true } : p
                );
                return { ...w, poFiles: updatedPoFiles, isModified: true };
              })
            );
          }
        }}
      />

      <MoCompilerModal
        isOpen={isMoCompilerModalOpen}
        onClose={() => setIsMoCompilerModalOpen(false)}
        workspace={currentWorkspace}
      />

      <BatchOperationsModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        workspace={currentWorkspace}
        onBatchApplyTm={handleBatchApplyTm}
        onClearAllFuzzy={handleClearAllFuzzy}
        onMarkUntranslatedFuzzy={handleMarkUntranslatedFuzzy}
        fuzzyThreshold={settings.fuzzyMatchingThreshold}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        domainName={currentWorkspace.domainName || currentWorkspace.potFile.domainName || 'messages'}
        onRenameDomain={handleRenameDomain}
      />

      <GitModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        folderPath={localDirState.isConnected ? localDirState.dirName : null}
        authorName={settings.authorName}
        authorEmail={settings.authorEmail}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        onOpenSettings={() => {
          setIsAboutModalOpen(false);
          setIsSettingsModalOpen(true);
        }}
      />

      {/* Hidden Universal Folder Input (works in sandboxed iframes & all browsers) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={handleFolderInputChange}
        className="hidden"
      />
    </div>
  );
}
