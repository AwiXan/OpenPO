import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Layers,
  FileQuestion,
  Clock,
  AlertTriangle,
  Hash,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronsDown,
  ChevronsUp,
  Tag,
  Sparkles,
  GripHorizontal,
  Plus,
  Check,
  MoreVertical,
} from 'lucide-react';
import { CategoryNode } from '../lib/categorizer';
import { FilterStatus } from '../types/gettext';
import { useTranslation } from '../lib/i18n';

interface SidebarCategoriesProps {
  categoryTree: CategoryNode[];
  selectedCategory: string | null; // null = all, or "Ui", "Ui / Nav"
  onSelectCategory: (categoryFullPath: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  stats: {
    total: number;
    translated: number;
    untranslated: number;
    fuzzy: number;
    issues: number;
    plurals: number;
  };
  onAddCategory?: (categoryPath: string) => void;
  onAssignActiveEntryToCategory?: (categoryFullPath: string) => void;
  activeEntryId?: string | null;
}

export const SidebarCategories: React.FC<SidebarCategoriesProps> = ({
  categoryTree,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  stats,
  onAddCategory,
  onAssignActiveEntryToCategory,
  activeEntryId,
}) => {
  const { t } = useTranslation();

  // Vertical split height for status filters vs nested categories
  const [statusFiltersHeight, setStatusFiltersHeight] = useState<number>(205);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // New Category Prompt State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryPath, setNewCategoryPath] = useState('');
  const [parentPathForNewCategory, setParentPathForNewCategory] = useState<string | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit) return;
      // Find top offset of sidebar
      const sidebarEl = document.getElementById('openpot-sidebar-container');
      if (!sidebarEl) return;
      const rect = sidebarEl.getBoundingClientRect();
      const relativeY = e.clientY - rect.top - 48; // offset search bar
      const clampedHeight = Math.max(90, Math.min(420, relativeY));
      setStatusFiltersHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    if (isDraggingSplit) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSplit]);

  // State for expanded folder paths
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const set = new Set<string>();
    // Default expand root nodes and level 1 nodes
    function addExpanded(nodes: CategoryNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          set.add(node.fullPath);
          addExpanded(node.children);
        }
      }
    }
    addExpanded(categoryTree);
    return set;
  });

  const [categoryFilterText] = useState('');

  const toggleExpand = (fullPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
      } else {
        next.add(fullPath);
      }
      return next;
    });
  };

  const expandAll = () => {
    const set = new Set<string>();
    function addAll(nodes: CategoryNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) {
          set.add(n.fullPath);
          addAll(n.children);
        }
      }
    }
    addAll(categoryTree);
    setExpandedPaths(set);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  // Filter tree nodes if user types in category filter
  const filteredTree = useMemo(() => {
    if (!categoryFilterText.trim()) return categoryTree;
    const q = categoryFilterText.toLowerCase();

    function filterNodes(nodes: CategoryNode[]): CategoryNode[] {
      const result: CategoryNode[] = [];
      for (const node of nodes) {
        const matchesSelf =
          node.name.toLowerCase().includes(q) || node.fullPath.toLowerCase().includes(q);
        const filteredChildren = filterNodes(node.children);

        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
      return result;
    }

    return filterNodes(categoryTree);
  }, [categoryTree, categoryFilterText]);

  // Render individual tree node recursively
  const renderTreeNode = (
    node: CategoryNode,
    isLastChild: boolean,
    ancestorIsLast: boolean[] = []
  ) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedPaths.has(node.fullPath);
    const isSelected = selectedCategory === node.fullPath;
    const isAncestorOfSelected =
      selectedCategory !== null &&
      selectedCategory !== node.fullPath &&
      selectedCategory.startsWith(node.fullPath + ' / ');

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          onClick={() => onSelectCategory(isSelected ? null : node.fullPath)}
          className={`group flex items-center justify-between py-1 px-2 rounded-md text-xs cursor-pointer transition-all ${
            isSelected
              ? 'bg-[#1E293B] text-white font-semibold border-l-2 border-[#3B82F6] pl-2 shadow-xs'
              : isAncestorOfSelected
              ? 'bg-[#161F2E]/60 text-[#38BDF8] hover:bg-[#1C2128]'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
          style={{ paddingLeft: `${node.level * 14 + 6}px` }}
        >
          {/* Left Branch & Label Section */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {/* Tree Branch Guide Line for nested nodes */}
            {node.level > 0 && (
              <span className="text-[#475569] font-mono text-[11px] select-none shrink-0 opacity-70">
                {isLastChild ? '└─' : '├─'}
              </span>
            )}

            {/* Expand / Collapse Chevron */}
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.fullPath, e)}
                className="p-0.5 hover:bg-[#2D3139] rounded text-[#64748B] hover:text-[#E2E8F0] transition-colors shrink-0"
                title={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <span className="w-3 h-3 shrink-0 flex items-center justify-center text-[#475569]">
                <Tag className="w-2.5 h-2.5 opacity-50" />
              </span>
            )}

            {/* Icon */}
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="w-3 h-3 text-[#38BDF8] shrink-0" />
              ) : (
                <Folder className="w-3 h-3 text-[#F59E0B] shrink-0" />
              )
            ) : null}

            {/* Node Name */}
            <span
              className={`truncate font-mono text-[11px] ${
                isSelected ? 'text-[#E2E8F0]' : ''
              }`}
              title={node.fullPath}
            >
              {node.name}
            </span>
          </div>

          {/* Quick Node Actions on hover & Stats */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Quick Add Subcategory Action */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setParentPathForNewCategory(node.fullPath);
                setNewCategoryPath(`${node.fullPath} / `);
                setIsAddingCategory(true);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#2D3748] rounded text-[#64748B] hover:text-[#38BDF8] transition-opacity"
              title={`${t('category.addSubcategory')}: ${node.fullPath}`}
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* Quick Assign active string to this category */}
            {activeEntryId && onAssignActiveEntryToCategory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignActiveEntryToCategory(node.fullPath);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#2D3748] rounded text-[#64748B] hover:text-[#4ADE80] transition-opacity"
                title={`${t('category.assignToCategory')}: ${node.fullPath}`}
              >
                <Check className="w-3 h-3" />
              </button>
            )}

            {node.issueCount > 0 && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-[#EF44441A] text-rose-400 font-mono border border-[#EF444433]"
                title={`${node.issueCount} validation issues`}
              >
                !{node.issueCount}
              </span>
            )}

            {node.untranslatedCount > 0 && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-[#EF44441A] text-[#EF4444] font-mono border border-[#EF444433]"
                title={`${node.untranslatedCount} untranslated strings`}
              >
                {node.untranslatedCount}
              </span>
            )}

            {node.fuzzyCount > 0 && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-[#F59E0B1A] text-[#F59E0B] font-mono border border-[#F59E0B33]"
                title={`${node.fuzzyCount} fuzzy strings`}
              >
                ~{node.fuzzyCount}
              </span>
            )}

            <span
              className={`text-[10px] font-mono px-1 rounded ${
                isSelected ? 'text-[#38BDF8] font-bold' : 'text-[#64748B]'
              }`}
            >
              {node.totalCount}
            </span>
          </div>
        </div>

        {/* Recursive Children with Tree Structure */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col relative">
            {node.children.map((child, idx) =>
              renderTreeNode(
                child,
                idx === node.children.length - 1,
                [...ancestorIsLast, isLastChild]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id="openpot-sidebar-container"
      className="w-full border-r border-[#2D3139] bg-[#16191E] flex flex-col h-full select-none text-[#E2E8F0] overflow-hidden relative"
    >
      {/* 1. Global Message ID & String Search Bar */}
      <div className="p-2.5 border-b border-[#2D3139] bg-[#16191E] shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
          <input
            id="input-sidebar-search"
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-6 py-1.5 bg-[#090B0E] border border-[#2D3139] rounded text-xs text-[#E2E8F0] placeholder-[#64748B] outline-none focus:border-[#3B82F6] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-[11px] text-[#64748B] hover:text-[#E2E8F0] font-mono cursor-pointer"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 2. Quick Status Filters (Resizable Vertical Section) */}
      <div
        style={{ height: `${statusFiltersHeight}px`, minHeight: '90px' }}
        className="p-2.5 overflow-y-auto space-y-1 bg-[#16191E] shrink-0 custom-scrollbar"
      >
        <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1 px-1">
          <span>{t('sidebar.statusFilters')}</span>
          {filterStatus !== 'all' && (
            <button
              onClick={() => onFilterStatusChange('all')}
              className="text-[#38BDF8] hover:underline cursor-pointer lowercase text-[10px] font-normal"
            >
              {t('sidebar.clear')}
            </button>
          )}
        </div>

        <button
          onClick={() => onFilterStatusChange('all')}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
            filterStatus === 'all'
              ? 'bg-[#2D3748] text-white font-medium shadow-xs'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>{t('sidebar.allStrings')}</span>
          </div>
          <span className="text-[10px] font-mono text-[#64748B]">{stats.total}</span>
        </button>

        <button
          onClick={() => onFilterStatusChange('untranslated')}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
            filterStatus === 'untranslated'
              ? 'bg-[#2D3748] text-white font-medium shadow-xs'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileQuestion className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>{t('sidebar.untranslated')}</span>
          </div>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              stats.untranslated > 0 ? 'bg-[#EF44441A] text-[#EF4444]' : 'text-[#64748B]'
            }`}
          >
            {stats.untranslated}
          </span>
        </button>

        <button
          onClick={() => onFilterStatusChange('fuzzy')}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
            filterStatus === 'fuzzy'
              ? 'bg-[#2D3748] text-white font-medium shadow-xs'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>{t('sidebar.fuzzy')}</span>
          </div>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              stats.fuzzy > 0 ? 'bg-[#F59E0B1A] text-[#F59E0B]' : 'text-[#64748B]'
            }`}
          >
            {stats.fuzzy}
          </span>
        </button>

        <button
          onClick={() => onFilterStatusChange('issues')}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
            filterStatus === 'issues'
              ? 'bg-[#2D3748] text-white font-medium shadow-xs'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>{t('sidebar.linterIssues')}</span>
          </div>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              stats.issues > 0 ? 'bg-[#EF44441A] text-rose-400' : 'text-[#64748B]'
            }`}
          >
            {stats.issues}
          </span>
        </button>

        <button
          onClick={() => onFilterStatusChange('plurals')}
          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
            filterStatus === 'plurals'
              ? 'bg-[#2D3748] text-white font-medium shadow-xs'
              : 'text-[#94A3B8] hover:bg-[#1C2128] hover:text-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span>{t('sidebar.pluralForms')}</span>
          </div>
          <span className="text-[10px] font-mono text-[#64748B]">{stats.plurals}</span>
        </button>
      </div>

      {/* Resizer Split between Status Filters & Nested Categories */}
      <div
        onMouseDown={() => setIsDraggingSplit(true)}
        onDoubleClick={() => setStatusFiltersHeight(205)}
        className={`h-1.5 hover:h-2 bg-[#2D3139] hover:bg-[#3B82F6] cursor-row-resize transition-all z-10 flex items-center justify-center shrink-0 select-none group ${
          isDraggingSplit ? 'bg-[#3B82F6] !h-2 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''
        }`}
        title={t('sidebar.dragResize')}
      >
        <GripHorizontal className="w-4 h-2.5 text-[#64748B] group-hover:text-white opacity-70 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* 3. Nested Hierarchical Categories Header */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between shrink-0 bg-[#16191E]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
            {t('sidebar.nestedCategories')}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[#090B0E] border border-[#2D3139] text-[#38BDF8] text-[9px] font-mono">
            {categoryTree.length} {t('sidebar.roots')}
          </span>
        </div>

        {/* Tree controls: Add Category, Expand All / Collapse All & Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setParentPathForNewCategory(null);
              setNewCategoryPath('');
              setIsAddingCategory((prev) => !prev);
            }}
            className="p-1 rounded text-[#38BDF8] hover:text-white hover:bg-[#3B82F6] transition-colors"
            title={t('category.createCategory')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={expandAll}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#2D3139] transition-colors"
            title={t('sidebar.expandAll')}
          >
            <ChevronsDown className="w-3 h-3" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#2D3139] transition-colors"
            title={t('sidebar.collapseAll')}
          >
            <ChevronsUp className="w-3 h-3" />
          </button>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-[10px] text-[#3B82F6] hover:underline cursor-pointer ml-1 font-mono"
            >
              {t('sidebar.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Inline New Category Input Box */}
      {isAddingCategory && (
        <div className="px-2.5 py-2 bg-[#090B0E] border-b border-[#2D3139] shrink-0">
          <div className="text-[10px] font-semibold text-[#E2E8F0] mb-1 flex items-center gap-1">
            <FolderPlus className="w-3 h-3 text-[#F59E0B]" />
            <span>
              {parentPathForNewCategory
                ? `${t('category.addSubcategory')}: ${parentPathForNewCategory}`
                : t('category.createTitle')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newCategoryPath}
              onChange={(e) => setNewCategoryPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryPath.trim()) {
                  if (onAddCategory) onAddCategory(newCategoryPath.trim());
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                } else if (e.key === 'Escape') {
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                }
              }}
              placeholder={t('category.categoryPlaceholder')}
              className="flex-1 bg-[#16191E] border border-[#3B82F6] rounded px-2 py-1 text-xs font-mono text-[#38BDF8] placeholder-[#64748B] outline-none"
            />
            <button
              onClick={() => {
                if (newCategoryPath.trim()) {
                  if (onAddCategory) onAddCategory(newCategoryPath.trim());
                  setIsAddingCategory(false);
                  setNewCategoryPath('');
                }
              }}
              className="px-2.5 py-1 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-medium cursor-pointer shrink-0"
            >
              {t('common.save')}
            </button>
            <button
              onClick={() => {
                setIsAddingCategory(false);
                setNewCategoryPath('');
              }}
              className="px-2 py-1 rounded bg-[#1C2128] hover:bg-[#2D3139] text-[#94A3B8] text-[11px] cursor-pointer shrink-0"
            >
              {t('common.cancel')}
            </button>
          </div>
          <p className="text-[9px] text-[#64748B] mt-1">{t('category.categoryHelp')}</p>
        </div>
      )}

      {/* Breadcrumb if a deep category is active */}
      {selectedCategory && (
        <div className="px-3 py-1 bg-[#090B0E] border-y border-[#2D3139] flex items-center justify-between text-[10px] text-[#38BDF8] font-mono shrink-0">
          <span className="truncate" title={selectedCategory}>
            📁 {selectedCategory}
          </span>
          <button
            onClick={() => onSelectCategory(null)}
            className="text-[#64748B] hover:text-white ml-2 text-xs"
            title="Remove category filter"
          >
            ×
          </button>
        </div>
      )}

      {/* Category Tree Nodes List (Flex-1 overflow) */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 custom-scrollbar">
        {filteredTree.map((rootNode, idx) =>
          renderTreeNode(rootNode, idx === filteredTree.length - 1)
        )}

        {filteredTree.length === 0 && (
          <div className="text-center py-6 text-[#64748B] text-xs">
            {t('sidebar.noMatchingCategories')}
          </div>
        )}
      </div>
    </aside>
  );
};
