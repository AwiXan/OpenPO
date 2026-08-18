import {
  Workspace,
  WorkspaceGitState,
  GitCommit,
  GitFileStatus,
  PotFileRecord,
  PoFileRecord,
  PoEntry,
} from '../types/gettext';

/**
 * Generates pseudo-random 7-char Git commit hash
 */
export function generateCommitHash(): { short: string; full: string } {
  const chars = '0123456789abcdef';
  let full = '';
  for (let i = 0; i < 40; i++) {
    full += chars[Math.floor(Math.random() * chars.length)];
  }
  return {
    short: full.slice(0, 7),
    full,
  };
}

/**
 * Creates deep clone of POT & PO records for immutable snapshots
 */
export function cloneSnapshot(pot: PotFileRecord, pos: PoFileRecord[]) {
  return {
    potFile: JSON.parse(JSON.stringify(pot)) as PotFileRecord,
    poFiles: JSON.parse(JSON.stringify(pos)) as PoFileRecord[],
  };
}

/**
 * Compares two lists of PoEntries to calculate diff summary
 */
const getEntryKey = (e: PoEntry) => `${e.msgctxt || ''}\x04${e.msgid}`;

export function compareEntries(
  oldEntries: PoEntry[] = [],
  newEntries: PoEntry[] = []
): { additions: number; deletions: number; modifications: number; isDifferent: boolean } {
  const oldMap = new Map<string, PoEntry>(oldEntries.map((e) => [getEntryKey(e), e]));
  const newMap = new Map<string, PoEntry>(newEntries.map((e) => [getEntryKey(e), e]));

  let additions = 0;
  let deletions = 0;
  let modifications = 0;

  newMap.forEach((newEntry, key) => {
    const oldEntry = oldMap.get(key);
    if (!oldEntry) {
      additions++;
    } else {
      const msgstrChanged = JSON.stringify(oldEntry.msgstr) !== JSON.stringify(newEntry.msgstr);
      const msgidPluralChanged = oldEntry.msgidPlural !== newEntry.msgidPlural;
      const flagsChanged = JSON.stringify(oldEntry.flags?.slice().sort()) !== JSON.stringify(newEntry.flags?.slice().sort());
      const commentsChanged = JSON.stringify(oldEntry.comments) !== JSON.stringify(newEntry.comments);

      if (msgstrChanged || msgidPluralChanged || flagsChanged || commentsChanged) {
        modifications++;
      }
    }
  });

  oldMap.forEach((_, key) => {
    if (!newMap.has(key)) {
      deletions++;
    }
  });

  return { additions, deletions, modifications, isDifferent: additions > 0 || deletions > 0 || modifications > 0 };
}

/**
 * Initializes a Git repository for a workspace with an initial commit
 */
export function initGitRepository(
  workspace: Workspace,
  initialMessage = 'Initial localization catalogue commit',
  author = 'Translator',
  authorEmail = 'translator@example.com'
): WorkspaceGitState {
  const hashes = generateCommitHash();
  const snapshot = cloneSnapshot(workspace.potFile, workspace.poFiles);

  const initialFilesChanged = [
    {
      filename: workspace.potFile.filename,
      fileId: workspace.potFile.id,
      status: 'added' as const,
      additions: workspace.potFile.entries.length,
      deletions: 0,
    },
    ...workspace.poFiles.map((po) => ({
      filename: po.filename,
      fileId: po.id,
      status: 'added' as const,
      additions: po.entries.length,
      deletions: 0,
    })),
  ];

  const initialCommit: GitCommit = {
    id: hashes.short,
    fullHash: hashes.full,
    message: initialMessage,
    author,
    authorEmail,
    timestamp: new Date().toISOString(),
    filesChanged: initialFilesChanged,
    snapshot,
  };

  return {
    isInitialized: true,
    branch: 'main',
    stagedFiles: [],
    commits: [initialCommit],
  };
}

/**
 * Computes the Git working tree status for all files against HEAD commit
 */
export function computeWorkspaceGitStatus(workspace: Workspace): GitFileStatus[] {
  if (!workspace.git?.isInitialized || workspace.git.commits.length === 0) {
    return [
      {
        filename: workspace.potFile.filename,
        fileId: workspace.potFile.id,
        type: 'pot',
        status: 'unmodified',
        isStaged: false,
        entriesCount: workspace.potFile.entries.length,
      },
      ...workspace.poFiles.map((po) => ({
        filename: po.filename,
        fileId: po.id,
        type: 'po' as const,
        language: po.language,
        languageName: po.languageName,
        status: 'unmodified' as const,
        isStaged: false,
        entriesCount: po.entries.length,
      })),
    ];
  }

  const headCommit = workspace.git.commits[0];
  const headPot = headCommit.snapshot.potFile;
  const headPos = headCommit.snapshot.poFiles;
  const staged = new Set(workspace.git.stagedFiles || []);

  const results: GitFileStatus[] = [];

  const potDiff = compareEntries(headPot?.entries || [], workspace.potFile.entries);
  results.push({
    filename: workspace.potFile.filename,
    fileId: workspace.potFile.id,
    type: 'pot',
    status: !headPot ? 'untracked' : potDiff.isDifferent ? ('modified' as const) : ('unmodified' as const),
    isStaged: staged.has(workspace.potFile.filename),
    entriesCount: workspace.potFile.entries.length,
    diffSummary: potDiff,
  });

  headPos?.forEach((headPo) => {
    const exists = workspace.poFiles.some((p) => p.filename === headPo.filename || p.id === headPo.id);
    if (!exists) {
      results.push({
        filename: headPo.filename,
        fileId: headPo.id,
        type: 'po',
        language: headPo.language,
        languageName: headPo.languageName,
        status: 'deleted',
        isStaged: staged.has(headPo.filename),
        entriesCount: headPo.entries.length,
        diffSummary: { additions: 0, deletions: headPo.entries.length, modifications: 0, isDifferent: true },
      });
    }
  });

  return results;
}

/**
 * Stages a single file by filename
 */
export function stageGitFile(workspace: Workspace, filename: string): Workspace {
  if (!workspace.git) return workspace;
  const staged = new Set(workspace.git.stagedFiles);
  staged.add(filename);

  return {
    ...workspace,
    git: {
      ...workspace.git,
      stagedFiles: Array.from(staged),
    },
  };
}

/**
 * Unstages a single file by filename
 */
export function unstageGitFile(workspace: Workspace, filename: string): Workspace {
  if (!workspace.git) return workspace;
  const staged = workspace.git.stagedFiles.filter((f) => f !== filename);

  return {
    ...workspace,
    git: {
      ...workspace.git,
      stagedFiles: staged,
    },
  };
}

/**
 * Stages all modified and untracked files
 */
export function stageAllGitFiles(workspace: Workspace): Workspace {
  if (!workspace.git) return workspace;
  const allFiles = [workspace.potFile.filename, ...workspace.poFiles.map((p) => p.filename)];

  return {
    ...workspace,
    git: {
      ...workspace.git,
      stagedFiles: allFiles,
    },
  };
}

/**
 * Unstages all files
 */
export function unstageAllGitFiles(workspace: Workspace): Workspace {
  if (!workspace.git) return workspace;
  return {
    ...workspace,
    git: {
      ...workspace.git,
      stagedFiles: [],
    },
  };
}

/**
 * Commits staged changes with a commit message
 */
export function commitStagedChanges(
  workspace: Workspace,
  message: string,
  author: string,
  authorEmail: string
): Workspace {
  if (!workspace.git || workspace.git.stagedFiles.length === 0) return workspace;

  const stagedSet = new Set(workspace.git.stagedFiles);
  const headCommit = workspace.git.commits[0];
  const hashes = generateCommitHash();
  const filesChanged: GitCommit['filesChanged'] = [];

  const basePot = headCommit ? headCommit.snapshot.potFile : workspace.potFile;
  const basePos = headCommit ? headCommit.snapshot.poFiles : workspace.poFiles;

  const newPot = stagedSet.has(workspace.potFile.filename)
    ? JSON.parse(JSON.stringify(workspace.potFile))
    : JSON.parse(JSON.stringify(basePot));

  const newPos = basePos.map((basePo) => {
    if (stagedSet.has(basePo.filename)) {
      const current = workspace.poFiles.find((p) => p.filename === basePo.filename);
      return current ? JSON.parse(JSON.stringify(current)) : basePo;
    }
    return JSON.parse(JSON.stringify(basePo));
  });

  workspace.poFiles.forEach((po) => {
    if (stagedSet.has(po.filename) && !newPos.some((p) => p.filename === po.filename)) {
      newPos.push(JSON.parse(JSON.stringify(po)));
    }
  });

  const newSnapshot = { potFile: newPot, poFiles: newPos };

  const newCommit: GitCommit = {
    id: hashes.short,
    fullHash: hashes.full,
    message: message.trim() || 'Update localization strings',
    author: author.trim() || 'Translator',
    authorEmail: authorEmail.trim() || 'translator@example.com',
    timestamp: new Date().toISOString(),
    filesChanged,
    snapshot: newSnapshot,
  };

  return {
    ...workspace,
    isModified: false,
    git: {
      ...workspace.git,
      stagedFiles: [],
      commits: [newCommit, ...workspace.git.commits],
    },
  };
}

/**
 * Reverts a file's working tree changes to HEAD commit
 */
export function revertFileToHead(workspace: Workspace, filename: string): Workspace {
  if (!workspace.git || workspace.git.commits.length === 0) return workspace;
  const headCommit = workspace.git.commits[0];

  if (filename === workspace.potFile.filename) {
    if (headCommit.snapshot.potFile) {
      return {
        ...workspace,
        potFile: JSON.parse(JSON.stringify(headCommit.snapshot.potFile)),
        git: {
          ...workspace.git,
          stagedFiles: (workspace.git.stagedFiles || []).filter((f) => f !== filename),
        },
      };
    }
  }

  const headPo = headCommit.snapshot.poFiles.find((p) => p.filename === filename);
  if (headPo) {
    const updatedPoFiles = workspace.poFiles.map((p) =>
      p.filename === filename ? JSON.parse(JSON.stringify(headPo)) : p
    );
    return {
      ...workspace,
      poFiles: updatedPoFiles,
      git: {
        ...workspace.git,
        stagedFiles: (workspace.git.stagedFiles || []).filter((f) => f !== filename),
      },
    };
  } else {
    const updatedPoFiles = workspace.poFiles.filter((p) => p.filename !== filename);
    return {
      ...workspace,
      poFiles: updatedPoFiles,
      activeFileId: workspace.activeFileId === filename ? (updatedPoFiles[0]?.id || 'pot') : workspace.activeFileId,
      git: {
        ...workspace.git,
        stagedFiles: (workspace.git.stagedFiles || []).filter((f) => f !== filename),
      },
    };
  }
}

/**
 * Restores entire workspace to a historical commit snapshot
 */
export function restoreCommitSnapshot(workspace: Workspace, commitId: string): Workspace {
  if (!workspace.git) return workspace;
  const targetCommit = workspace.git.commits.find((c) => c.id === commitId || c.fullHash === commitId);
  if (!targetCommit) return workspace;

  const restored = cloneSnapshot(targetCommit.snapshot.potFile, targetCommit.snapshot.poFiles);

  return {
    ...workspace,
    potFile: restored.potFile,
    poFiles: restored.poFiles,
    activeFileId: restored.poFiles[0]?.id || 'pot',
    activeEntryId: restored.potFile.entries[0]?.id || null,
    isModified: true,
  };
}

export interface DetailedEntryDiff {
  entryId: string;
  msgid: string;
  msgidPlural?: string;
  type: 'added' | 'removed' | 'modified' | 'identical';
  oldMsgstr?: string[];
  newMsgstr?: string[];
  oldFlags?: string[];
  newFlags?: string[];
}

/**
 * Computes detailed per-entry diff between two sets of PoEntries for visual inspection
 */
export function getDetailedEntryDiffs(
  baseEntries: PoEntry[] = [],
  targetEntries: PoEntry[] = []
): DetailedEntryDiff[] {
  const baseMap = new Map<string, PoEntry>(baseEntries.map((e) => [e.id, e]));
  const targetMap = new Map<string, PoEntry>(targetEntries.map((e) => [e.id, e]));

  const diffs: DetailedEntryDiff[] = [];

  // Target entries (check for added or modified)
  targetMap.forEach((targetEntry, id) => {
    const baseEntry = baseMap.get(id);
    if (!baseEntry) {
      diffs.push({
        entryId: id,
        msgid: targetEntry.msgid,
        msgidPlural: targetEntry.msgidPlural,
        type: 'added',
        newMsgstr: targetEntry.msgstr,
        newFlags: targetEntry.flags,
      });
    } else {
      const msgstrChanged = JSON.stringify(baseEntry.msgstr) !== JSON.stringify(targetEntry.msgstr);
      const msgidChanged = baseEntry.msgid !== targetEntry.msgid || baseEntry.msgidPlural !== targetEntry.msgidPlural;
      const flagsChanged = JSON.stringify(baseEntry.flags) !== JSON.stringify(targetEntry.flags);

      if (msgstrChanged || msgidChanged || flagsChanged) {
        diffs.push({
          entryId: id,
          msgid: targetEntry.msgid,
          msgidPlural: targetEntry.msgidPlural,
          type: 'modified',
          oldMsgstr: baseEntry.msgstr,
          newMsgstr: targetEntry.msgstr,
          oldFlags: baseEntry.flags,
          newFlags: targetEntry.flags,
        });
      } else {
        diffs.push({
          entryId: id,
          msgid: targetEntry.msgid,
          msgidPlural: targetEntry.msgidPlural,
          type: 'identical',
          newMsgstr: targetEntry.msgstr,
          newFlags: targetEntry.flags,
        });
      }
    }
  });

  // Base entries not in target (removed)
  baseMap.forEach((baseEntry, id) => {
    if (!targetMap.has(id)) {
      diffs.push({
        entryId: id,
        msgid: baseEntry.msgid,
        msgidPlural: baseEntry.msgidPlural,
        type: 'removed',
        oldMsgstr: baseEntry.msgstr,
        oldFlags: baseEntry.flags,
      });
    }
  });

  return diffs;
}

