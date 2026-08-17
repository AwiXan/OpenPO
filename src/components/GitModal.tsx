import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  GitBranch,
  GitCommit as GitCommitIcon,
  Plus,
  Minus,
  CheckCircle2,
  FolderGit2,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { 
  checkIsGitInitialized, 
  getGitStatus, 
  initGitRepo, 
  stageFiles, 
  unstageFiles, 
  commitChanges 
} from '../lib/systemGit';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string | null; 
  authorName: string;
  authorEmail: string;
}

interface ParsedGitStatus {
  file: string;
  staged: boolean;
  state: string;
}

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  authorName,
  authorEmail,
}) => {
  const { t } = useTranslation();

  const [isInitialized, setIsInitialized] = useState(false);
  const [statusLines, setStatusLines] = useState<ParsedGitStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refreshGitState = useCallback(async () => {
    if (!folderPath) return;
    
    setIsLoading(true);
    const initialized = await checkIsGitInitialized(folderPath);
    setIsInitialized(initialized);

    if (initialized) {
      const rawStatus = await getGitStatus(folderPath);
      const parsed = rawStatus.map(line => {
        const state = line.substring(0, 2);
        const file = line.substring(3);
        const staged = state[0] !== ' ' && state[0] !== '?';
        return { file, staged, state };
      });
      setStatusLines(parsed);
    }
    setIsLoading(false);
  }, [folderPath]);

  useEffect(() => {
    if (isOpen) {
      refreshGitState();
    }
  }, [isOpen, refreshGitState]);

  if (!isOpen) return null;

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

  const handleCommit = async () => {
    if (!folderPath || !commitMessage.trim()) return;
    
    await commitChanges(folderPath, commitMessage, authorName, authorEmail);
    setCommitMessage('');
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 3000);
    await refreshGitState();
  };

  const stagedFiles = statusLines.filter(f => f.staged);
  const unstagedFiles = statusLines.filter(f => !f.staged);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-lg w-full max-w-2xl shadow-2xl text-[#E2E8F0] overflow-hidden flex flex-col h-[70vh]">
        
        <div className="px-5 py-3 border-b border-[#2D3139] flex items-center justify-between bg-[#090B0E] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-[#3B82F61A] text-[#3B82F6] border border-[#3B82F633]">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">{t('git.title')}</h3>
              <p className="text-[11px] text-[#64748B] font-mono">{folderPath || 'No folder connected'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1C2128] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!folderPath ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-[#F59E0B]" />
            <h4 className="text-base font-semibold text-white">Local Folder Required</h4>
            <p className="text-xs text-[#94A3B8]">To use native Git commands, please open a local directory first.</p>
          </div>
        ) : !isInitialized ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <FolderGit2 className="w-10 h-10 text-[#3B82F6]" />
            <h4 className="text-base font-semibold text-white">{t('git.initTitle')}</h4>
            <button onClick={handleInit} className="px-5 py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer">
              {t('git.initRepo')}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {successNotice && (
              <div className="m-3 p-2 rounded bg-[#4ADE801A] border border-[#4ADE8033] text-[#4ADE80] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {t('git.commitSuccess')}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-[#38BDF8] mb-2">{t('git.stagedChanges')} ({stagedFiles.length})</div>
                {stagedFiles.map(f => (
                  <div key={f.file} className="flex justify-between items-center bg-[#090B0E] p-2 rounded border border-[#2D3139] mb-1">
                    <span className="text-xs font-mono text-white">{f.file}</span>
                    <button onClick={() => handleUnstage(f.file)} className="text-[#EF4444] hover:bg-[#EF44441A] p-1 rounded cursor-pointer">
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs font-semibold text-[#F59E0B] mb-2">{t('git.unstagedChanges')} ({unstagedFiles.length})</div>
                {unstagedFiles.map(f => (
                  <div key={f.file} className="flex justify-between items-center bg-[#090B0E] p-2 rounded border border-[#2D3139] mb-1">
                    <span className="text-xs font-mono text-[#94A3B8]">{f.file}</span>
                    <button onClick={() => handleStage(f.file)} className="text-[#4ADE80] hover:bg-[#4ADE801A] p-1 rounded cursor-pointer">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-[#2D3139] bg-[#16191E] space-y-3">
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={t('git.commitPlaceholder')}
                className="w-full bg-[#090B0E] border border-[#2D3139] rounded p-2 text-xs text-white focus:border-[#3B82F6] outline-none"
              />
              <button
                onClick={handleCommit}
                disabled={stagedFiles.length === 0 || !commitMessage.trim() || isLoading}
                className="w-full py-2 rounded text-xs font-semibold flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitCommitIcon className="w-4 h-4" />
                {t('git.commitButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};