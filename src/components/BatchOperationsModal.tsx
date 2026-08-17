import React, { useState } from 'react';
import { X, Sparkles, Zap, CheckCircle2, Sliders } from 'lucide-react';
import { Workspace } from '../types/gettext';

interface BatchOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onBatchApplyTm: (poFileId: string, minSimilarity?: number) => number; // Returns count of applied translations
  onClearAllFuzzy: (poFileId: string) => void;
  onMarkUntranslatedFuzzy: (poFileId: string) => void;
  fuzzyThreshold?: number;
}

export const BatchOperationsModal: React.FC<BatchOperationsModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onBatchApplyTm,
  onClearAllFuzzy,
  onMarkUntranslatedFuzzy,
  fuzzyThreshold = 80,
}) => {
  if (!isOpen) return null;

  const [selectedPoId, setSelectedPoId] = useState<string>(workspace.poFiles[0]?.id || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useExactOnly, setUseExactOnly] = useState(false);

  const selectedPo = workspace.poFiles.find((p) => p.id === selectedPoId) || workspace.poFiles[0];

  const handleApplyTm = () => {
    if (!selectedPo) return;
    const threshold = useExactOnly ? 1.0 : fuzzyThreshold / 100;
    const applied = onBatchApplyTm(selectedPo.id, threshold);
    setSuccessMessage(
      `Successfully applied ${applied} translations from Translation Memory (threshold: ${
        useExactOnly ? '100%' : `${fuzzyThreshold}%`
      }).`
    );
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleClearFuzzy = () => {
    if (!selectedPo) return;
    onClearAllFuzzy(selectedPo.id);
    setSuccessMessage(`Cleared fuzzy flag on all strings in ${selectedPo.languageName}.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleMarkFuzzy = () => {
    if (!selectedPo) return;
    onMarkUntranslatedFuzzy(selectedPo.id);
    setSuccessMessage(`Marked all partially translated strings as fuzzy.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-lg w-full max-w-lg shadow-2xl text-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2D3139] flex items-center justify-between bg-[#090B0E]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#F59E0B1A] text-[#F59E0B]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Batch Operations & Translation Memory</h3>
              <p className="text-[11px] text-[#64748B]">Automate repetitive localization tasks in 1-click.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1C2128] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target language selector */}
          <div>
            <label className="block text-[#94A3B8] mb-1.5 font-medium">Select Target Language:</label>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {workspace.poFiles.map((po) => (
                <button
                  key={po.id}
                  onClick={() => setSelectedPoId(po.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                    po.id === selectedPo?.id
                      ? 'bg-[#3B82F6] text-white shadow-xs'
                      : 'bg-[#090B0E] text-[#94A3B8] hover:bg-[#1C2128] border border-[#2D3139]'
                  }`}
                >
                  <span className="uppercase font-mono mr-1">{po.language}</span>
                  <span>{po.languageName}</span>
                </button>
              ))}
            </div>
          </div>

          {successMessage && (
            <div className="p-3 rounded bg-[#4ADE801A] border border-[#4ADE8033] text-[#4ADE80] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action 1: Auto-Fill TM */}
          <div className="bg-[#090B0E] p-3.5 rounded border border-[#2D3139] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Auto-Fill from Translation Memory</span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setUseExactOnly(false)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    !useExactOnly ? 'bg-[#3B82F6] text-white font-semibold' : 'text-[#94A3B8] bg-[#16191E]'
                  }`}
                >
                  Fuzzy (≥{fuzzyThreshold}%)
                </button>
                <button
                  onClick={() => setUseExactOnly(true)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    useExactOnly ? 'bg-[#3B82F6] text-white font-semibold' : 'text-[#94A3B8] bg-[#16191E]'
                  }`}
                >
                  100% Exact
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Scans all open catalogues and populates untranslated strings in{' '}
              <strong className="text-[#E2E8F0]">{selectedPo?.languageName}</strong> with match score ≥ {useExactOnly ? '100%' : `${fuzzyThreshold}%`}. Inexact matches are automatically marked as fuzzy.
            </p>
            <button
              onClick={handleApplyTm}
              className="w-full py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-500/10 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Auto-Fill from TM</span>
            </button>
          </div>

          {/* Action 2: Fuzzy controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-2 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-[#E2E8F0]">Clear All Fuzzy</div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Marks all fuzzy strings in {selectedPo?.language} as verified.
                </p>
              </div>
              <button
                onClick={handleClearFuzzy}
                className="w-full py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#E2E8F0] text-xs font-medium transition-colors border border-[#2D3139] cursor-pointer"
              >
                Clear Fuzzy
              </button>
            </div>

            <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-2 flex flex-col justify-between">
              <div>
                <div className="font-semibold text-[#E2E8F0]">Mark Needs Review</div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Flags partially modified strings as fuzzy for reviewers.
                </p>
              </div>
              <button
                onClick={handleMarkFuzzy}
                className="w-full py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#E2E8F0] text-xs font-medium transition-colors border border-[#2D3139] cursor-pointer"
              >
                Flag for Review
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2D3139] bg-[#090B0E] flex items-center justify-end text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
