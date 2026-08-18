import React, { useState } from 'react';
import { Binary, Download, ShieldCheck, FileArchive } from 'lucide-react';
import { Workspace, PoFileRecord } from '../types/gettext';
import { compileMoBinary } from '../lib/moCompiler';
import { Modal } from './ui/Modal';
import { useTranslation } from '../lib/i18n';

interface MoCompilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

export const MoCompilerModal: React.FC<MoCompilerModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const { t } = useTranslation();
  const [selectedPoId, setSelectedPoId] = useState<string>(
    workspace.poFiles[0]?.id || ''
  );

  const selectedPo = workspace.poFiles.find((p) => p.id === selectedPoId) || workspace.poFiles[0];

  const handleDownloadMo = (po: PoFileRecord) => {
    const binary = compileMoBinary(po.header, po.entries);
    const moFilename = po.filename.replace(/\.po$/, '.mo');
    const blob = new Blob([binary], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = moFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllMo = () => {
    workspace.poFiles.forEach((po) => {
      handleDownloadMo(po);
    });
  };

  const modalFooter = (
    <div className="w-full flex items-center justify-between">
      <button
        onClick={onClose}
        className="px-3.5 py-1.5 rounded bg-[#1C2128] hover:bg-[#2D3748] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#2D3139] cursor-pointer transition-colors"
      >
        {t('common.close')}
      </button>

      <button
        onClick={handleDownloadAllMo}
        className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-colors"
      >
        <FileArchive className="w-3.5 h-3.5" />
        <span>{t('moCompiler.downloadAll')}</span>
      </button>
    </div>
  );

  const binaryData = selectedPo ? compileMoBinary(selectedPo.header, selectedPo.entries) : new Uint8Array();

  const hexPreview: string[] = [];
  for (let i = 0; i < Math.min(binaryData.length, 96); i += 16) {
    const chunk = Array.from(binaryData.slice(i, i + 16));
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = i.toString(16).padStart(4, '0');
    hexPreview.push(`${offset}  ${hex.padEnd(48, ' ')}  |${ascii}|`);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('moCompiler.title')}
      subtitle={t('moCompiler.subtitle')}
      icon={<Binary className="w-4 h-4" />}
      maxWidth="max-w-2xl"
      footer={modalFooter}
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {workspace.poFiles.map((po) => {
            const isSel = po.id === selectedPo?.id;
            const bin = compileMoBinary(po.header, po.entries);

            return (
              <button
                key={po.id}
                onClick={() => setSelectedPoId(po.id)}
                className={`px-3 py-2 rounded text-left transition-all border flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSel
                    ? 'bg-[#1E293B] border-[#3B82F6] text-white shadow-xs'
                    : 'bg-[#090B0E] border-[#2D3139] text-[#94A3B8] hover:bg-[#1C2128]'
                }`}
              >
                <span className="font-mono uppercase font-bold text-[#3B82F6]">{po.language}</span>
                <span className="text-[11px] font-sans">{po.languageName}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#090B0E] font-mono text-[#64748B] border border-[#2D3139]">
                  {bin.length} B
                </span>
              </button>
            );
          })}
        </div>

        {selectedPo && (
          <div className="bg-[#090B0E] rounded-lg p-4 border border-[#2D3139] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">
                  {selectedPo.filename.replace(/\.po$/, '.mo')}
                </div>
                <div className="text-[11px] text-[#94A3B8] font-mono">
                  Target: {selectedPo.languageName} ({selectedPo.language})
                </div>
              </div>

              <button
                onClick={() => handleDownloadMo(selectedPo)}
                className="px-3 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('moCompiler.download')}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2D3139] text-[#E2E8F0]">
              <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139]">
                <div className="text-[10px] text-[#64748B] uppercase font-mono">{t('moCompiler.magic')}</div>
                <div className="font-mono text-[#4ADE80] font-bold">0x950412de (OK)</div>
              </div>

              <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139]">
                <div className="text-[10px] text-[#64748B] uppercase font-mono">{t('moCompiler.size')}</div>
                <div className="font-mono text-[#E2E8F0] font-bold">{binaryData.length} bytes</div>
              </div>

              <div className="bg-[#16191E] p-2.5 rounded border border-[#2D3139]">
                <div className="text-[10px] text-[#64748B] uppercase font-mono">{t('moCompiler.strings')}</div>
                <div className="font-mono text-[#E2E8F0] font-bold">
                  {selectedPo.entries.length + 1} pairs
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">
                {t('moCompiler.inspector')}
              </div>
              <pre className="bg-[#16191E] p-2.5 rounded text-[10px] font-mono text-[#94A3B8] overflow-x-auto leading-relaxed border border-[#2D3139] select-text">
                {hexPreview.join('\n')}
              </pre>
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-[#1C2128] border border-[#2D3139] text-[11px] text-[#94A3B8] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
          <div>{t('moCompiler.notice')}</div>
        </div>
      </div>
    </Modal>
  );
};