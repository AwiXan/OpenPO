import { PoEntry } from '../types/gettext';

export interface CategoryNode {
  id: string;
  name: string; // e.g. "Nav"
  fullPath: string; // e.g. "Ui / Nav"
  path: string[]; // ['Ui', 'Nav']
  level: number; // 0, 1, 2...
  children: CategoryNode[];
  entryIds: string[]; // All entries in this node and all descendant subtrees
  directEntryIds: string[]; // Only entries mapped directly to this node
  totalCount: number;
  untranslatedCount: number;
  fuzzyCount: number;
  issueCount: number;
}

export interface CategoryGroup {
  id: string;
  name: string; // fullPath
  path: string[];
  totalCount: number;
  untranslatedCount: number;
  fuzzyCount: number;
  issueCount: number;
  entryIds: string[];
}

export function parseCategoryPath(raw: string): string[] {
  if (!raw || !raw.trim()) return ['General'];
  const trimmed = raw.trim();
  if (trimmed.includes(' / ')) return trimmed.split(' / ').map(formatWord).filter(Boolean);
  if (trimmed.includes('/')) return trimmed.split('/').map(formatWord).filter(Boolean);
  if (trimmed.includes('::')) return trimmed.split('::').map(formatWord).filter(Boolean);
  if (trimmed.includes('.')) return trimmed.split('.').map(formatWord).filter(Boolean);
  return [formatWord(trimmed)];
}

export function normalizeCategoryPath(raw: string): string {
  return parseCategoryPath(raw).join(' / ');
}

/**
 * Parses key or entry metadata to extract a multi-level hierarchical category path
 */
export function deriveCategoryPath(entry: PoEntry, autoGenerate = true): string[] {
  // 1. If entry already has explicit category set
  if (entry.category && entry.category.trim()) {
    return parseCategoryPath(entry.category);
  }

  // 2. Extracted comments with Category:
  if (entry.extractedComments && entry.extractedComments.length > 0) {
    for (const ec of entry.extractedComments) {
      const match = ec.match(/^category:\s*(.+)$/i);
      if (match) {
        return parseCategoryPath(match[1]);
      }
    }
  }

  // 3. Comments with Category:
  if (entry.comments && entry.comments.length > 0) {
    for (const c of entry.comments) {
      const match = c.match(/^category:\s*(.+)$/i);
      if (match) {
        return parseCategoryPath(match[1]);
      }
    }
  }

  if (!autoGenerate) return ['General'];

  // 4. Context msgctxt path
  if (entry.msgctxt && entry.msgctxt.trim()) {
    const ctx = entry.msgctxt.trim();
    return parseCategoryPath(ctx);
  }

  const key = entry.msgid.trim();

  // 5. Dot notation (e.g. ui.settings.theme or auth.login.title)
  if (key.includes('.') && !key.includes(' ')) {
    const parts = key.split('.').filter(Boolean);
    if (parts.length >= 2) {
      // take up to 3 segments for nested hierarchy
      const segments = parts.length > 3 ? parts.slice(0, 3) : parts.slice(0, parts.length - 1);
      return segments.map(formatWord);
    }
  }

  // 6. Slash notation (e.g. ui/nav/menu)
  if (key.includes('/') && !key.includes(' ')) {
    const parts = key.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const segments = parts.length > 3 ? parts.slice(0, 3) : parts.slice(0, parts.length - 1);
      return segments.map(formatWord);
    }
  }

  // 7. SCREAMING_SNAKE_CASE prefixes (e.g. UI_SETTINGS_SECURITY_2FA, UI_NAV_HOME, AUTH_LOGIN_MODAL)
  if (/^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)+$/.test(key)) {
    const parts = key.split('_');
    if (parts.length >= 4) {

      return [formatWord(parts[0]), formatWord(parts[1]), formatWord(parts[2])];
    } else if (parts.length >= 3) {
      return [formatWord(parts[0]), formatWord(parts[1])];

    } else if (parts.length === 2 && parts[0].length >= 2) {
      return [formatWord(parts[0])];
    }
  }

  // 8. Check single snake prefix (e.g., CART_ITEMS_COUNT or PROD_CATALOG)
  const singleSnakeMatch = key.match(/^([a-zA-Z0-9]{2,})_/);
  if (singleSnakeMatch) {
    return [formatWord(singleSnakeMatch[1])];
  }

  // 9. Reference file path (e.g., src/components/nav/Navbar.tsx:18)
  if (entry.references && entry.references.length > 0) {
    const ref = entry.references[0].split(':')[0].replace(/\\/g, '/');
    const parts = ref.split('/').filter((p) => p !== 'src' && !p.endsWith('.ts') && !p.endsWith('.tsx') && !p.endsWith('.js'));
    if (parts.length >= 2) {
      return parts.slice(0, 3).map(formatWord);
    } else if (parts.length === 1) {
      return [formatWord(parts[0])];
    }
    const filename = ref.split('/').pop()?.replace(/\.[a-zA-Z0-9]+$/, '');
    if (filename && filename.length > 2) {
      return [`File: ${filename}`];
    }
  }

  return ['General'];
}

export function deriveCategory(entry: PoEntry, autoGenerate = true): string {
  const path = deriveCategoryPath(entry, autoGenerate);
  return path.join(' / ');
}

function formatWord(str: string): string {
  const clean = str.replace(/[-_]/g, ' ').trim();
  if (!clean) return 'General';
  // Common short acronyms in uppercase
  if (/^(ui|ux|api|url|id|pot|po|mo|tm|git|cli|sdk|css|html|js|ts)$/i.test(clean)) {
    return clean.toUpperCase();
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Builds a hierarchical recursive category tree from entries and optional custom categories
 */
export function buildCategoryTree(
  entries: PoEntry[],
  issuesMap: Map<string, number> = new Map(),
  customCategories: string[] = [],
  autoGenerate = true,
  isPotTemplate = false
): {
  tree: CategoryNode[];
  allGroups: CategoryGroup[];
  pathToEntryIdsMap: Map<string, string[]>;
} {
  // Temporary mutable node representation
  interface MutableNode {
    id: string;
    name: string;
    fullPath: string;
    path: string[];
    level: number;
    children: Map<string, MutableNode>;
    directEntryIds: string[];
    allEntryIds: Set<string>;
    totalCount: number;
    untranslatedCount: number;
    fuzzyCount: number;
    issueCount: number;
  }

  const rootChildren = new Map<string, MutableNode>();
  const flatGroupsMap = new Map<string, CategoryGroup>();

  // Helper to ensure path exists in tree
  const ensurePathNode = (path: string[]) => {
    let currentMap = rootChildren;
    const accumulatedPath: string[] = [];

    for (let level = 0; level < path.length; level++) {
      const segment = path[level];
      accumulatedPath.push(segment);
      const fullPath = accumulatedPath.join(' / ');

      let node = currentMap.get(segment);
      if (!node) {
        node = {
          id: `cat_${accumulatedPath.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: segment,
          fullPath,
          path: [...accumulatedPath],
          level,
          children: new Map(),
          directEntryIds: [],
          allEntryIds: new Set(),
          totalCount: 0,
          untranslatedCount: 0,
          fuzzyCount: 0,
          issueCount: 0,
        };
        currentMap.set(segment, node);
      }

      if (!flatGroupsMap.has(fullPath)) {
        flatGroupsMap.set(fullPath, {
          id: node.id,
          name: fullPath,
          path: [...accumulatedPath],
          totalCount: 0,
          untranslatedCount: 0,
          fuzzyCount: 0,
          issueCount: 0,
          entryIds: [],
        });
      }

      currentMap = node.children;
    }
  };

  // 1. Seed custom categories if any
  for (const cat of customCategories) {
    if (cat && cat.trim()) {
      const path = parseCategoryPath(cat);
      ensurePathNode(path);
    }
  }

  // 2. Add entries
  for (const entry of entries) {
    const path = deriveCategoryPath(entry, autoGenerate);
    const isUntranslated = !isPotTemplate && (entry.msgstr.length === 0 || entry.msgstr.every((s) => !s || s.trim() === ''));
    const isFuzzy = entry.flags.includes('fuzzy');
    const issueCount = issuesMap.get(entry.id) || 0;

    let currentMap = rootChildren;
    const accumulatedPath: string[] = [];

    for (let level = 0; level < path.length; level++) {
      const segment = path[level];
      accumulatedPath.push(segment);
      const fullPath = accumulatedPath.join(' / ');
      const isLeaf = level === path.length - 1;

      let node = currentMap.get(segment);
      if (!node) {
        node = {
          id: `cat_${accumulatedPath.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: segment,
          fullPath,
          path: [...accumulatedPath],
          level,
          children: new Map(),
          directEntryIds: [],
          allEntryIds: new Set(),
          totalCount: 0,
          untranslatedCount: 0,
          fuzzyCount: 0,
          issueCount: 0,
        };
        currentMap.set(segment, node);
      }

      // Aggregate statistics down the branch
      node.allEntryIds.add(entry.id);
      node.totalCount += 1;
      if (isUntranslated) node.untranslatedCount += 1;
      if (isFuzzy) node.fuzzyCount += 1;
      node.issueCount += issueCount;

      if (isLeaf) {
        node.directEntryIds.push(entry.id);

        // Record in flat groups
        if (!flatGroupsMap.has(fullPath)) {
          flatGroupsMap.set(fullPath, {
            id: node.id,
            name: fullPath,
            path: [...accumulatedPath],
            totalCount: 0,
            untranslatedCount: 0,
            fuzzyCount: 0,
            issueCount: 0,
            entryIds: [],
          });
        }
        const group = flatGroupsMap.get(fullPath)!;
        group.totalCount += 1;
        if (isUntranslated) group.untranslatedCount += 1;
        if (isFuzzy) group.fuzzyCount += 1;
        group.issueCount += issueCount;
        group.entryIds.push(entry.id);
      }

      currentMap = node.children;
    }
  }

  const getCustomOrder = (fullPath: string) => {
    const idx = customCategories.indexOf(fullPath);
    return idx === -1 ? 999999 : idx;
  };

  // Convert mutable tree to immutable CategoryNode array
  function convertNode(mutable: MutableNode): CategoryNode {
    const children = Array.from(mutable.children.values())
      .map(convertNode)
      .sort((a, b) => {
        if (a.name === 'General') return 1;
        if (b.name === 'General') return -1;
        const orderA = getCustomOrder(a.fullPath);
        const orderB = getCustomOrder(b.fullPath);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

    return {
      id: mutable.id,
      name: mutable.name,
      fullPath: mutable.fullPath,
      path: mutable.path,
      level: mutable.level,
      children,
      entryIds: Array.from(mutable.allEntryIds),
      directEntryIds: mutable.directEntryIds,
      totalCount: mutable.totalCount,
      untranslatedCount: mutable.untranslatedCount,
      fuzzyCount: mutable.fuzzyCount,
      issueCount: mutable.issueCount,
    };
  }

  const tree = Array.from(rootChildren.values())
    .map(convertNode)
    .sort((a, b) => {
      if (a.name === 'General') return 1;
      if (b.name === 'General') return -1;
      const orderA = getCustomOrder(a.fullPath);
      const orderB = getCustomOrder(b.fullPath);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const allGroups = Array.from(flatGroupsMap.values()).sort((a, b) => {
    if (a.name === 'General') return 1;
    if (b.name === 'General') return -1;
    return a.name.localeCompare(b.name);
  });

  const pathToEntryIdsMap = new Map<string, string[]>();
  function registerPaths(nodes: CategoryNode[]) {
    for (const node of nodes) {
      pathToEntryIdsMap.set(node.fullPath, node.entryIds);
      if (node.children.length > 0) {
        registerPaths(node.children);
      }
    }
  }
  registerPaths(tree);

  return { tree, allGroups, pathToEntryIdsMap };
}

/**
 * Backward-compatible helper for existing code
 */
export function groupEntriesByCategory(
  entries: PoEntry[],
  issuesMap: Map<string, number> = new Map()
): CategoryGroup[] {
  const { allGroups } = buildCategoryTree(entries, issuesMap);
  return allGroups;
}
