import React, { useState } from 'react';
import { Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { Workspace } from '../types/gettext';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface BatchOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onBatchApplyTm: (poFileId: string, minSimilarity?: number) => number;
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
  const { t } = useTranslation();
  const [selectedPoId, setSelectedPoId] = useState<string>(workspace.poFiles[0]?.id || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useExactOnly, setUseExactOnly] = useState(false);

  const selectedPo = workspace.poFiles.find((p) => p.id === selectedPoId) || workspace.poFiles[0];

  const handleApplyTm = () => {
    if (!selectedPo) return;
    const threshold = useExactOnly ? 1.0 : fuzzyThreshold / 100;
    const applied = onBatchApplyTm(selectedPo.id, threshold);
    setSuccessMessage(
      `Successfully applied ${applied} translations from Translation Memory.`
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

  const modalFooter = (
    <div className="w-full flex items-center justify-end">
      <button
        onClick={onClose}
        className="px-4 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
      >
        {t('common.close')}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('batch.title')}
      subtitle={t('batch.subtitle')}
      icon={<Sparkles className="w-4 h-4" />}
      maxWidth="max-w-lg"
      footer={modalFooter}
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-[#94A3B8] mb-1.5 font-medium">{t('batch.selectLang')}</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
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
                {t('batch.fuzzyToggle').replace('{threshold}', fuzzyThreshold.toString())}
              </button>
              <button
                onClick={() => setUseExactOnly(true)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  useExactOnly ? 'bg-[#3B82F6] text-white font-semibold' : 'text-[#94A3B8] bg-[#16191E]'
                }`}
              >
                {t('batch.exactToggle')}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            {t('batch.tmDesc')
              .replace('{lang}', selectedPo?.languageName || '')
              .replace('{threshold}', useExactOnly ? '100' : fuzzyThreshold.toString())}
          </p>
          <button
            onClick={handleApplyTm}
            className="w-full py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('batch.runTm')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-[#E2E8F0]">{t('batch.clearFuzzyTitle')}</div>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                {t('batch.clearFuzzyDesc').replace('{lang}', selectedPo?.language || '')}
              </p>
            </div>
            <button
              onClick={handleClearFuzzy}
              className="w-full py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#E2E8F0] text-xs font-medium transition-colors border border-[#2D3139] cursor-pointer"
            >
              {t('batch.clearFuzzyBtn')}
            </button>
          </div>

          <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-[#E2E8F0]">{t('batch.reviewTitle')}</div>
              <p className="text-[11px] text-[#94A3B8] mt-1">{t('batch.reviewDesc')}</p>
            </div>
            <button
              onClick={handleMarkFuzzy}
              className="w-full py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#E2E8F0] text-xs font-medium transition-colors border border-[#2D3139] cursor-pointer"
            >
              {t('batch.reviewBtn')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};