import React from 'react';
import {
  X,
  Sparkles,
  Layers,
  FileSpreadsheet,
  GitBranch,
  FolderSync,
  Hash,
  Binary,
  Heart,
  Sliders,
  Keyboard,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#16191E] border border-[#2D3139] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-[#2D3139] bg-gradient-to-b from-[#1C2128] to-[#16191E] flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
              <span className="text-2xl font-black">◇</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">OpenPO</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#3B82F622] text-[#38BDF8] border border-[#3B82F644] font-mono font-bold">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {t('about.subtitle', 'Modern Professional GNU gettext (.po / .pot / .mo) Localization Suite')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2D3748] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs custom-scrollbar">
          {/* Vibecoded Notice Callout */}
          <div className="bg-gradient-to-r from-[#3B82F615] via-[#1E293B] to-[#3B82F608] border border-[#3B82F633] rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#3B82F622] text-[#38BDF8] shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">{t('about.vibecodedTitle', 'Vibecoded with AwiXan')}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                    {t('about.aiCraft', '100% AI Craft')}
                  </span>
                </div>
                <p className="text-[#CBD5E1] text-xs leading-relaxed italic">
                  "{t('about.vibecodedNote', 'This app is 100% vibecoded asf (with guidance by AwiXan, but i, like, did nothing). And I kinda feel guilty, but just for the sake of convenience, I think i have to release this app.')}"
                </p>
              </div>
            </div>
          </div>

          {/* Key Capabilities */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5 uppercase text-[10px] text-[#64748B]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{t('about.coreFeatures', 'Core Features')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <Binary className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featureMoTitle', 'GNU gettext PO & MO')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featureMoDesc', 'Full parser, formatter, and instantaneous browser-side binary .mo compiler.')}
                  </p>
                </div>
              </div>

              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featureMatrixTitle', 'Multi-Language Matrix')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featureMatrixDesc', 'Side-by-side editing across all locales with inline newline badges and smart shortcuts.')}
                  </p>
                </div>
              </div>

              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <GitBranch className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featureGitTitle', 'In-Memory Git DAG')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featureGitDesc', 'Isolated version control tracking commits, staging, file logs, and per-key diffs.')}
                  </p>
                </div>
              </div>

              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#EC4899] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featureTmTitle', 'Translation Memory (TM)')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featureTmDesc', 'Real-time Levenshtein similarity engine with batch auto-fill and fuzzy protection.')}
                  </p>
                </div>
              </div>

              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <FolderSync className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featureFolderTitle', 'Folder & Disk Sync')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featureFolderDesc', 'Seamless local folder scanner, automatic .mo emission, and one-click ZIP packaging.')}
                  </p>
                </div>
              </div>

              <div className="bg-[#090B0E] p-3 rounded-lg border border-[#2D3139] flex items-start gap-2.5">
                <Hash className="w-4 h-4 text-[#06B6D4] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-xs">{t('about.featurePluralTitle', 'Plural Forms Engine')}</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {t('about.featurePluralDesc', 'Interactive nplurals tester supporting Slavic, Germanic, Romance, and CJK plural rules.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specs Footer */}
          <div className="p-3 bg-[#090B0E] rounded-lg border border-[#2D3139] flex items-center justify-between text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <span>{t('about.engineName', 'OpenPO Localization Engine')}</span>
              <span>•</span>
              <span className="font-mono text-[#94A3B8]">v1.0.0</span>
            </div>
            <div className="flex items-center gap-1 text-[#38BDF8]">
              <Heart className="w-3 h-3 fill-current text-rose-400" />
              <span>{t('about.footerTagline', 'Created for fast game & app translations')}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-3.5 border-t border-[#2D3139] flex items-center justify-between bg-[#090B0E]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="px-3 py-1.5 rounded-lg bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] text-xs flex items-center gap-1.5 border border-[#2D3139] transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('settings.title', 'Preferences & Settings')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold shadow-md shadow-blue-500/10 transition-all cursor-pointer"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
