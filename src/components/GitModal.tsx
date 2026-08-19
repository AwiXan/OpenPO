import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  Plus,
  Minus,
  CheckCircle2,
  FolderGit2,
  AlertTriangle,
  History,
  FileDiff,
  User,
  Clock,
  Hash,
  ChevronLeft,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';
import {
  checkIsGitInitialized,
  getGitStatus,
  initGitRepo,
  stageFiles,
  unstageFiles,
  commitChanges,
  getCurrentBranch,
  getGitLog,
  getCommitFilesChanged,
  getWorkingTreeDiff,
  getCommitFileDiff,
  parseStatusLine,
  revertFile,
  ParsedGitStatusLine,
  GitLogEntry,
  GitFileChange,
  GitChangeStatus,
} from '../lib/systemGit';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string | null;
  authorName: string;
  authorEmail: string;
  onRevertFile?: (filename: string) => void | Promise<void>;
}

type StatusMeta = { label: string; className: string };

const WORKING_STATUS_META: Record<string, StatusMeta> = {
  A: { label: 'A', className: 'text-[#4ADE80] bg-[#4ADE801A] border-[#4ADE8033]' },
  M: { label: 'M', className: 'text-[#F59E0B] bg-[#F59E0B1A] border-[#F59E0B33]' },
  D: { label: 'D', className: 'text-[#EF4444] bg-[#EF44441A] border-[#EF444433]' },
  R: { label: 'R', className: 'text-[#38BDF8] bg-[#38BDF81A] border-[#38BDF833]' },
  C: { label: 'C', className: 'text-[#38BDF8] bg-[#38BDF81A] border-[#38BDF833]' },
  U: { label: 'U', className: 'text-[#EF4444] bg-[#EF44441A] border-[#EF444433]' },
  UNTRACKED: { label: 'U', className: 'text-[#94A3B8] bg-[#94A3B81A] border-[#94A3B833]' },
  DEFAULT: { label: '?', className: 'text-[#94A3B8] bg-[#94A3B81A] border-[#94A3B833]' },
};

const COMMIT_STATUS_META: Record<GitChangeStatus, StatusMeta> = {
  added: { label: 'A', className: 'text-[#4ADE80] bg-[#4ADE801A] border-[#4ADE8033]' },
  modified: { label: 'M', className: 'text-[#F59E0B] bg-[#F59E0B1A] border-[#F59E0B33]' },
  deleted: { label: 'D', className: 'text-[#EF4444] bg-[#EF44441A] border-[#EF444433]' },
  renamed: { label: 'R', className: 'text-[#38BDF8] bg-[#38BDF81A] border-[#38BDF833]' },
  copied: { label: 'C', className: 'text-[#38BDF8] bg-[#38BDF81A] border-[#38BDF833]' },
  unmerged: { label: 'U', className: 'text-[#EF4444] bg-[#EF44441A] border-[#EF444433]' },
  unknown: { label: '?', className: 'text-[#94A3B8] bg-[#94A3B81A] border-[#94A3B833]' },
};

function getWorkingStatusMeta(entry: ParsedGitStatusLine, staged: boolean): StatusMeta {
  if (entry.isUntracked) return WORKING_STATUS_META.UNTRACKED;
  const code = staged ? entry.indexStatus : entry.worktreeStatus;
  return WORKING_STATUS_META[code] || WORKING_STATUS_META.DEFAULT;
}

const DiffLines: React.FC<{ diffText: string }> = ({ diffText }) => {
  const lines = useMemo(() => diffText.split('\n'), [diffText]);

  return (
    <pre className="bg-[#090B0E] rounded border border-[#2D3139] p-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre">
      {lines.map((line, i) => {
        let cls = 'text-[#94A3B8]';
        if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-[#64748B]';
        else if (line.startsWith('@@')) cls = 'text-[#38BDF8] font-semibold';
        else if (line.startsWith('diff --git') || line.startsWith('index ')) cls = 'text-[#64748B]';
        else if (line.startsWith('+')) cls = 'text-[#4ADE80] bg-[#4ADE800D]';
        else if (line.startsWith('-')) cls = 'text-[#FCA5A5] bg-[#EF44440D]';

        return (
          <div key={i} className={`${cls} px-1 -mx-1`}>
            {line.length > 0 ? line : '\u00A0'}
          </div>
        );
      })}
    </pre>
  );
};

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  authorName,
  authorEmail,
  onRevertFile,
}) => {
  const { t } = useTranslation();

  const [isInitialized, setIsInitialized] = useState(false);
  const [branch, setBranch] = useState('main');
  const [statusEntries, setStatusEntries] = useState<ParsedGitStatusLine[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Status tab
  const [selectedEntry, setSelectedEntry] = useState<{ file: string; staged: boolean } | null>(null);
  const [workingDiff, setWorkingDiff] = useState('');
  const [workingDiffLoading, setWorkingDiffLoading] = useState(false);

  // History tab
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitFiles, setCommitFiles] = useState<GitFileChange[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [selectedCommitFile, setSelectedCommitFile] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState('');
  const [commitDiffLoading, setCommitDiffLoading] = useState(false);

  const refreshGitState = useCallback(async () => {
    if (!folderPath) return;
    setIsLoading(true);
    const initialized = await checkIsGitInitialized(folderPath);
    setIsInitialized(initialized);

    if (initialized) {
      const [rawStatus, currentBranch] = await Promise.all([
        getGitStatus(folderPath),
        getCurrentBranch(folderPath),
      ]);
      setStatusEntries(rawStatus.map(parseStatusLine));
      setBranch(currentBranch);
    }
    setIsLoading(false);
  }, [folderPath]);

  const fetchLog = useCallback(async () => {
    if (!folderPath) return;
    setLogLoading(true);
    const entries = await getGitLog(folderPath);
    setGitLog(entries);
    setLogLoading(false);
  }, [folderPath]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('status');
      refreshGitState();
    }
  }, [isOpen, refreshGitState]);

  useEffect(() => {
    if (activeTab === 'history' && isInitialized && gitLog.length === 0 && !logLoading) {
      fetchLog();
    }
  }, [activeTab, isInitialized, gitLog.length, logLoading, fetchLog]);

  const stagedEntries = useMemo(() => statusEntries.filter((e) => e.staged), [statusEntries]);
  const unstagedEntries = useMemo(() => statusEntries.filter((e) => !e.staged), [statusEntries]);

  useEffect(() => {
    if (activeTab !== 'status') return;
    const stillValid =
      selectedEntry && statusEntries.some((e) => e.file === selectedEntry.file && e.staged === selectedEntry.staged);
    if (stillValid) return;

    const fallback = stagedEntries[0] || unstagedEntries[0] || null;
    setSelectedEntry(fallback ? { file: fallback.file, staged: fallback.staged } : null);
  }, [statusEntries, activeTab, selectedEntry, stagedEntries, unstagedEntries]);

  const selectedEntryKey = selectedEntry ? `${selectedEntry.staged ? 's' : 'u'}:${selectedEntry.file}` : null;

  useEffect(() => {
    if (!folderPath || !selectedEntry) {
      setWorkingDiff('');
      return;
    }
    let cancelled = false;
    setWorkingDiffLoading(true);
    getWorkingTreeDiff(folderPath, selectedEntry.file, selectedEntry.staged).then((diff) => {
      if (!cancelled) {
        setWorkingDiff(diff);
        setWorkingDiffLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedEntryKey, selectedEntry]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    const stillValid = selectedCommitHash && gitLog.some((c) => c.hash === selectedCommitHash);
    if (stillValid) return;
    setSelectedCommitHash(gitLog[0]?.hash || null);
  }, [gitLog, activeTab, selectedCommitHash]);

  useEffect(() => {
    if (!folderPath || !selectedCommitHash) {
      setCommitFiles([]);
      return;
    }
    let cancelled = false;
    setCommitFilesLoading(true);
    setSelectedCommitFile(null);
    getCommitFilesChanged(folderPath, selectedCommitHash).then((files) => {
      if (!cancelled) {
        setCommitFiles(files);
        setCommitFilesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedCommitHash]);

  useEffect(() => {
    if (!folderPath || !selectedCommitHash || !selectedCommitFile) {
      setCommitDiff('');
      return;
    }
    let cancelled = false;
    setCommitDiffLoading(true);
    getCommitFileDiff(folderPath, selectedCommitHash, selectedCommitFile).then((diff) => {
      if (!cancelled) {
        setCommitDiff(diff);
        setCommitDiffLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPath, selectedCommitHash, selectedCommitFile]);

  const handleInit = async () => {
    if (!folderPath) return;
    setIsLoading(true);
    try {
      await initGitRepo(folderPath);
      await refreshGitState();
    } catch (err: any) {
      alert(`Git Init failed: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStage = async (file: string) => {
    if (!folderPath) return;
    await stageFiles(folderPath, [file]);
    await refreshGitState();
  };

  const handleUnstage = async (file: string) => {
    if (!folderPath) return;
    await unstageFiles(folderPath, [file]);
    await refreshGitState();
  };

  const handleStageAll = async () => {
    if (!folderPath || unstagedEntries.length === 0) return;
    await stageFiles(folderPath, unstagedEntries.map((e) => e.file));
    await refreshGitState();
  };

  const handleUnstageAll = async () => {
    if (!folderPath || stagedEntries.length === 0) return;
    await unstageFiles(folderPath, stagedEntries.map((e) => e.file));
    await refreshGitState();
  };

  const handleRevert = async (file: string) => {
    if (!folderPath) return;
    const confirmMsg = (t('git.revertConfirm') || 'Are you sure you want to discard changes in "{file}" to HEAD?\nThis action cannot be undone.')
      .replace('{file}', file);
    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await revertFile(folderPath, file);

      if (onRevertFile) {
        await onRevertFile(file);
      }

      await refreshGitState();
    } catch (err: any) {
      const errMsg = (t('git.revertFailed') || 'Failed to revert file: {error}')
      .replace('{error}', err?.message || String(err));
    alert(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!folderPath || !commitMessage.trim() || stagedEntries.length === 0) return;
    setIsCommitting(true);
    try {
      await commitChanges(folderPath, commitMessage.trim(), authorName, authorEmail);
      setCommitMessage('');
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
      await refreshGitState();
      if (gitLog.length > 0) await fetchLog();
    } catch (err: any) {
      alert(`Commit failed: ${err?.message || err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCommitKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  };

  const modalFooter = folderPath && isInitialized ? (
    <div className="w-full flex flex-col gap-1.5">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleCommitKeyDown}
          placeholder={t('git.commitPlaceholder')}
          className="flex-1 bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white focus:border-[#3B82F6] outline-none"
        />
        <button
          onClick={handleCommit}
          disabled={stagedEntries.length === 0 || !commitMessage.trim() || isCommitting}
          className="px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommitIcon className="w-4 h-4" />}
          {t('git.commitButton')}
        </button>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono px-0.5">
        <span className="truncate max-w-[220px]" title={`${authorName} <${authorEmail}>`}>
          {t('git.author')}: {authorName || 'Translator'}
        </span>
        <span>
          {stagedEntries.length} {t('git.stagedCount')} · Ctrl+Enter
        </span>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('git.title')}
      subtitle={folderPath || t('git.folderNotConnected')}
      icon={<GitBranch className="w-4 h-4" />}
      maxWidth="max-w-6xl"
      footer={modalFooter}
    >
      {!folderPath ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#F59E0B]" />
          <h4 className="text-base font-semibold text-white">{t('git.folderNotConnected')}</h4>
          <p className="text-xs text-[#94A3B8]">{t('git.folderNotConnectedDesc')}</p>
        </div>
      ) : !isInitialized ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <FolderGit2 className="w-10 h-10 text-[#3B82F6]" />
          <h4 className="text-base font-semibold text-white">{t('git.initTitle')}</h4>
          <button
            onClick={handleInit}
            disabled={isLoading}
            className="px-5 py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />}
            {t('git.initRepo')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-[70vh]">
          {/* Toolbar */}
          <div className="px-4 py-2 border-b border-[#2D3139] flex items-center justify-between shrink-0">
            <div className="flex bg-[#090B0E] p-0.5 rounded border border-[#2D3139] text-xs">
              <button
                onClick={() => setActiveTab('status')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'status'
                    ? 'bg-[#2D3748] text-white font-semibold shadow-xs'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>{t('git.changes')}</span>
                {stagedEntries.length + unstagedEntries.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#3B82F6] text-white text-[10px] font-mono font-bold">
                    {stagedEntries.length + unstagedEntries.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'history'
                    ? 'bg-[#2D3748] text-white font-semibold shadow-xs'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>
                  {t('git.history')} {gitLog.length > 0 ? `(${gitLog.length})` : ''}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#1C2128] text-[#38BDF8] border border-[#2D3139] font-mono text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                {branch}
              </span>
              <button
                onClick={() => {
                  refreshGitState();
                  if (activeTab === 'history') fetchLog();
                }}
                className="p-1.5 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1C2128] transition-colors cursor-pointer"
                title={t('git.refresh')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {activeTab === 'status' ? (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: staging list */}
              <div className="w-72 border-r border-[#2D3139] bg-[#0E1116] flex flex-col shrink-0 overflow-hidden">
                <div className="p-3 border-b border-[#2D3139] flex items-center justify-between bg-[#16191E]">
                  <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    {t('git.sourceControl')}
                  </span>
                  <div className="flex items-center gap-1">
                    {unstagedEntries.length > 0 && (
                      <button
                        onClick={handleStageAll}
                        className="px-2 py-0.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#38BDF8] text-[10px] font-medium border border-[#2D3139] transition-colors cursor-pointer flex items-center gap-1"
                        title={t('git.stageAll')}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('git.stageAll')}</span>
                      </button>
                    )}
                    {stagedEntries.length > 0 && (
                      <button
                        onClick={handleUnstageAll}
                        className="px-2 py-0.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] text-[10px] font-medium border border-[#2D3139] transition-colors cursor-pointer flex items-center gap-1"
                        title={t('git.unstageAll')}
                      >
                        <Minus className="w-3 h-3" />
                        <span>{t('git.unstageAll')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {successNotice && (
                  <div className="m-2 p-2 rounded bg-[#4ADE801A] border border-[#4ADE8033] text-[#4ADE80] text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('git.commitSuccess')}</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-3">
                  {/* Staged Changes */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#38BDF8]">
                      {t('git.stagedChanges')} ({stagedEntries.length})
                    </div>
                    {stagedEntries.length === 0 ? (
                      <div className="px-2 py-2 text-[11px] text-[#64748B] italic">{t('git.noFilesStaged')}</div>
                    ) : (
                      <div className="space-y-1">
                        {stagedEntries.map((entry) => {
                          const meta = getWorkingStatusMeta(entry, true);
                          const isActive = selectedEntry?.file === entry.file && selectedEntry?.staged;
                          return (
                            <div
                              key={`s:${entry.file}`}
                              onClick={() => setSelectedEntry({ file: entry.file, staged: true })}
                              className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${isActive ? 'bg-[#1C2128] border border-[#3B82F6]' : 'hover:bg-[#16191E] border border-transparent'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="font-mono text-white truncate text-[11px]" title={entry.oldFile ? `${entry.oldFile} \u2192 ${entry.file}` : entry.file}>
                                  {entry.oldFile ? `${entry.oldFile} \u2192 ${entry.file}` : entry.file}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevert(entry.file);
                                  }}
                                  className="p-1 rounded text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF44441A] transition-colors cursor-pointer"
                                  title={t('git.revertTooltip')}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnstage(entry.file);
                                  }}
                                  className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
                                  title={t('git.unstageFile')}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Unstaged Changes */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-semibold text-[#F59E0B]">
                      {t('git.unstagedChanges')} ({unstagedEntries.length})
                    </div>
                    {unstagedEntries.length === 0 ? (
                      <div></div>
                    ) : (
                      <div className="space-y-1">
                        {unstagedEntries.map((entry) => {
                          const meta = getWorkingStatusMeta(entry, false);
                          const isActive = selectedEntry?.file === entry.file && !selectedEntry?.staged;
                          return (
                            <div
                              key={`u:${entry.file}`}
                              onClick={() => setSelectedEntry({ file: entry.file, staged: false })}
                              className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${isActive ? 'bg-[#1C2128] border border-[#3B82F6]' : 'hover:bg-[#16191E] border border-transparent'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="font-mono text-[#94A3B8] truncate text-[11px]" title={entry.file}>
                                  {entry.file}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevert(entry.file);
                                  }}
                                  className="p-1 rounded text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF44441A] transition-colors cursor-pointer"
                                  title={t('git.revertTooltip')}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStage(entry.file);
                                  }}
                                  className="p-1 rounded text-[#4ADE80] hover:bg-[#4ADE801A] transition-colors cursor-pointer"
                                  title={t('git.stageFile')}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: diff viewer */}
              <div className="flex-1 flex flex-col bg-[#090B0E] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#2D3139] bg-[#16191E] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileDiff className="w-4 h-4 text-[#38BDF8] shrink-0" />
                    <span className="text-xs font-semibold text-white font-mono truncate">
                      {selectedEntry?.file || t('git.selectFileDiff')}
                    </span>
                  </div>
                  {selectedEntry && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${selectedEntry.staged
                            ? 'bg-[#38BDF81A] text-[#38BDF8] border border-[#38BDF833]'
                            : 'bg-[#F59E0B1A] text-[#F59E0B] border border-[#F59E0B33]'
                          }`}
                      >
                        {selectedEntry.staged ? t('git.stagedBadge') : t('git.workingTreeBadge')}
                      </span>
                      <button
                        onClick={() => handleRevert(selectedEntry.file)}
                        disabled={isLoading}
                        className="px-2 py-0.5 rounded bg-[#EF44441A] hover:bg-[#EF444433] text-[#EF4444] border border-[#EF444433] text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        title={t('git.revertSelectedTooltip')}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('git.revert')}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {!selectedEntry ? (
                    <div className="h-full flex items-center justify-center text-[#64748B] text-xs">
                      {t('git.selectLeftDiff')}
                    </div>
                  ) : workingDiffLoading ? (
                    <div className="h-full flex items-center justify-center text-[#64748B] text-xs gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('git.loadingDiff')}
                    </div>
                  ) : workingDiff ? (
                    <DiffLines diffText={workingDiff} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-[#64748B] text-xs px-8">
                      <span>{t('git.noDiffHead')}</span>
                      {!selectedEntry.staged && (
                        <span className="text-[11px]">{t('git.matchSnapshot')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Commit History tab */}
              <div className="w-80 border-r border-[#2D3139] bg-[#0E1116] flex flex-col shrink-0 overflow-y-auto p-2 space-y-1.5">
                {logLoading ? (
                  <div className="h-full flex items-center justify-center text-[#64748B] text-xs gap-2 py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : gitLog.length === 0 ? (
                  <div className="px-2 py-8 text-center text-[11px] text-[#64748B] italic">{t('git.noCommitsYet')}</div>
                ) : (
                  gitLog.map((commit, idx) => (
                    <div
                      key={commit.hash}
                      onClick={() => setSelectedCommitHash(commit.hash)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all space-y-1.5 ${selectedCommitHash === commit.hash
                          ? 'bg-[#1C2128] border-[#3B82F6]'
                          : 'bg-[#16191E] border-[#2D3139] hover:border-[#3B82F666]'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#38BDF8] text-[11px] font-bold flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {commit.shortHash}
                          {idx === 0 && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-[#3B82F6] text-white text-[9px]">HEAD</span>
                          )}
                        </span>
                        <span className="text-[10px] text-[#64748B]">{new Date(commit.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-white font-medium line-clamp-2 text-xs">{commit.subject}</div>
                      <div className="text-[10px] text-[#64748B] truncate">{commit.authorName}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex-1 flex flex-col bg-[#090B0E] overflow-hidden">
                {!selectedCommitHash ? (
                  <div className="h-full flex items-center justify-center text-[#64748B] text-xs">
                    {t('git.selectCommitLeft')}
                  </div>
                ) : selectedCommitFile ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#2D3139] bg-[#16191E] flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedCommitFile(null)}
                        className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#1C2128] cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <FileDiff className="w-4 h-4 text-[#38BDF8]" />
                      <span className="text-xs font-semibold text-white font-mono truncate">{selectedCommitFile}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {commitDiffLoading ? (
                        <div className="h-full flex items-center justify-center text-[#64748B] text-xs gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('git.loadingDiff')}
                        </div>
                      ) : commitDiff ? (
                        <DiffLines diffText={commitDiff} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-[#64748B] text-xs">
                          {t('git.noWorkingDiff')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {(() => {
                      const commit = gitLog.find((c) => c.hash === selectedCommitHash);
                      if (!commit) return null;
                      return (
                        <div className="p-4 border-b border-[#2D3139] bg-[#16191E] space-y-2 shrink-0">
                          <h4 className="text-sm font-semibold text-white">{commit.subject}</h4>
                          <div className="flex items-center gap-3 text-xs text-[#94A3B8] font-mono flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-[#3B82F6]" />
                              {commit.authorName} &lt;{commit.authorEmail}&gt;
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#64748B]" />
                              {new Date(commit.date).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B]">
                            {t('git.fullHash')}: <span className="text-[#94A3B8]">{commit.hash}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <div className="text-xs font-semibold text-[#94A3B8]">
                        {t('git.changedFilesInCommit')} ({commitFiles.length}):
                      </div>

                      {commitFilesLoading ? (
                        <div className="flex items-center justify-center text-[#64748B] text-xs gap-2 py-8">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : (
                        commitFiles.map((file) => {
                          const meta = COMMIT_STATUS_META[file.status];
                          return (
                            <div
                              key={file.filename}
                              onClick={() => setSelectedCommitFile(file.filename)}
                              className="bg-[#16191E] border border-[#2D3139] hover:border-[#3B82F666] p-3 rounded-lg flex items-center justify-between text-xs font-mono cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 font-mono text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded border ${meta.className}`}>
                                  {meta.label}
                                </span>
                                <span className="text-white font-semibold truncate" title={file.oldFilename ? `${file.oldFilename} \u2192 ${file.filename}` : file.filename}>
                                  {file.oldFilename ? `${file.oldFilename} \u2192 ${file.filename}` : file.filename}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] shrink-0">
                                {file.additions > 0 && <span className="text-[#4ADE80]">+{file.additions}</span>}
                                {file.deletions > 0 && <span className="text-[#EF4444]">-{file.deletions}</span>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};