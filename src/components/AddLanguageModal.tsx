import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { getPluralRuleForLanguage } from '../lib/pluralEngine';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface AddLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLanguage: (langCode: string, langName: string, pluralForms: string) => void;
  existingLanguages: string[];
}

const LANGUAGE_PRESETS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt_BR', name: 'Portuguese (Brasil)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'cs', name: 'Czech (Čeština)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'zh_CN', name: 'Chinese Simplified (简体中文)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
];

export const AddLanguageModal: React.FC<AddLanguageModalProps> = ({
  isOpen,
  onClose,
  onAddLanguage,
  existingLanguages,
}) => {
  const [selectedPreset, setSelectedPreset] = useState('it');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const { t } = useTranslation();


  const activeCode = isCustom ? customCode : selectedPreset;
  const activePreset = LANGUAGE_PRESETS.find((p) => p.code === activeCode);
  const activeName = isCustom ? customName : activePreset?.name || activeCode;

  const pluralRule = getPluralRuleForLanguage(activeCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCode.trim()) return;

    onAddLanguage(activeCode.trim(), activeName.trim(), pluralRule.formula);
    onClose();
  };

  const modalFooter = (
    <div className="w-full flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        form="add-lang-form"
        className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
      >
        Create {activeCode}.po
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Target Language (.po)"
      icon={<Globe className="w-4 h-4" />}
      maxWidth="max-w-md"
      footer={modalFooter}
    >
      <form id="add-lang-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[#E2E8F0] font-medium mb-1.5">Choose Language:</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-[#090B0E] rounded border border-[#2D3139] custom-scrollbar">
            {LANGUAGE_PRESETS.map((preset) => {
              const isAlreadyAdded = existingLanguages.includes(preset.code);
              const isSelected = !isCustom && selectedPreset === preset.code;

              return (
                <button
                  key={preset.code}
                  type="button"
                  disabled={isAlreadyAdded}
                  onClick={() => {
                    setIsCustom(false);
                    setSelectedPreset(preset.code);
                  }}
                  className={`p-2 rounded text-left transition-all flex items-center justify-between cursor-pointer ${
                    isAlreadyAdded
                      ? 'opacity-40 cursor-not-allowed bg-[#16191E]/40 text-[#64748B]'
                      : isSelected
                      ? 'bg-[#3B82F6] text-white font-medium shadow-xs'
                      : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
                  }`}
                >
                  <span className="truncate text-xs">{preset.name}</span>
                  <span className="font-mono text-[10px] uppercase opacity-75">{preset.code}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom option */}
        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer mb-2 w-max">
            <input
              type="checkbox"
              checked={isCustom}
              onChange={(e) => setIsCustom(e.target.checked)}
              className="rounded bg-[#16191E] border-[#2D3139] text-[#3B82F6] focus:ring-0"
            />
            <span className="text-[#94A3B8]">Specify custom ISO language code</span>
          </label>

          {isCustom && (
            <div className="grid grid-cols-2 gap-2 bg-[#090B0E] p-2.5 rounded border border-[#2D3139]">
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Code (e.g. sv_SE):</label>
                <input
                  type="text"
                  required={isCustom}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#E2E8F0] font-mono focus:border-[#3B82F6] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Language Name:</label>
                <input
                  type="text"
                  required={isCustom}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#E2E8F0] focus:border-[#3B82F6] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Plural Rule Preview */}
        <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-1 text-[#94A3B8]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#E2E8F0]">Plural Forms Formula:</span>
            <span className="font-mono text-[#3B82F6]">{pluralRule.nplurals} forms</span>
          </div>
          <div className="font-mono text-[10px] text-[#94A3B8] break-all bg-[#16191E] p-1.5 rounded border border-[#2D3139]">
            {pluralRule.formula}
          </div>
        </div>
      </form>
    </Modal>
  );
};