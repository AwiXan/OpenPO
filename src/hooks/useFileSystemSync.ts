import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { Workspace, PoFileRecord, PotFileRecord, LocalDirectoryState, AppSettings } from '../types/gettext';
import { scanFileList, savePoAndMoToDirectory, saveWorkspaceToDirectory, formatPoFilename, formatMoFilename } from '../lib/localDirectoryManager';
import { parsePoContent, serializePoFile } from '../lib/poParser';
import { compileMoBinary } from '../lib/moCompiler';
import { pickNativeDirectory, scanNativeDirectoryFiles, writeNativeTextFile, writeNativeBinaryFile } from '../lib/nativeFS';
import { initGitRepository } from '../lib/gitEngine';

export function useFileSystemSync(
  activeWorkspaceId: string,
  currentWorkspace: Workspace | undefined,
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>,
  setActiveWorkspaceId: (id: string) => void,
  settings: AppSettings,
  showToast: (msg: string, type: 'info' | 'success' | 'warning') => void,
  t: (key: string) => string
) {
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem('openpot_recents');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('openpot_recents', JSON.stringify(recentFolders));
  }, [recentFolders]);

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('mozdirectory', '');
    }
  }, []);

  // 1. DYNAMIC FOLDER STATE: Derived strictly from the currently active workspace
  const localDirState = useMemo<LocalDirectoryState>(() => {
    if (!currentWorkspace) {
      return { isConnected: false, dirName: '', dirHandle: null, autoCompileMo: true, totalFiles: 0 };
    }
    return {
      isConnected: !!currentWorkspace.localDirPath || !!currentWorkspace.localDirHandle,
      dirName: currentWorkspace.localDirPath || (currentWorkspace.localDirHandle ? currentWorkspace.localDirHandle.name : ''),
      dirHandle: currentWorkspace.localDirHandle || null,
      autoCompileMo: settings.autoCompileMoOnSave ?? true,
      totalFiles: 1 + currentWorkspace.poFiles.length,
    };
  }, [currentWorkspace, settings.autoCompileMoOnSave]);

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
        // BOUND FOLDER STRICTLY TO THIS WORKSPACE:
        localDirPath: dirPath,
      };

      // APPEND to existing workspaces instead of overwriting them!
      setWorkspaces((prev) => [...prev, loadedWorkspace]);
      setActiveWorkspaceId(loadedWorkspace.id);

      setRecentFolders((prev) => {
        const filtered = prev.filter((p) => p !== dirPath);
        return [dirPath, ...filtered].slice(0, 10);
      });

      const message = t('toast.loaded').replace('${dirPath}', dirPath);
      showToast(message, 'success');

      return true;
    } catch (err: any) {
      console.error('Failed to load native directory:', err);
      showToast(`Error loading directory: ${err?.message || err}`, 'warning');
      return false;
    }
  };

  const handleOpenLocalFolder = async () => {
    const dirPath = await pickNativeDirectory();
    if (!dirPath) return;
    await loadFolderNatively(dirPath);
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const result = await scanFileList(files);
      if (result.workspaces.length === 0) {
        showToast('No .pot or .po gettext files found in selected folder.', 'warning');
        return;
      }

      // Bind web folder handle to all loaded workspaces
      const newWorkspaces = result.workspaces.map(w => ({
        ...w,
        localDirPath: result.dirName,
        localDirHandle: result.dirHandle
      }));

      // Append them!
      setWorkspaces((prev) => [...prev, ...newWorkspaces]);
      setActiveWorkspaceId(newWorkspaces[0].id);

      showToast(`Loaded folder "${result.dirName}" with ${newWorkspaces.length} domain(s) and ${result.totalFilesFound} file(s)!`, 'success');
    } catch (err: any) {
      console.error('Failed to parse selected folder:', err);
      showToast(err.message || 'Failed to read files from folder', 'warning');
    }

    e.target.value = '';
  };

  // 2. DISCONNECT ONLY FROM THE CURRENT WORKSPACE
  const handleDisconnectLocalFolder = () => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeWorkspaceId
          ? { ...w, localDirPath: undefined, localDirHandle: undefined }
          : w
      )
    );
    showToast('Local folder disconnected from this workspace.', 'info');
  };

  const handleExportWorkspaceZip = async () => {
    if (!currentWorkspace) return;
    
    const zip = new JSZip();
    const domain = currentWorkspace.domainName || currentWorkspace.potFile.domainName || 'messages';
    const wsFolder = zip.folder(currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_')) || zip;

    const potContent = serializePoFile(currentWorkspace.potFile.header, currentWorkspace.potFile.entries, true);
    const potName = currentWorkspace.potFile.filename || `${domain}.pot`;
    wsFolder.file(potName, potContent);

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

  // 3. TARGETED DISK SYNC
  const handleSyncLocalFolder = async () => {
    if (!currentWorkspace) return;

    const dirPath = currentWorkspace.localDirPath;
    const dirHandle = currentWorkspace.localDirHandle;

    if (!dirPath && !dirHandle) {
      showToast('No local folder is connected to this workspace.', 'warning');
      return;
    }

    if (dirPath) {
      try {
        const domain = currentWorkspace.domainName || 'messages';
        let savedPo = 0;
        let savedMo = 0;
        const cleanDir = dirPath.replace(/\\/g, '/');

        for (const po of currentWorkspace.poFiles) {
          const poFilename = po.filename || formatPoFilename(domain, po.language, settings.poNamingScheme);
          const poContent = serializePoFile(po.header, po.entries, false);
          const fullPoPath = `${cleanDir}/${poFilename}`;

          await writeNativeTextFile(fullPoPath, poContent);
          savedPo++;

          if (settings.autoCompileMoOnSave ?? true) {
            const moFilename = poFilename.endsWith('.po')
              ? poFilename.slice(0, -3) + '.mo'
              : formatMoFilename(domain, po.language, settings.poNamingScheme);

            const moBinary = compileMoBinary(po.header, po.entries);
            const fullMoPath = `${cleanDir}/${moFilename}`;
            await writeNativeBinaryFile(fullMoPath, moBinary);
            savedMo++;
          }
        }

        setWorkspaces((prev) =>
          prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
        );

        const message = t('toast.synced').replace('${savedPo}', savedPo.toString()).replace('${savedMo}', savedMo.toString());
        showToast(message, 'success');
      } catch (err: any) {
        console.error('Failed to sync native folder:', err);
        showToast(`Native disk sync failed: ${err.message}`, 'warning');
      }
      return;
    }

    if (dirHandle) {
      try {
        const summary = await saveWorkspaceToDirectory(
          dirHandle,
          currentWorkspace,
          settings.autoCompileMoOnSave ?? true,
          settings.poNamingScheme || 'domain_lang'
        );

        setWorkspaces((prev) =>
          prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
        );

        showToast(`Synced ${summary.savedPoCount} .po files and compiled ${summary.savedMoCount} .mo binaries directly to disk at ${summary.timestamp}!`, 'success');
      } catch (err: any) {
        console.error('Failed to sync to local directory:', err);
        showToast(`Disk sync failed: ${err.message}`, 'warning');
      }
    }
  };

  const triggerDiskSyncForPo = useCallback(
    async (poRecord: PoFileRecord) => {
      if (!currentWorkspace) return;

      const dirPath = currentWorkspace.localDirPath;
      const dirHandle = currentWorkspace.localDirHandle;

      if (dirPath) {
        try {
          const domain = currentWorkspace.domainName || 'messages';
          const poFilename = poRecord.filename || formatPoFilename(domain, poRecord.language, settings.poNamingScheme);
          const poContent = serializePoFile(poRecord.header, poRecord.entries, false);
          const cleanDir = dirPath.replace(/\\/g, '/');
          const fullPoPath = `${cleanDir}/${poFilename}`;
          
          await writeNativeTextFile(fullPoPath, poContent);

          if (settings.autoCompileMoOnSave ?? true) {
            const moFilename = poFilename.endsWith('.po')
              ? poFilename.slice(0, -3) + '.mo'
              : formatMoFilename(domain, poRecord.language, settings.poNamingScheme);
            const moBinary = compileMoBinary(poRecord.header, poRecord.entries);
            const fullMoPath = `${cleanDir}/${moFilename}`;
            await writeNativeBinaryFile(fullMoPath, moBinary);
          }

          setWorkspaces((prev) =>
            prev.map((w) => (w.id === activeWorkspaceId ? { ...w, isModified: false } : w))
          );
        } catch (err) {
          console.error('NATIVE DISK SYNC ERROR:', err);
        }
        return;
      }

      if (dirHandle) {
        try {
          const domain = currentWorkspace.domainName || 'messages';
          await savePoAndMoToDirectory(
            dirHandle,
            poRecord,
            settings.autoCompileMoOnSave ?? true,
            domain,
            settings.poNamingScheme || 'domain_lang'
          );
        } catch (err) {
          console.error('FULL DISK SYNC ERROR:', err);
        }
      }
    },
    [currentWorkspace, settings.autoCompileMoOnSave, settings.poNamingScheme, activeWorkspaceId, setWorkspaces]
  );

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

        newWs.git = initGitRepository(newWs, `Initial commit for ${filename}`, settings.authorName, settings.authorEmail);

        setWorkspaces((prev) => [...prev, newWs]);
        setActiveWorkspaceId(newWs.id);
      } else {
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
    e.target.value = '';
  };

  return {
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
  };
}