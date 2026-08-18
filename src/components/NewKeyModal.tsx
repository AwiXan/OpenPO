import React, { useState } from 'react';
import { Plus, Folder } from 'lucide-react';
import { PoEntry } from '../types/gettext';
import { generateEntryId } from '../lib/poParser';
import { useTranslation } from '../lib/i18n';
import { Modal } from './ui/Modal';

interface NewKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddKey: (entry: PoEntry) => void;
  availableCategories?: string[];
  defaultCategory?: string;
}

export const NewKeyModal: React.FC<NewKeyModalProps> = ({
  isOpen,
  onClose,
  onAddKey,
  availableCategories = [],
  defaultCategory = '',
}) => {
  const { t } = useTranslation();

  const [msgid, setMsgid] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [hasPlural, setHasPlural] = useState(false);
  const [msgidPlural, setMsgidPlural] = useState('');
  const [msgctxt, setMsgctxt] = useState('');
  const [comments, setComments] = useState('');
  const [references, setReferences] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgid.trim()) return;

    const newEntry: PoEntry = {
      id: generateEntryId(),
      msgid: msgid.trim(),
      category: category.trim() ? category.trim() : undefined,
      msgidPlural: hasPlural && msgidPlural.trim() ? msgidPlural.trim() : undefined,
      msgctxt: msgctxt.trim() ? msgctxt.trim() : undefined,
      msgstr: hasPlural ? ['', ''] : [''],
      comments: comments ? comments.split('\n').filter((c) => c.trim() !== '') : [],
      extractedComments: category.trim() ? [`Category: ${category.trim()}`] : [],
      references: references ? references.split(',').map((r) => r.trim()).filter(Boolean) : ['src/manual_entry.tsx:1'],
      flags: [],
    };

    onAddKey(newEntry);
    onClose();
    
    setMsgid('');
    setCategory('');
    setHasPlural(false);
    setMsgidPlural('');
    setMsgctxt('');
    setComments('');
    setReferences('');
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
        form="new-key-form"
        className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t('newKey.submit')}</span>
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('newKey.title')}
      subtitle={t('newKey.desc')}
      icon={<Plus className="w-4 h-4" />}
      maxWidth="max-w-lg"
      footer={modalFooter}
    >
      <form id="new-key-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-[#E2E8F0] font-medium mb-1">
            {t('newKey.sourceLabel')}
          </label>
          <textarea
            required
            rows={2}
            value={msgid}
            onChange={(e) => setMsgid(e.target.value)}
            placeholder={t('newKey.sourcePlaceholder')}
            className="w-full bg-[#090B0E] border border-[#2D3139] rounded p-2.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-[#94A3B8] font-medium mb-1 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>{t('newKey.categoryLabel')}</span>
          </label>
          <input
            type="text"
            list="newkey-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('newKey.categoryPlaceholder')}
            className="w-full bg-[#090B0E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#38BDF8] placeholder-[#64748B] focus:border-[#3B82F6] outline-none"
          />
          <datalist id="newkey-category-suggestions">
            {availableCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-[10px] text-[#64748B] mt-1">{t('category.categoryHelp')}</p>
        </div>

        <div className="bg-[#090B0E] p-3 rounded border border-[#2D3139] space-y-2">
          <label className="flex items-center gap-2 cursor-pointer w-max">
            <input
              type="checkbox"
              checked={hasPlural}
              onChange={(e) => setHasPlural(e.target.checked)}
              className="rounded bg-[#16191E] border-[#2D3139] text-[#3B82F6] focus:ring-0"
            />
            <span className="font-medium text-[#E2E8F0]">{t('newKey.hasPlural')}</span>
          </label>

          {hasPlural && (
            <div className="pt-2 border-t border-[#2D3139]">
              <label className="block text-[#94A3B8] text-[11px] mb-1">{t('newKey.pluralLabel')}</label>
              <input
                type="text"
                value={msgidPlural}
                onChange={(e) => setMsgidPlural(e.target.value)}
                placeholder={t('newKey.pluralPlaceholder')}
                className="w-full bg-[#16191E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[#94A3B8] font-medium mb-1">{t('newKey.contextLabel')}</label>
            <input
              type="text"
              value={msgctxt}
              onChange={(e) => setMsgctxt(e.target.value)}
              placeholder={t('newKey.contextPlaceholder')}
              className="w-full bg-[#090B0E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none"
            />
          </div>
          <div>
            <label className="block text-[#94A3B8] font-medium mb-1">{t('newKey.refLabel')}</label>
            <input
              type="text"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              placeholder="src/components/Header.tsx:42"
              className="w-full bg-[#090B0E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#94A3B8] font-medium mb-1">{t('newKey.commentsLabel')}</label>
          <input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t('newKey.commentsPlaceholder')}
            className="w-full bg-[#090B0E] border border-[#2D3139] rounded px-2.5 py-1.5 text-xs text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] outline-none"
          />
        </div>
      </form>
    </Modal>
  );
};