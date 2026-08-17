import React, { useState } from 'react';
import {
  X,
  Sliders,
  RotateCcw,
  Check,
  Zap,
  Globe,
  GitBranch,
  ShieldCheck,
  FileCode,
  FolderSync,
  Layers,
  CornerDownLeft,
} from 'lucide-react';
import { AppSettings, PoNamingScheme } from '../types/gettext';
import { useTranslation, SUPPORTED_UI_LANGUAGES, UiLanguage } from '../lib/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  domainName?: string;
  onRenameDomain?: (newDomain: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  domainName = 'messages',
  onRenameDomain,
}) => {
  const { t, currentUiLang, setUiLanguage } = useTranslation();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [localDomain, setLocalDomain] = useState<string>(domainName);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'modular' | 'tm' | 'newlines' | 'git' | 'editor'>('modular');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    if (onRenameDomain && localDomain.trim() && localDomain !== domainName) {
      onRenameDomain(localDomain.trim());
    }
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 600);
  };

  const handleResetDefaults = () => {
    const defaults: AppSettings = {
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
    setLocalSettings(defaults);
  };

  const thresholdPresets = [60, 70, 75, 80, 85, 90, 95];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2D3139] flex items-center justify-between bg-[#1C2128]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F61A] flex items-center justify-center text-[#3B82F6] border border-[#3B82F633]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">{t('settings.title')}</h2>
              <p className="text-[11px] text-[#94A3B8]">
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2D3748] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2D3139] bg-[#090B0E] px-4 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('modular')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'modular'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('settings.modularTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('newlines')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'newlines'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span>{t('settings.newlinesTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'language'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t('settings.languageTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('tm')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tm'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t('settings.tmTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('git')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'git'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>{t('settings.gitTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? 'border-[#3B82F6] text-[#3B82F6] bg-[#16191E]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('settings.shortcutsTab')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs custom-scrollbar">
          {/* Modular / Multi-Translation & .MO Auto-Generation Tab */}
          {activeTab === 'modular' && (
            <div className="space-y-4">
              {/* Domain Name Setting */}
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('settings.domainTitle')}</span>
                    </label>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {t('settings.domainDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="text"
                    value={localDomain}
                    onChange={(e) => setLocalDomain(e.target.value)}
                    placeholder="e.g. ecommerce, gamemode_survival, main_ui"
                    className="flex-1 bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] outline-none font-mono"
                  />
                  <span className="text-[11px] text-[#64748B] font-mono shrink-0">
                    Template: {localDomain || 'messages'}.pot
                  </span>
                </div>
              </div>

              {/* PO File Naming Scheme */}
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#3B82F6]" />
                  <span>{t('settings.namingSchemeTitle')}</span>
                </label>
                <p className="text-[11px] text-[#64748B]">
                  {t('settings.namingSchemeDesc')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    {
                      id: 'domain_lang' as PoNamingScheme,
                      title: 'domain_lang.po',
                      example: `${localDomain || 'ecommerce'}_en.po & .mo`,
                      badge: 'Modular / Games (Recommended)',
                    },
                    {
                      id: 'lang' as PoNamingScheme,
                      title: 'lang.po',
                      example: 'en.po & en.mo',
                      badge: 'Flat Standard',
                    },
                    {
                      id: 'locale_path' as PoNamingScheme,
                      title: 'locale/domain.po',
                      example: `en/${localDomain || 'ecommerce'}.po`,
                      badge: 'GNU Hierarchy',
                    },
                  ].map((scheme) => {
                    const isSelected = localSettings.poNamingScheme === scheme.id;
                    return (
                      <button
                        key={scheme.id}
                        type="button"
                        onClick={() =>
                          setLocalSettings({
                            ...localSettings,
                            poNamingScheme: scheme.id,
                          })
                        }
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#1E293B] border-[#3B82F6] text-white shadow-xs'
                            : 'bg-[#16191E] border-[#2D3139] text-[#94A3B8] hover:bg-[#1C2128] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-xs text-[#E2E8F0]">
                            {scheme.title}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                        </div>
                        <div className="text-[10px] text-[#38BDF8] font-mono">{scheme.example}</div>
                        <div className="text-[9px] text-[#64748B] mt-1">{scheme.badge}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Compile .MO File Toggle */}
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] flex items-center justify-between">
                <div>
                  <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-[#4ADE80]" />
                    <span>{t('settings.autoMoTitle')}</span>
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('settings.autoMoDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      autoCompileMoOnSave: !localSettings.autoCompileMoOnSave,
                    })
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    localSettings.autoCompileMoOnSave ? 'bg-[#3B82F6]' : 'bg-[#2D3139]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      localSettings.autoCompileMoOnSave ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Newline (\n) Tab */}
          {activeTab === 'newlines' && (
            <div className="space-y-4">
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                      <CornerDownLeft className="w-4 h-4 text-[#38BDF8]" />
                      <span>{t('settings.autoNewlineEnter')}</span>
                    </label>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {t('settings.autoNewlineDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings({
                        ...localSettings,
                        autoNewlineOnEnter: !localSettings.autoNewlineOnEnter,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      localSettings.autoNewlineOnEnter ? 'bg-[#3B82F6]' : 'bg-[#2D3139]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        localSettings.autoNewlineOnEnter ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] flex items-center justify-between">
                <div>
                  <label className="text-white font-semibold text-xs">
                    {t('settings.showNewlinesDefault')}
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('settings.showNewlinesDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      showNewlinesVisible: !localSettings.showNewlinesVisible,
                    })
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    localSettings.showNewlinesVisible ? 'bg-[#3B82F6]' : 'bg-[#2D3139]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      localSettings.showNewlinesVisible ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* UI Language Selection Tab */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <div>
                  <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-[#38BDF8]" />
                    <span>{t('settings.uiLanguage')}</span>
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('settings.uiLanguageDesc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {SUPPORTED_UI_LANGUAGES.map((lang) => {
                    const isSelected = currentUiLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setUiLanguage(lang.code as UiLanguage)}
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#1E293B] border-[#3B82F6] text-white shadow-xs'
                            : 'bg-[#16191E] border-[#2D3139] text-[#94A3B8] hover:bg-[#1C2128] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{lang.flag}</span>
                          <div className="text-left">
                            <div className="font-semibold text-[#E2E8F0]">{lang.nativeName}</div>
                            <div className="text-[10px] text-[#64748B]">
                              {lang.name} ({lang.code})
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#3B82F6]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TM Matching Tab */}
          {activeTab === 'tm' && (
            <div className="space-y-5">
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                      <span>{t('settings.similarityThreshold')}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#3B82F61A] text-[#3B82F6] font-mono text-[11px] font-bold border border-[#3B82F633]">
                        {localSettings.fuzzyMatchingThreshold}%
                      </span>
                    </label>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {t('settings.thresholdDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <input
                    type="range"
                    min="30"
                    max="100"
                    step="1"
                    value={localSettings.fuzzyMatchingThreshold}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        fuzzyMatchingThreshold: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-[#3B82F6] h-1.5 bg-[#1C2128] rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="30"
                      max="100"
                      value={localSettings.fuzzyMatchingThreshold}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                        setLocalSettings({
                          ...localSettings,
                          fuzzyMatchingThreshold: val,
                        });
                      }}
                      className="w-14 bg-[#16191E] border border-[#2D3139] rounded px-2 py-1 text-xs font-mono text-center text-white focus:border-[#3B82F6] outline-none"
                    />
                    <span className="text-[#64748B] font-mono">%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1C2128] flex items-center gap-1.5">
                  <span className="text-[10px] text-[#64748B] mr-1">{t('settings.presets', 'Presets:')}</span>
                  {thresholdPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setLocalSettings({
                          ...localSettings,
                          fuzzyMatchingThreshold: preset,
                        })
                      }
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                        localSettings.fuzzyMatchingThreshold === preset
                          ? 'bg-[#3B82F6] text-white font-bold'
                          : 'bg-[#16191E] hover:bg-[#1C2128] text-[#94A3B8] border border-[#2D3139]'
                      }`}
                    >
                      {preset}%{preset === 80 ? ' (Default)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] flex items-center justify-between">
                <div>
                  <label className="text-white font-medium text-xs">{t('settings.autoMarkFuzzy')}</label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('settings.autoMarkFuzzyDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLocalSettings({
                      ...localSettings,
                      autoMarkFuzzyUnder100: !localSettings.autoMarkFuzzyUnder100,
                    })
                  }
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    localSettings.autoMarkFuzzyUnder100 ? 'bg-[#3B82F6]' : 'bg-[#2D3139]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      localSettings.autoMarkFuzzyUnder100 ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3.5 rounded bg-[#1C2128] border border-[#2D3139] text-[#94A3B8] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#38BDF8] font-semibold">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{t('settings.tmHowTitle', 'How Translation Memory Matching Works')}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {t(
                    'settings.tmHowDesc',
                    `OpenPO indexes all translated segments across open workspaces in real-time. When you edit a string, candidate matches with a similarity score meeting or exceeding your configured threshold (${localSettings.fuzzyMatchingThreshold}%) appear in the suggestions pane.`
                  ).replace('{threshold}', String(localSettings.fuzzyMatchingThreshold))}
                </p>
              </div>
            </div>
          )}

          {/* Git Tab */}
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <div>
                  <label className="text-white font-semibold text-xs flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>{t('settings.gitAuthorTitle', 'Git Committer Attribution')}</span>
                  </label>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('settings.gitAuthorDesc', 'Default author identity written to gettext workspace Git commits and PO revision headers.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[#94A3B8] text-[11px] mb-1 font-medium">{t('settings.gitAuthorName', 'Author Name:')}</label>
                    <input
                      type="text"
                      value={localSettings.authorName}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          authorName: e.target.value,
                        })
                      }
                      placeholder="Translator Name"
                      className="w-full bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#94A3B8] text-[11px] mb-1 font-medium">{t('settings.gitAuthorEmail', 'Author Email:')}</label>
                    <input
                      type="email"
                      value={localSettings.authorEmail}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          authorEmail: e.target.value,
                        })
                      }
                      placeholder="translator@example.com"
                      className="w-full bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded bg-[#1C2128] border border-[#2D3139] text-[#94A3B8] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#4ADE80] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('settings.gitArchTitle', 'Workspace Version Control Architecture')}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {t('settings.gitArchDesc', 'Every workspace operates an isolated in-memory Git DAG tracking full catalogue snapshots, commit logs, file staging, and per-entry diff calculations.')}
                </p>
              </div>
            </div>
          )}

          {/* Shortcuts Tab */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
                <label className="text-white font-semibold text-xs block">
                  {t('settings.shortcutsTitle', 'Keyboard Shortcuts & Navigation')}
                </label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t('settings.shortcutUndo', 'Undo Edit:')}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#090B0E] text-[#E2E8F0] border border-[#2D3139] font-mono text-[10px]">
                      Ctrl+Z / Cmd+Z
                    </kbd>
                  </div>
                  <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t('settings.shortcutRedo', 'Redo Edit:')}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#090B0E] text-[#E2E8F0] border border-[#2D3139] font-mono text-[10px]">
                      Ctrl+Y / Cmd+Shift+Z
                    </kbd>
                  </div>
                  <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t('settings.shortcutNextPrev', 'Next / Prev Key:')}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#090B0E] text-[#E2E8F0] border border-[#2D3139] font-mono text-[10px]">
                      Ctrl+Down / Up
                    </kbd>
                  </div>
                  <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t('settings.shortcutSaveNext', 'Save & Next:')}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-[#090B0E] text-[#E2E8F0] border border-[#2D3139] font-mono text-[10px]">
                      Ctrl+Enter
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2D3139] flex items-center justify-between bg-[#090B0E] shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('settings.resetDefaults')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs border border-[#2D3139] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer"
            >
              {savedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('settings.saved')}</span>
                </>
              ) : (
                <span>{t('settings.save')}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
