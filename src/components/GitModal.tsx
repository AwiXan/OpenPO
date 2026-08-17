import React, { useState, useMemo } from 'react';
import {
  X,
  GitBranch,
  GitCommit as GitCommitIcon,
  Plus,
  Minus,
  RotateCcw,
  Check,
  CheckCircle2,
  FileCode,
  Layers,
  History,
  FolderGit2,
  Clock,
  User,
  ArrowRight,
  FileDiff,
} from 'lucide-react';
import { Workspace, GitCommit, GitFileStatus } from '../types/gettext';
import {
  computeWorkspaceGitStatus,
  getDetailedEntryDiffs,
  DetailedEntryDiff,
} from '../lib/gitEngine';
import { useTranslation } from '../lib/i18n';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onInitGit: () => void;
  onStageFile: (filename: string) => void;
  onUnstageFile: (filename: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onCommit: (message: string) => void;
  onRevertFile: (filename: string) => void;
  onRestoreCommit: (commitId: string) => void;
  authorName: string;
  authorEmail: string;
}

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onInitGit,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onCommit,
  onRevertFile,
  onRestoreCommit,
  authorName,
  authorEmail,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFileForDiff, setSelectedFileForDiff] = useState<string | null>(null);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [commitSuccessNotice, setCommitSuccessNotice] = useState(false);
  const [restoreConfirmCommitId, setRestoreConfirmCommitId] = useState<string | null>(null);

  const gitState = workspace.git;
  const isInitialized = gitState?.isInitialized || false;

  // Compute live git file statuses
  const fileStatuses: GitFileStatus[] = useMemo(() => {
    return computeWorkspaceGitStatus(workspace);
  }, [workspace]);

  const stagedFiles = useMemo(() => fileStatuses.filter((f) => f.isStaged), [fileStatuses]);
  const unstagedFiles = useMemo(
    () => fileStatuses.filter((f) => !f.isStaged && f.status !== 'unmodified'),
    [fileStatuses]
  );
  const unmodifiedFiles = useMemo(
    () => fileStatuses.filter((f) => f.status === 'unmodified'),
    [fileStatuses]
  );

  // Auto-select first modified file for diff viewer if none selected
  const activeDiffFile = useMemo(() => {
    if (selectedFileForDiff) {
      return fileStatuses.find((f) => f.filename === selectedFileForDiff) || null;
    }
    return stagedFiles[0] || unstagedFiles[0] || fileStatuses[0] || null;
  }, [selectedFileForDiff, fileStatuses, stagedFiles, unstagedFiles]);

  // Compute detailed per-entry diffs for the selected file
  const entryDiffs: DetailedEntryDiff[] = useMemo(() => {
    if (!activeDiffFile || !gitState?.commits[0]) return [];
    const headCommit = gitState.commits[0];

    if (activeDiffFile.type === 'pot') {
      const headPot = headCommit.snapshot.potFile;
      return getDetailedEntryDiffs(headPot?.entries || [], workspace.potFile.entries);
    } else {
      const headPo = headCommit.snapshot.poFiles.find((p) => p.filename === activeDiffFile.filename);
      const currentPo = workspace.poFiles.find((p) => p.filename === activeDiffFile.filename);
      return getDetailedEntryDiffs(headPo?.entries || [], currentPo?.entries || []);
    }
  }, [activeDiffFile, gitState, workspace]);

  const changedEntryDiffs = useMemo(
    () => entryDiffs.filter((d) => d.type !== 'identical'),
    [entryDiffs]
  );

  // Active commit for history inspector
  const activeCommit: GitCommit | null = useMemo(() => {
    if (!gitState?.commits || gitState.commits.length === 0) return null;
    if (selectedCommitId) {
      return gitState.commits.find((c) => c.id === selectedCommitId || c.fullHash === selectedCommitId) || gitState.commits[0];
    }
    return gitState.commits[0];
  }, [gitState, selectedCommitId]);

  const handleCommitSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim() || stagedFiles.length === 0) return;

    onCommit(commitMessage.trim());
    setCommitMessage('');
    setCommitSuccessNotice(true);
    setTimeout(() => setCommitSuccessNotice(false), 3000);
  };

  const handleCommitKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommitSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-lg w-full max-w-5xl shadow-2xl text-[#E2E8F0] overflow-hidden flex flex-col h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#2D3139] flex items-center justify-between bg-[#090B0E] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-[#3B82F61A] text-[#3B82F6] border border-[#3B82F633]">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">{t('git.title')}</h3>
                {isInitialized && (
                  <span className="px-2 py-0.5 rounded bg-[#1C2128] text-[#38BDF8] border border-[#2D3139] font-mono text-[10px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                    {t('git.branch')}: {gitState?.branch || 'main'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B]">
                {t('git.workspace')}: <span className="font-mono text-[#94A3B8]">{workspace.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isInitialized && (
              <div className="flex bg-[#090B0E] p-0.5 rounded border border-[#2D3139] text-xs">
                <button
                  onClick={() => setActiveTab('status')}
                  className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'status'
                      ? 'bg-[#2D3748] text-white font-semibold shadow-xs'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>{t('git.changes')}</span>
                  {stagedFiles.length + unstagedFiles.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#3B82F6] text-white text-[10px] font-mono font-bold">
                      {stagedFiles.length + unstagedFiles.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'history'
                      ? 'bg-[#2D3748] text-white font-semibold shadow-xs'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{t('git.history')} ({gitState?.commits.length || 0})</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1C2128] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Not Initialized View */}
        {!isInitialized ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#1C2128] border border-[#2D3139] flex items-center justify-center text-[#3B82F6]">
              <GitBranch className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-base font-semibold text-white">{t('git.initTitle')}</h4>
              <p className="text-xs text-[#94A3B8]">
                {t('git.initDesc')}{' '}
                <strong className="text-white">{workspace.name}</strong>.
              </p>
            </div>
            <button
              onClick={onInitGit}
              className="px-5 py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>{t('git.initRepo')}</span>
            </button>
          </div>
        ) : activeTab === 'status' ? (
          /* Source Control & Changes Tab */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Staging & Changes List */}
            <div className="w-80 border-r border-[#2D3139] bg-[#0E1116] flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b border-[#2D3139] flex items-center justify-between bg-[#16191E]">
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  {t('git.sourceControl')}
                </span>
                <div className="flex items-center gap-1">
                  {unstagedFiles.length > 0 && (
                    <button
                      onClick={onStageAll}
                      className="px-2 py-0.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#38BDF8] text-[10px] font-medium border border-[#2D3139] transition-colors cursor-pointer flex items-center gap-1"
                      title={t('git.stageAll')}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{t('git.stageAll')}</span>
                    </button>
                  )}
                  {stagedFiles.length > 0 && (
                    <button
                      onClick={onUnstageAll}
                      className="px-2 py-0.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] text-[10px] font-medium border border-[#2D3139] transition-colors cursor-pointer flex items-center gap-1"
                      title={t('git.unstageAll')}
                    >
                      <Minus className="w-3 h-3" />
                      <span>{t('git.unstageAll')}</span>
                    </button>
                  )}
                </div>
              </div>

              {commitSuccessNotice && (
                <div className="m-2 p-2 rounded bg-[#4ADE801A] border border-[#4ADE8033] text-[#4ADE80] text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('git.commitSuccess')}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {/* 1. Staged Changes */}
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#38BDF8]">
                    <span>{t('git.stagedChanges')} ({stagedFiles.length})</span>
                  </div>

                  {stagedFiles.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-[#64748B] italic">{t('git.noFilesStaged')}</div>
                  ) : (
                    <div className="space-y-1">
                      {stagedFiles.map((file) => (
                        <div
                          key={file.filename}
                          onClick={() => setSelectedFileForDiff(file.filename)}
                          className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors group ${
                            activeDiffFile?.filename === file.filename
                              ? 'bg-[#1C2128] border border-[#3B82F6]'
                              : 'hover:bg-[#16191E] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {file.type === 'pot' ? (
                              <FileCode className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                            ) : (
                              <Layers className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                            )}
                            <div className="truncate">
                              <div className="font-mono text-white truncate text-[11px]">{file.filename}</div>
                              <div className="text-[10px] text-[#64748B]">
                                {file.type === 'pot' ? t('git.masterPot') : `${file.languageName || file.language}`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] font-bold text-[#4ADE80] px-1 py-0.2 rounded bg-[#4ADE801A]">
                              {file.status === 'untracked' ? 'A' : 'M'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnstageFile(file.filename);
                              }}
                              className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-[#2D3139] transition-colors cursor-pointer"
                              title={t('git.unstageFile')}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Unstaged Changes */}
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#F59E0B]">
                    <span>{t('git.unstagedChanges')} ({unstagedFiles.length})</span>
                  </div>

                  {unstagedFiles.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-[#64748B] italic">{t('git.workingTreeClean')}</div>
                  ) : (
                    <div className="space-y-1">
                      {unstagedFiles.map((file) => (
                        <div
                          key={file.filename}
                          onClick={() => setSelectedFileForDiff(file.filename)}
                          className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors group ${
                            activeDiffFile?.filename === file.filename
                              ? 'bg-[#1C2128] border border-[#3B82F6]'
                              : 'hover:bg-[#16191E] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {file.type === 'pot' ? (
                              <FileCode className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                            ) : (
                              <Layers className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                            )}
                            <div className="truncate">
                              <div className="font-mono text-white truncate text-[11px]">{file.filename}</div>
                              <div className="text-[10px] text-[#64748B]">
                                {file.diffSummary?.modifications
                                  ? `${file.diffSummary.modifications} ${t('git.stringsChanged')}`
                                  : t('git.modified')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-[10px] font-bold text-[#F59E0B] px-1 py-0.2 rounded bg-[#F59E0B1A]">
                              {file.status === 'untracked' ? 'U' : 'M'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRevertFile(file.filename);
                              }}
                              className="p-1 rounded text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#2D3139] transition-colors cursor-pointer"
                              title={t('git.discardChanges')}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStageFile(file.filename);
                              }}
                              className="p-1 rounded text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#2D3139] transition-colors cursor-pointer"
                              title={t('git.stageFile')}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Unmodified Files */}
                {unmodifiedFiles.length > 0 && (
                  <div className="pt-2 border-t border-[#1C2128]">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#64748B]">
                      {t('git.unmodified')} ({unmodifiedFiles.length})
                    </div>
                    <div className="space-y-0.5">
                      {unmodifiedFiles.map((file) => (
                        <div
                          key={file.filename}
                          onClick={() => setSelectedFileForDiff(file.filename)}
                          className="flex items-center gap-2 px-2 py-1 text-[11px] text-[#64748B] hover:text-[#94A3B8] hover:bg-[#16191E] rounded cursor-pointer font-mono"
                        >
                          <Check className="w-3 h-3 text-[#4ADE80]" />
                          <span className="truncate">{file.filename}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Commit Input Box */}
              <div className="p-3 border-t border-[#2D3139] bg-[#16191E] space-y-2 shrink-0">
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={handleCommitKeyDown}
                  placeholder={t('git.commitPlaceholder')}
                  className="w-full bg-[#090B0E] border border-[#2D3139] rounded p-2 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-none h-18 font-mono"
                />

                <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                  <span className="truncate max-w-[170px]" title={`${authorName} <${authorEmail}>`}>
                    {t('git.author')}: {authorName}
                  </span>
                  <span>{stagedFiles.length} {t('git.stagedCount')}</span>
                </div>

                <button
                  onClick={() => handleCommitSubmit()}
                  disabled={stagedFiles.length === 0 || !commitMessage.trim()}
                  className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    stagedFiles.length > 0 && commitMessage.trim()
                      ? 'bg-[#3B82F6] hover:bg-[#2563EB] text-white shadow-md shadow-blue-500/10'
                      : 'bg-[#1C2128] text-[#64748B] cursor-not-allowed border border-[#2D3139]'
                  }`}
                >
                  <GitCommitIcon className="w-3.5 h-3.5" />
                  <span>{t('git.commitButton')}</span>
                </button>
              </div>
            </div>

            {/* Right Pane: Visual Diff Viewer */}
            <div className="flex-1 flex flex-col bg-[#090B0E] overflow-hidden">
              {/* Diff Header */}
              <div className="px-4 py-2.5 border-b border-[#2D3139] bg-[#16191E] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileDiff className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-xs font-semibold text-white font-mono">
                    {activeDiffFile?.filename || t('git.selectFileDiff')}
                  </span>
                  {activeDiffFile && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        activeDiffFile.isStaged
                          ? 'bg-[#38BDF81A] text-[#38BDF8] border border-[#38BDF833]'
                          : 'bg-[#F59E0B1A] text-[#F59E0B] border border-[#F59E0B33]'
                      }`}
                    >
                      {activeDiffFile.isStaged ? t('git.stagedBadge') : t('git.workingTreeBadge')}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#64748B] flex items-center gap-3">
                  <span>{changedEntryDiffs.length} {t('git.modifiedEntries')}</span>
                  <span>{entryDiffs.length} {t('git.totalEntries')}</span>
                </div>
              </div>

              {/* Diff Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!activeDiffFile ? (
                  <div className="h-full flex items-center justify-center text-[#64748B] text-xs">
                    {t('git.selectLeftDiff')}
                  </div>
                ) : changedEntryDiffs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-[#94A3B8]">
                    <CheckCircle2 className="w-8 h-8 text-[#4ADE80]" />
                    <div className="text-xs font-semibold text-white">{t('git.noDiffHead')}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {t('git.matchSnapshot')}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {changedEntryDiffs.map((diff) => (
                      <div
                        key={diff.entryId}
                        className="bg-[#16191E] border border-[#2D3139] rounded-lg p-3 space-y-2 text-xs font-mono"
                      >
                        {/* Entry Key & Type Badge */}
                        <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{diff.msgid}</span>
                            {diff.msgidPlural && (
                              <span className="text-[10px] text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#1C2128]">
                                [plural: {diff.msgidPlural}]
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              diff.type === 'added'
                                ? 'bg-[#4ADE801A] text-[#4ADE80] border border-[#4ADE8033]'
                                : diff.type === 'removed'
                                ? 'bg-[#EF44441A] text-[#EF4444] border border-[#EF444433]'
                                : 'bg-[#F59E0B1A] text-[#F59E0B] border border-[#F59E0B33]'
                            }`}
                          >
                            {diff.type}
                          </span>
                        </div>

                        {/* Diff Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                          {/* Old / Head Version */}
                          <div className="bg-[#090B0E] p-2.5 rounded border border-[#EF444433] space-y-1">
                            <div className="text-[10px] text-[#EF4444] font-semibold flex items-center gap-1">
                              <span>{t('git.headOld')}</span>
                            </div>
                            {diff.oldMsgstr && diff.oldMsgstr.length > 0 ? (
                              diff.oldMsgstr.map((str, i) => (
                                <div key={i} className="text-[#94A3B8] break-all">
                                  {diff.oldMsgstr && diff.oldMsgstr.length > 1 && (
                                    <span className="text-[#64748B] mr-1">[{i}]:</span>
                                  )}
                                  <span className="text-[#FCA5A5] line-through">"{str || '(empty)'}"</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-[#64748B] italic">{t('git.nonExistent')}</span>
                            )}
                          </div>

                          {/* New / Current Version */}
                          <div className="bg-[#090B0E] p-2.5 rounded border border-[#4ADE8033] space-y-1">
                            <div className="text-[10px] text-[#4ADE80] font-semibold flex items-center gap-1">
                              <span>{t('git.headNew')}</span>
                            </div>
                            {diff.newMsgstr && diff.newMsgstr.length > 0 ? (
                              diff.newMsgstr.map((str, i) => (
                                <div key={i} className="text-white break-all">
                                  {diff.newMsgstr && diff.newMsgstr.length > 1 && (
                                    <span className="text-[#64748B] mr-1">[{i}]:</span>
                                  )}
                                  <span className="text-[#86EFAC] font-semibold">"{str || '(empty)'}"</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-[#64748B] italic">{t('git.removed')}</span>
                            )}
                          </div>
                        </div>

                        {/* Flags diff if any */}
                        {(diff.oldFlags || diff.newFlags) && (
                          <div className="flex items-center gap-2 text-[10px] text-[#64748B] pt-1">
                            <span>{t('git.flags')}:</span>
                            {diff.oldFlags && (
                              <span className="line-through text-[#EF4444]">
                                {diff.oldFlags.join(', ') || t('git.none')}
                              </span>
                            )}
                            <ArrowRight className="w-3 h-3" />
                            <span className="text-[#4ADE80]">{diff.newFlags?.join(', ') || t('git.none')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Commit History / Log Tab */
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Commit List */}
            <div className="w-80 border-r border-[#2D3139] bg-[#0E1116] flex flex-col shrink-0 overflow-y-auto p-2 space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {t('git.commitLog')} ({gitState?.commits.length || 0})
              </div>

              {gitState?.commits.map((commit, idx) => (
                <div
                  key={commit.id}
                  onClick={() => setSelectedCommitId(commit.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all space-y-1.5 ${
                    activeCommit?.id === commit.id
                      ? 'bg-[#1C2128] border-[#3B82F6]'
                      : 'bg-[#16191E] border-[#2D3139] hover:border-[#3B82F666]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#38BDF8] text-[11px] font-bold">
                      {commit.id}
                      {idx === 0 && (
                        <span className="ml-1.5 px-1 py-0.2 rounded bg-[#3B82F6] text-white text-[9px]">
                          HEAD
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[#64748B]">
                      {new Date(commit.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-white font-medium line-clamp-2 text-xs">{commit.message}</div>

                  <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                    <span className="truncate max-w-[140px]">{commit.author}</span>
                    <span>{commit.filesChanged.length} {t('git.files')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Commit Details & Restore Action */}
            <div className="flex-1 flex flex-col bg-[#090B0E] overflow-hidden">
              {activeCommit ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Detail Header */}
                  <div className="p-4 border-b border-[#2D3139] bg-[#16191E] space-y-3 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{activeCommit.message}</h4>
                        <div className="flex items-center gap-3 text-xs text-[#94A3B8] mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-[#3B82F6]" />
                            {activeCommit.author} &lt;{activeCommit.authorEmail}&gt;
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#64748B]" />
                            {new Date(activeCommit.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {restoreConfirmCommitId === activeCommit.id ? (
                          <div className="flex items-center gap-1.5 bg-[#EF44441A] border border-[#EF444433] p-1.5 rounded">
                            <span className="text-[11px] text-[#EF4444]">{t('git.confirmRollback')}</span>
                            <button
                              onClick={() => {
                                onRestoreCommit(activeCommit.id);
                                setRestoreConfirmCommitId(null);
                              }}
                              className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-[10px] font-bold cursor-pointer hover:bg-[#DC2626]"
                            >
                              {t('git.yesRestore')}
                            </button>
                            <button
                              onClick={() => setRestoreConfirmCommitId(null)}
                              className="px-2 py-0.5 rounded bg-[#1C2128] text-[#94A3B8] text-[10px] cursor-pointer"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRestoreConfirmCommitId(activeCommit.id)}
                            className="px-3 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#38BDF8] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
                            title={t('git.checkoutSnapshot')}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t('git.checkoutSnapshot')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[#64748B]">
                      {t('git.fullHash')}: <span className="text-[#94A3B8]">{activeCommit.fullHash}</span>
                    </div>
                  </div>

                  {/* Files in Commit */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="text-xs font-semibold text-[#94A3B8]">
                      {t('git.changedFilesInCommit')} ({activeCommit.filesChanged.length}):
                    </div>

                    <div className="space-y-2">
                      {activeCommit.filesChanged.map((file) => (
                        <div
                          key={file.filename}
                          className="bg-[#16191E] border border-[#2D3139] p-3 rounded-lg flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-[#38BDF8]" />
                            <span className="text-white font-semibold">{file.filename}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-[#4ADE801A] text-[#4ADE80]">
                              +{file.additions} {t('git.stringsAdded')}
                            </span>
                            {file.deletions > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#EF44441A] text-[#EF4444]">
                                -{file.deletions} {t('git.stringsRemoved')}
                              </span>
                            )}
                            <span className="uppercase text-[10px] text-[#64748B]">{file.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[#64748B] text-xs">
                  {t('git.selectCommitLeft')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#2D3139] flex items-center justify-between bg-[#090B0E] text-xs shrink-0">
          <div className="flex items-center gap-2 text-[#64748B] text-[11px] font-mono">
            <span>{t('git.engineActive')}</span>
            <span>•</span>
            <span>{isInitialized ? `${t('git.history')}: ${gitState?.commits.length || 0}` : t('git.uninitialized')}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#E2E8F0] text-xs border border-[#2D3139] transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
