import { useState, useCallback } from 'react';
import { Workspace, PoEntry, PoFileRecord, PoHeader, WorkspaceSnapshot, AppSettings, PotFileRecord } from '../types/gettext';
import { normalizeCategoryPath } from '../lib/categorizer';
import { formatPoFilename } from '../lib/localDirectoryManager';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';
import { globalTranslationMemory } from '../lib/translationMemory';
import { generateEntryId } from '../lib/poParser';
import { stageGitFile, unstageGitFile, stageAllGitFiles, unstageAllGitFiles, commitStagedChanges, revertFileToHead, restoreCommitSnapshot, initGitRepository } from '../lib/gitEngine';
import { confirm } from '@tauri-apps/plugin-dialog';

export function useWorkspaceActions(
  activeWorkspaceId: string,
  currentWorkspace: Workspace | undefined,
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>,
  setActiveWorkspaceId: (id: string) => void,
  settings: AppSettings,
  triggerDiskSyncForPo: (po: PoFileRecord) => Promise<void>,
  showToast: (msg: string, type: 'info' | 'success' | 'warning') => void,
  t: (key: string) => string
) {
  const [historyMap, setHistoryMap] = useState<Record<string, { past: WorkspaceSnapshot[]; future: WorkspaceSnapshot[] }>>({});

  const pushHistorySnapshot = useCallback((ws: Workspace, description = 'Edit') => {
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
        [ws.id]: { past: newPast, future: [] },
      };
    });
  }, []);

  const canUndo = (historyMap[activeWorkspaceId]?.past.length || 0) > 0;
  const canRedo = (historyMap[activeWorkspaceId]?.future.length || 0) > 0;

  const handleUndo = useCallback(() => {
    if (!currentWorkspace) return;
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
      [activeWorkspaceId]: { past: newPast, future: [currentSnapshot, ...currentHist.future] },
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
  }, [activeWorkspaceId, currentWorkspace, historyMap, setWorkspaces]);

  const handleRedo = useCallback(() => {
    if (!currentWorkspace) return;
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
      [activeWorkspaceId]: { past: [...currentHist.past, currentSnapshot], future: newFuture },
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
  }, [activeWorkspaceId, currentWorkspace, historyMap, setWorkspaces]);

  const handleAddCategory = useCallback((categoryPath: string) => {
    if (!categoryPath || !categoryPath.trim()) return;
    const normalized = normalizeCategoryPath(categoryPath);
    if (!normalized) return;
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const existing = w.customCategories || [];
        if (existing.includes(normalized)) return w;
        return { ...w, customCategories: [...existing, normalized], isModified: true };
      })
    );
    showToast(`${t('category.category')}: ${normalized}`, 'success');
  }, [activeWorkspaceId, showToast, t, setWorkspaces]);

  const handleSelectEntry = (id: string) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? { ...w, activeEntryId: id } : w)));
  };

  const handleSelectFile = (fileId: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        let nextEntryId = w.activeEntryId;
        const currentFile = w.activeFileId === 'pot' ? w.potFile : w.poFiles.find((p) => p.id === w.activeFileId);
        const nextFile = fileId === 'pot' ? w.potFile : w.poFiles.find((p) => p.id === fileId);

        if (currentFile && nextFile && w.activeEntryId) {
          const currentEntry = currentFile.entries.find((e) => e.id === w.activeEntryId);
          if (currentEntry) {
            const equivalentEntry = nextFile.entries.find((e) => e.msgid === currentEntry.msgid && (e.msgctxt || '') === (currentEntry.msgctxt || ''));
            if (equivalentEntry) nextEntryId = equivalentEntry.id;
          }
        }
        return { ...w, activeFileId: fileId, activeEntryId: nextEntryId };
      })
    );
  };

  const handleUpdateEntry = useCallback((updated: PoEntry) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        if (w.activeFileId === 'pot') {
          const updatedEntries = w.potFile.entries.map((e) => (e.id === updated.id ? updated : e));
          return { ...w, potFile: { ...w.potFile, entries: updatedEntries, isModified: true }, isModified: true };
        }
        const updatedPoFiles = w.poFiles.map((po) => {
          if (po.id !== w.activeFileId) return po;
          const updatedEntries = po.entries.map((e) => (
            e.id === updated.id || (e.msgid === updated.msgid && (e.msgctxt || '') === (updated.msgctxt || ''))
              ? { ...e, ...updated }
              : e
          ));
          return { ...po, entries: updatedEntries, isModified: true };
        });
        return { ...w, poFiles: updatedPoFiles, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleSyncPotEntry = useCallback((updatedPotEntry: PoEntry) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const updatedPotEntries = w.potFile.entries.map((e) => (e.id === updatedPotEntry.id ? updatedPotEntry : e));
        const updatedPoFiles = w.poFiles.map((po) => {
          const existingPoEntry = po.entries.find((e) => e.id === updatedPotEntry.id)
            || po.entries.find((e) => e.msgid === updatedPotEntry.msgid && (e.msgctxt || '') === (updatedPotEntry.msgctxt || ''));
          if (!existingPoEntry) return po;
          const rule = getPluralRuleForLanguage(po.language, po.header.pluralForms);
          const requiredForms = updatedPotEntry.msgidPlural ? rule.nplurals : 1;
          const msgstr = Array.from({ length: requiredForms }, (_, index) => existingPoEntry.msgstr[index] || '');
          const syncedEntry: PoEntry = { ...existingPoEntry, msgid: updatedPotEntry.msgid, msgidPlural: updatedPotEntry.msgidPlural, msgctxt: updatedPotEntry.msgctxt, comments: updatedPotEntry.comments, references: updatedPotEntry.references, msgstr };
          return { ...po, entries: po.entries.map((e) => (e.id === updatedPotEntry.id ? syncedEntry : e)), isModified: true };
        });
        return { ...w, potFile: { ...w.potFile, entries: updatedPotEntries, isModified: true }, poFiles: updatedPoFiles, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleUpdateCategory = useCallback((entryId: string, newCategory: string) => {
    if (!currentWorkspace) return;
    const normalized = normalizeCategoryPath(newCategory);
    if (normalized) handleAddCategory(normalized);
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const targetEntry = w.potFile.entries.find((e) => e.id === entryId) || w.poFiles.flatMap((p) => p.entries).find((e) => e.id === entryId);
        const updatedPotEntries = w.potFile.entries.map((e) => {
          if (e.id === entryId || (targetEntry && e.msgid === targetEntry.msgid && e.msgctxt === targetEntry.msgctxt)) return { ...e, category: normalized || undefined };
          return e;
        });
        const updatedPoFiles = w.poFiles.map((po) => {
          const updatedEntries = po.entries.map((e) => {
            if (e.id === entryId || (targetEntry && e.msgid === targetEntry.msgid && e.msgctxt === targetEntry.msgctxt)) return { ...e, category: normalized || undefined };
            return e;
          });
          return { ...po, entries: updatedEntries, isModified: true };
        });
        return { ...w, potFile: { ...w.potFile, entries: updatedPotEntries, isModified: true }, poFiles: updatedPoFiles, isModified: true };
      })
    );
    showToast(t('category.categoryAssigned'), 'success');
  }, [activeWorkspaceId, currentWorkspace, handleAddCategory, pushHistorySnapshot, showToast, t, setWorkspaces]);

  const handleAddKey = useCallback((newEntry: PoEntry) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const potEntries = [...w.potFile.entries, newEntry];
        const poFiles = w.poFiles.map((po) => {
          const rule = getPluralRuleForLanguage(po.language, po.header.pluralForms);
          const emptyMsgstr = newEntry.msgidPlural ? Array.from({ length: rule.nplurals }, () => '') : [''];
          const poEntry: PoEntry = { ...newEntry, msgstr: emptyMsgstr };
          return { ...po, entries: [...po.entries, poEntry], isModified: true };
        });
        return { ...w, potFile: { ...w.potFile, entries: potEntries, isModified: true }, poFiles, activeEntryId: newEntry.id, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleDeleteKey = useCallback((entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const potEntries = w.potFile.entries.filter((en) => en.id !== entryId);
        const poFiles = w.poFiles.map((po) => ({ ...po, entries: po.entries.filter((en) => en.id !== entryId), isModified: true }));
        return { ...w, potFile: { ...w.potFile, entries: potEntries, isModified: true }, poFiles, activeEntryId: potEntries[0]?.id || null, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleAddLanguage = useCallback((langCode: string, langName: string, pluralForms: string) => {
    if (!currentWorkspace) return;
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
          pluralForms: pluralForms || getPluralRuleForLanguage(langCode).formula, 
          mimeVersion: '1.0', 
          contentType: 'text/plain; charset=UTF-8', 
          contentTransferEncoding: '8bit', 
          xGenerator: 'PoCraft Gettext Studio', 
          rawHeaders: {} 
        };
        const poHeader: PoHeader = { projectIdVersion: w.potFile.header.projectIdVersion || `${w.name} 1.0`, language: langCode, pluralForms, mimeVersion: '1.0', contentType: 'text/plain; charset=UTF-8', contentTransferEncoding: '8bit', xGenerator: 'PoCraft Gettext Studio', rawHeaders: {} };
        const rule = getPluralRuleForLanguage(langCode, pluralForms);
        const poEntries: PoEntry[] = w.potFile.entries.map((potEntry) => ({ ...potEntry, msgstr: potEntry.msgidPlural ? Array.from({ length: rule.nplurals }, () => '') : [''], flags: [] }));
        const newPoRecord: PoFileRecord = { id: `po_${langCode}_${Date.now()}`, filename, language: langCode, languageName: langName, header: poHeader, entries: poEntries, isModified: true };

        let nextEntryId = w.activeEntryId;
        const currentFile = w.activeFileId === 'pot' ? w.potFile : w.poFiles.find((p) => p.id === w.activeFileId);
        if (currentFile && w.activeEntryId) {
          const currentEntry = currentFile.entries.find((e) => e.id === w.activeEntryId);
          if (currentEntry) {
            const equivalentEntry = poEntries.find((e) => e.msgid === currentEntry.msgid && (e.msgctxt || '') === (currentEntry.msgctxt || ''));
            if (equivalentEntry) nextEntryId = equivalentEntry.id;
          }
        }
        return { ...w, poFiles: [...w.poFiles, newPoRecord], activeFileId: newPoRecord.id, activeEntryId: nextEntryId, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, settings.poNamingScheme, setWorkspaces]);

  const handleDeleteLanguage = useCallback(async (poFileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWorkspace) return;
    const poFile = currentWorkspace.poFiles.find((p) => p.id === poFileId);
    if (!poFile) return;

    const confirmMsg = t('language.confirmDelete').replace('${lang}', poFile.languageName);
    const isConfirmed = await confirm(confirmMsg, { title: 'language.deleting', kind: 'warning' });
    if (!isConfirmed) return;

    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const poFiles = w.poFiles.filter((p) => p.id !== poFileId);
        const nextActive = w.activeFileId === poFileId ? 'pot' : w.activeFileId;
        return { ...w, poFiles, activeFileId: nextActive, isModified: true };
      })
    );
    showToast(t('language.deleted').replace('${lang}', poFile.languageName), 'info');
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, t, showToast, setWorkspaces]);

  const handleToggleFuzzy = useCallback((entryId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const poFiles = w.poFiles.map((po) => {
          if (po.id !== w.activeFileId) return po;
          const updatedEntries = po.entries.map((entry) => {
            if (entry.id !== entryId) return entry;
            const hasFuzzy = entry.flags.includes('fuzzy');
            return { ...entry, flags: hasFuzzy ? entry.flags.filter((f) => f !== 'fuzzy') : [...entry.flags, 'fuzzy'] };
          });
          return { ...po, entries: updatedEntries, isModified: true };
        });
        return { ...w, poFiles, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleMatrixUpdateTranslation = useCallback((poFileId: string, entryId: string, newMsgstr: string[]) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const potEntry = w.potFile.entries.find((e) => e.id === entryId);
        const poFiles = w.poFiles.map((po) => {
          if (po.id !== poFileId) return po;
          const existingIndex = po.entries.findIndex((e) => (potEntry && e.msgid === potEntry.msgid && (e.msgctxt || '') === (potEntry.msgctxt || '')) || e.id === entryId);
          let updatedEntries = [...po.entries];
          if (existingIndex >= 0) {
            updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], msgstr: newMsgstr };
          } else if (potEntry) {
            updatedEntries.push({ ...potEntry, id: `entry_${Date.now()}_${Math.random()}`, msgstr: newMsgstr, flags: [] });
          }
          return { ...po, entries: updatedEntries, isModified: true };
        });
        return { ...w, poFiles, isModified: true };
      })
    );
  }, [activeWorkspaceId, currentWorkspace, pushHistorySnapshot, setWorkspaces]);

  const handleRenameDomain = useCallback((newDomain: string) => {
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const safeDomain = newDomain.replace(/[^a-zA-Z0-9_-]/g, '_');
        const updatedPot = { ...w.potFile, filename: `${safeDomain}.pot`, domainName: safeDomain };
        const updatedPos = w.poFiles.map((po) => ({ ...po, filename: formatPoFilename(safeDomain, po.language, settings.poNamingScheme) }));
        return { ...w, domainName: safeDomain, potFile: updatedPot, poFiles: updatedPos, isModified: true };
      })
    );
  }, [activeWorkspaceId, settings.poNamingScheme, setWorkspaces]);

  const handleCreateWorkspace = () => {
    const newPot: PotFileRecord = {
      id: `pot_${Date.now()}`, filename: 'messages.pot', domainName: 'messages',
      header: { projectIdVersion: 'New App 1.0', mimeVersion: '1.0', contentType: 'text/plain; charset=UTF-8', contentTransferEncoding: '8bit', xGenerator: 'PoCraft Gettext Studio', rawHeaders: {} },
      entries: [{ id: generateEntryId(), msgid: 'APP_WELCOME', msgstr: [''], comments: ['Welcome greeting'], extractedComments: [], references: ['src/App.tsx:10'], flags: [] }],
    };
    const newWs: Workspace = { id: `ws_${Date.now()}`, name: 'Untitled Project', domainName: 'messages', potFile: newPot, poFiles: [], activeFileId: 'pot', activeEntryId: newPot.entries[0].id, createdAt: new Date().toISOString() };
    newWs.git = initGitRepository(newWs, 'Initial localization project workspace', settings.authorName, settings.authorEmail);
    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleCloseWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkspaces((prev) => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter((w) => w.id !== id);
      if (activeWorkspaceId === id) setActiveWorkspaceId(remaining[0].id);
      return remaining;
    });
  };

  const handleBatchApplyTm = (poFileId: string, minSimilarity = 0.8) => {
    if (!currentWorkspace) return 0;
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
              if (match.similarity < 100 && settings.autoMarkFuzzyUnder100 && !flags.includes('fuzzy')) flags.push('fuzzy');
              else if (match.similarity === 100) flags = flags.filter((f) => f !== 'fuzzy');
              return { ...entry, msgstr: [match.suggestedMsgstr], flags };
            }
            return entry;
          });
          return { ...po, entries: updatedEntries, isModified: true };
        });
        return { ...w, poFiles, isModified: true };
      })
    );
    return appliedCount;
  };

  const handleClearAllFuzzy = (poFileId: string) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) => prev.map((w) => {
      if (w.id !== activeWorkspaceId) return w;
      return { ...w, poFiles: w.poFiles.map((po) => po.id === poFileId ? { ...po, entries: po.entries.map((e) => ({ ...e, flags: e.flags.filter((f) => f !== 'fuzzy') })), isModified: true } : po), isModified: true };
    }));
  };

  const handleMarkUntranslatedFuzzy = (poFileId: string) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    setWorkspaces((prev) => prev.map((w) => {
      if (w.id !== activeWorkspaceId) return w;
      return { ...w, poFiles: w.poFiles.map((po) => po.id === poFileId ? { ...po, entries: po.entries.map((e) => { const isFilled = e.msgstr.length > 0 && e.msgstr.some((s) => s && s.trim()); return isFilled && !e.flags.includes('fuzzy') ? { ...e, flags: [...e.flags, 'fuzzy'] } : e; }), isModified: true } : po), isModified: true };
    }));
  };

  const handleInitGit = () => {
    if (!currentWorkspace) return;
    const git = initGitRepository(currentWorkspace, 'Initial localization catalogue commit', settings.authorName, settings.authorEmail);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? { ...w, git } : w)));
  };

  const handleStageFile = (filename: string) => {
    if (!currentWorkspace) return;
    const updated = stageGitFile(currentWorkspace, filename);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleUnstageFile = (filename: string) => {
    if (!currentWorkspace) return;
    const updated = unstageGitFile(currentWorkspace, filename);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleStageAll = () => {
    if (!currentWorkspace) return;
    const updated = stageAllGitFiles(currentWorkspace);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleUnstageAll = () => {
    if (!currentWorkspace) return;
    const updated = unstageAllGitFiles(currentWorkspace);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleCommit = (message: string) => {
    if (!currentWorkspace) return;
    const updated = commitStagedChanges(currentWorkspace, message, settings.authorName, settings.authorEmail);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleRevertFile = (filename: string) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    const updated = revertFileToHead(currentWorkspace, filename);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  const handleRestoreCommit = (commitId: string) => {
    if (!currentWorkspace) return;
    pushHistorySnapshot(currentWorkspace);
    const updated = restoreCommitSnapshot(currentWorkspace, commitId);
    setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspaceId ? updated : w)));
  };

  // Reorder Workspaces via Drag and Drop
  const handleReorderWorkspaces = useCallback((startIndex: number, endIndex: number) => {
    setWorkspaces((prev) => {
      const next = [...prev];
      const [moved] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, moved);
      return next;
    });
  }, [setWorkspaces]);

  return {
    historyMap, pushHistorySnapshot, canUndo, canRedo, handleUndo, handleRedo,
    handleAddCategory, handleSelectEntry, handleSelectFile, handleUpdateEntry, handleSyncPotEntry, handleUpdateCategory,
    handleAddKey, handleDeleteKey, handleAddLanguage, handleDeleteLanguage, handleToggleFuzzy, handleMatrixUpdateTranslation,
    handleRenameDomain, handleCreateWorkspace, handleCloseWorkspace, handleBatchApplyTm, handleClearAllFuzzy, handleMarkUntranslatedFuzzy,
    handleInitGit, handleStageFile, handleUnstageFile, handleStageAll, handleUnstageAll, handleCommit, handleRevertFile, handleRestoreCommit,
    handleReorderWorkspaces
  };
}