import React, { useState } from 'react';
import {
  Sliders,
  RotateCcw,
  Check,
  Zap,
  Globe,
  GitBranch,
  ShieldCheck,
  FileCode,
  FolderSync,
  ArrowBigDown,
  Layers,
  CornerDownLeft,
  FileJson, 
  FileText,
  Eye
} from 'lucide-react';
import { AppSettings, PoNamingScheme } from '../types/gettext';
import { useTranslation, SUPPORTED_UI_LANGUAGES, UiLanguage } from '../lib/i18n';
import { Modal } from './ui/Modal';
import { SettingToggleRow } from './ui/SettingToggleRow';

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
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    csvPluralSuffix: '_P%d', // Дефолтное значение, если его еще нет
    ...settings,
  });
  const [localDomain, setLocalDomain] = useState<string>(domainName);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'modular' | 'tm' | 'newlines' | 'git' | 'editor'>('modular');

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
      autoCompileCsvOnSave: false,
      autoCompileJsonOnSave: false,
      csvPluralSuffix: '_P%d',
    };
    setLocalSettings(defaults);
  };

  const thresholdPresets = [60, 70, 75, 80, 85, 90, 95];

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      icon={<Sliders className="w-4 h-4" />}
      maxWidth="max-w-2xl"
      footer={modalFooter}
    >
      {/* Tab Navigation (Inside body to scroll with content if needed) */}
      <div className="flex border-b border-[#2D3139] mb-5 overflow-x-auto custom-scrollbar pb-px">
        {[
          { id: 'modular', icon: Layers, label: t('settings.modularTab') },
          { id: 'newlines', icon: CornerDownLeft, label: t('settings.newlinesTab') },
          { id: 'language', icon: Globe, label: t('settings.languageTab') },
          { id: 'tm', icon: Zap, label: t('settings.tmTab') },
          { id: 'git', icon: GitBranch, label: t('settings.gitTab') },
          { id: 'editor', icon: Sliders, label: t('settings.shortcutsTab') },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${isActive
                ? 'border-[#3B82F6] text-[#3B82F6]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-5 text-xs">
        {activeTab === 'modular' && (
          <div className="space-y-4">
            <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[#38BDF8]" />
                  <span>{t('settings.domainTitle')}</span>
                </label>
                <p className="text-[11px] text-[#64748B] mt-0.5">{t('settings.domainDesc')}</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="text"
                  value={localDomain}
                  onChange={(e) => setLocalDomain(e.target.value)}
                  placeholder="e.g. ecommerce, gamemode_survival"
                  className="flex-1 bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:border-[#3B82F6] outline-none font-mono"
                />
                <span className="text-[11px] text-[#64748B] font-mono shrink-0">
                  Template: {localDomain || 'messages'}.pot
                </span>
              </div>
            </div>

            <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
              <label className="text-white font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#3B82F6]" />
                <span>{t('settings.namingSchemeTitle')}</span>
              </label>
              <p className="text-[11px] text-[#64748B]">{t('settings.namingSchemeDesc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'domain_lang' as PoNamingScheme, title: 'domain_lang.po', example: `${localDomain || 'ecommerce'}_en.po`, badge: 'Modular / Games' },
                  { id: 'lang' as PoNamingScheme, title: 'lang.po', example: 'en.po', badge: 'Flat Standard' },
                  { id: 'locale_path' as PoNamingScheme, title: 'locale/domain.po', example: `en/${localDomain || 'ecommerce'}.po`, badge: 'GNU Hierarchy' },
                ].map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => setLocalSettings({ ...localSettings, poNamingScheme: scheme.id })}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${localSettings.poNamingScheme === scheme.id
                      ? 'bg-[#1E293B] border-[#3B82F6] text-white shadow-xs'
                      : 'bg-[#16191E] border-[#2D3139] text-[#94A3B8] hover:bg-[#1C2128]'
                      }`}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-mono font-bold text-xs">{scheme.title}</span>
                      {localSettings.poNamingScheme === scheme.id && <Check className="w-3.5 h-3.5 text-[#3B82F6]" />}
                    </div>
                    <div className="text-[10px] text-[#38BDF8] font-mono">{scheme.example}</div>
                    <div className="text-[9px] text-[#64748B] mt-1">{scheme.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SettingToggleRow
                icon={<FolderSync className="w-4 h-4 text-[#4ADE80]" />}
                title={t('settings.autoMoTitle')}
                description={t('settings.autoMoDesc')}
                checked={localSettings.autoCompileMoOnSave}
                onChange={(checked) => setLocalSettings({ ...localSettings, autoCompileMoOnSave: checked })}
              />

              <SettingToggleRow
                icon={<FileJson className="w-4 h-4 text-[#FBBF24]" />}
                title={t('settings.autoJsonTitle', 'Auto-export to JSON')}
                description={t('settings.autoJsonDesc', 'Generate flat key-value .json files alongside your .po catalogs.')}
                checked={localSettings.autoCompileJsonOnSave ?? false}
                onChange={(checked) => setLocalSettings({ ...localSettings, autoCompileJsonOnSave: checked })}
              />

              <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] flex flex-col gap-3 transition-colors hover:border-[#3B82F644]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-white font-semibold flex items-center gap-1.5 cursor-pointer" onClick={() => setLocalSettings({ ...localSettings, autoCompileCsvOnSave: !localSettings.autoCompileCsvOnSave })}>
                      <FileText className="w-4 h-4 text-[#10B981]" />
                      <span>{t('settings.autoCsvTitle', 'Auto-export to CSV')}</span>
                    </label>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {t('settings.autoCsvDesc', 'Export a unified translations.csv matrix ideal for game engines.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={localSettings.autoCompileCsvOnSave}
                    onClick={() => setLocalSettings({ ...localSettings, autoCompileCsvOnSave: !localSettings.autoCompileCsvOnSave })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                      localSettings.autoCompileCsvOnSave ? 'bg-[#3B82F6]' : 'bg-[#2D3139]'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${localSettings.autoCompileCsvOnSave ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                  </button>
                </div>
                
                {localSettings.autoCompileCsvOnSave && (
                  <div className="pt-3 border-t border-[#1C2128] flex items-center gap-3">
                    <label className="text-[#94A3B8] text-[11px] font-medium shrink-0">Plural Suffix Rule:</label>
                    <input
                      type="text"
                      value={localSettings.csvPluralSuffix || '_P%d'}
                      onChange={(e) => setLocalSettings({ ...localSettings, csvPluralSuffix: e.target.value })}
                      placeholder="_P%d"
                      className="w-24 bg-[#16191E] border border-[#2D3139] rounded px-2 py-1 text-xs text-white focus:border-[#3B82F6] outline-none font-mono"
                    />
                    <span className="text-[#64748B] text-[10px] italic">e.g. ITEM_COIN_P0, ITEM_COIN_P1</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'newlines' && (
          <div className="space-y-4">
            <SettingToggleRow
              icon={<CornerDownLeft className="w-4 h-4 text-[#38BDF8]" />}
              title={t('settings.autoNewlineEnter')}
              description={t('settings.autoNewlineDesc')}
              checked={localSettings.autoNewlineOnEnter}
              onChange={(checked) => setLocalSettings({ ...localSettings, autoNewlineOnEnter: checked })}
            />

            <SettingToggleRow
              icon={<Eye className="w-4 h-4 text-[#4ADE80]" />}
              title={t('settings.showNewlinesDefault')}
              description={t('settings.showNewlinesDesc')}
              checked={localSettings.showNewlinesVisible}
              onChange={(checked) => setLocalSettings({ ...localSettings, showNewlinesVisible: checked })}
            />
          </div>
        )}

        {activeTab === 'language' && (
          <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
            <div>
              <label className="text-white font-semibold flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#38BDF8]" />
                <span>{t('settings.uiLanguage')}</span>
              </label>
              <p className="text-[11px] text-[#64748B] mt-0.5">{t('settings.uiLanguageDesc')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {SUPPORTED_UI_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setUiLanguage(lang.code as UiLanguage)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${currentUiLang === lang.code
                    ? 'bg-[#1E293B] border-[#3B82F6] text-white shadow-xs'
                    : 'bg-[#16191E] border-[#2D3139] text-[#94A3B8] hover:bg-[#1C2128]'
                    }`}
                >
                  <div className="flex gap-2.5">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="text-left">
                      <div className="font-semibold text-[#E2E8F0]">{lang.nativeName}</div>
                      <div className="text-[10px] text-[#64748B]">{lang.name} ({lang.code})</div>
                    </div>
                  </div>
                  {currentUiLang === lang.code && <Check className="w-4 h-4 text-[#3B82F6]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tm' && (
          <div className="space-y-5">
            <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <span>{t('settings.similarityThreshold')}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#3B82F61A] text-[#3B82F6] font-mono text-[11px] font-bold border border-[#3B82F633]">
                    {localSettings.fuzzyMatchingThreshold}%
                  </span>
                </label>
                <p className="text-[11px] text-[#64748B] mt-0.5">{t('settings.thresholdDesc')}</p>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <input
                  type="range"
                  min="30" max="100" step="1"
                  value={localSettings.fuzzyMatchingThreshold}
                  onChange={(e) => setLocalSettings({ ...localSettings, fuzzyMatchingThreshold: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-[#3B82F6] h-1.5 bg-[#1C2128] rounded-lg cursor-pointer"
                />
              </div>
              <div className="pt-2 border-t border-[#1C2128] flex items-center gap-1.5">
                <span className="text-[10px] text-[#64748B] mr-1">{t('settings.presets', 'Presets:')}</span>
                {thresholdPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLocalSettings({ ...localSettings, fuzzyMatchingThreshold: preset })}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${localSettings.fuzzyMatchingThreshold === preset ? 'bg-[#3B82F6] text-white font-bold' : 'bg-[#16191E] text-[#94A3B8] border border-[#2D3139]'
                      }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <SettingToggleRow
              icon={<ShieldCheck className="w-4 h-4 text-[#F59E0B]" />}
              title={t('settings.autoMarkFuzzy')}
              description={t('settings.autoMarkFuzzyDesc')}
              checked={localSettings.autoMarkFuzzyUnder100}
              onChange={(checked) => setLocalSettings({ ...localSettings, autoMarkFuzzyUnder100: checked })}
            />
          </div>
        )}

        {activeTab === 'git' && (
          <div className="space-y-4">
            <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
              <div>
                <label className="text-white font-semibold flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>{t('settings.gitAuthorTitle', 'Git Committer Attribution')}</span>
                </label>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {t('settings.gitAuthorDesc', 'Default author identity written to commits.')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[#94A3B8] text-[11px] mb-1 font-medium">{t('settings.gitAuthorName', 'Author Name:')}</label>
                  <input
                    type="text"
                    value={localSettings.authorName}
                    onChange={(e) => setLocalSettings({ ...localSettings, authorName: e.target.value })}
                    className="w-full bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white focus:border-[#3B82F6] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#94A3B8] text-[11px] mb-1 font-medium">{t('settings.gitAuthorEmail', 'Author Email:')}</label>
                  <input
                    type="email"
                    value={localSettings.authorEmail}
                    onChange={(e) => setLocalSettings({ ...localSettings, authorEmail: e.target.value })}
                    className="w-full bg-[#16191E] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white focus:border-[#3B82F6] outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="bg-[#090B0E] p-4 rounded-lg border border-[#2D3139] space-y-3">
            <label className="text-white font-semibold text-xs block">
              {t('settings.shortcutsTitle', 'Keyboard Shortcuts')}
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                { label: 'Undo Edit:', kbd: 'Ctrl+Z / Cmd+Z' },
                { label: 'Redo Edit:', kbd: 'Ctrl+Y / Cmd+Shift+Z' },
                { label: 'Next / Prev:', kbd: 'Ctrl+Down / Up' },
                { label: 'Save & Next:', kbd: 'Ctrl+Enter' }
              ].map(s => (
                <div key={s.label} className="bg-[#16191E] p-2.5 rounded border border-[#2D3139] flex justify-between items-center">
                  <span className="text-[#94A3B8]">{s.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#090B0E] text-[#E2E8F0] border border-[#2D3139] font-mono text-[10px]">{s.kbd}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};