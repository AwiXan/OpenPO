import { Command } from '@tauri-apps/plugin-shell';

export async function executeGitCommand(args: string[], cwd: string): Promise<string> {
  const normalizedCwd = cwd.replace(/\\/g, '/');

  try {
    const cmd = Command.create('git', args, { cwd: normalizedCwd });
    const result = await cmd.execute();

    if (result.code !== 0) {
      const errMsg = result.stderr || result.stdout || `Git exited with code ${result.code}`;
      console.error(`[Git Error] Command: git ${args.join(' ')} | CWD: ${normalizedCwd} | Error: ${errMsg}`);
      throw new Error(errMsg);
    }

    return result.stdout;
  } catch (error: any) {
    console.error(`[Git Execution Failed] args: ${args.join(' ')} | cwd: ${normalizedCwd}:`, error);
    throw error;
  }
}

export async function checkIsGitInitialized(cwd: string): Promise<boolean> {
  try {
    const output = await executeGitCommand(['rev-parse', '--is-inside-work-tree'], cwd);
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

export async function getGitStatus(cwd: string): Promise<string[]> {
  try {
    const output = await executeGitCommand(['status', '--porcelain', '-uall'], cwd);
    return output.split('\n').filter((line) => line.trim().length > 0);
  } catch (err) {
    console.error('Failed to get git status:', err);
    return [];
  }
}

export async function initGitRepo(cwd: string): Promise<string> {
  return await executeGitCommand(['init'], cwd);
}

export async function stageFiles(cwd: string, files: string[]): Promise<void> {
  await executeGitCommand(['add', '--', ...files], cwd);
}

export async function unstageFiles(cwd: string, files: string[]): Promise<void> {
  await executeGitCommand(['reset', 'HEAD', '--', ...files], cwd);
}

export async function commitChanges(
  cwd: string,
  message: string,
  authorName: string,
  authorEmail: string
): Promise<void> {
  await executeGitCommand([
    '-c', `user.name=${authorName || 'Translator'}`,
    '-c', `user.email=${authorEmail || 'translator@example.com'}`,
    'commit',
    '-m', message,
  ], cwd);
}

/* ------------------------------------------------------------------------ */
/* Status line parsing                                                      */
/* ------------------------------------------------------------------------ */

export type GitChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unmerged' | 'unknown';

export interface ParsedGitStatusLine {
  file: string;
  oldFile?: string;
  /** Index (staged) column of `git status --porcelain` output. */
  indexStatus: string;
  /** Worktree (unstaged) column of `git status --porcelain` output. */
  worktreeStatus: string;
  staged: boolean;
  isUntracked: boolean;
}

const STATUS_CODE_MAP: Record<string, GitChangeStatus> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  U: 'unmerged',
};

export function mapStatusCodeToLabel(code: string): GitChangeStatus {
  return STATUS_CODE_MAP[code] || 'unknown';
}

/**
 * Parses a single `git status --porcelain` line (XY PATH, or
 * XY OLD_PATH -> NEW_PATH for renames/copies) into a structured record.
 */
export function parseStatusLine(line: string): ParsedGitStatusLine {
  const indexStatus = line[0];
  const worktreeStatus = line[1];
  const rest = line.substring(3);
  const isRenameOrCopy = indexStatus === 'R' || indexStatus === 'C';

  if (isRenameOrCopy && rest.includes(' -> ')) {
    const [oldFile, file] = rest.split(' -> ');
    return {
      file,
      oldFile,
      indexStatus,
      worktreeStatus,
      staged: true,
      isUntracked: false,
    };
  }

  return {
    file: rest,
    indexStatus,
    worktreeStatus,
    staged: indexStatus !== ' ' && indexStatus !== '?',
    isUntracked: indexStatus === '?' && worktreeStatus === '?',
  };
}

/* ------------------------------------------------------------------------ */
/* Branch                                                                    */
/* ------------------------------------------------------------------------ */

export async function getCurrentBranch(cwd: string): Promise<string> {
  try {
    const branch = await executeGitCommand(['branch', '--show-current'], cwd);
    const trimmed = branch.trim();
    if (trimmed) return trimmed;

    // Empty output means detached HEAD; fall back to a short hash label.
    const shortHash = await executeGitCommand(['rev-parse', '--short', 'HEAD'], cwd);
    return `detached@${shortHash.trim()}`;
  } catch {
    return 'main';
  }
}

/* ------------------------------------------------------------------------ */
/* Commit log                                                                */
/* ------------------------------------------------------------------------ */

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  /** ISO-8601 author date. */
  date: string;
  subject: string;
}

// ASCII unit/record separators avoid collisions with characters that can
// legitimately appear in author names or commit subjects.
const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

export async function getGitLog(cwd: string, limit = 200): Promise<GitLogEntry[]> {
  try {
    const format = ['%H', '%h', '%an', '%ae', '%aI', '%s'].join(FIELD_SEP) + RECORD_SEP;
    const output = await executeGitCommand(
      ['log', '-n', String(limit), `--pretty=format:${format}`],
      cwd
    );

    if (!output.trim()) return [];

    return output
      .split(RECORD_SEP)
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, authorName, authorEmail, date, subject] = record.split(FIELD_SEP);
        return { hash, shortHash, authorName, authorEmail, date, subject };
      });
  } catch (err) {
    console.error('Failed to get git log:', err);
    return [];
  }
}

/* ------------------------------------------------------------------------ */
/* Commit contents                                                           */
/* ------------------------------------------------------------------------ */

export interface GitFileChange {
  filename: string;
  oldFilename?: string;
  status: GitChangeStatus;
  additions: number;
  deletions: number;
}

/**
 * Returns the files changed by a commit, with per-file status and line
 * counts. `--root` makes the root commit diff against the empty tree
 * instead of being skipped.
 */
export async function getCommitFilesChanged(cwd: string, hash: string): Promise<GitFileChange[]> {
  try {
    // -M forces rename detection consistently across both calls; without it,
    // one call could report a rename while the other reports a delete+add.
    const [nameStatusOut, numstatOut] = await Promise.all([
      executeGitCommand(['diff-tree', '-r', '-M', '--no-commit-id', '--name-status', '--root', hash], cwd),
      executeGitCommand(['diff-tree', '-r', '-M', '--no-commit-id', '--numstat', '--root', hash], cwd),
    ]);

    // NOTE: for renames, --numstat prints the path as "old => new" (or a
    // shared-prefix abbreviation) in a single field rather than as a plain
    // filename, so it won't key-match the --name-status filename below and
    // the line-count stats will fall back to 0/0 for renamed files.
    const numstatMap = new Map<string, { additions: number; deletions: number }>();
    numstatOut
      .split('\n')
      .filter(Boolean)
      .forEach((line) => {
        const [add, del, filename] = line.split('\t');
        numstatMap.set(filename, {
          // Binary files report '-' instead of a number.
          additions: add === '-' ? 0 : parseInt(add, 10) || 0,
          deletions: del === '-' ? 0 : parseInt(del, 10) || 0,
        });
      });

    return nameStatusOut
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t');
        const status = mapStatusCodeToLabel(parts[0][0]);
        const isRenameOrCopy = status === 'renamed' || status === 'copied';

        const filename = isRenameOrCopy ? parts[2] : parts[1];
        const oldFilename = isRenameOrCopy ? parts[1] : undefined;
        const stat = numstatMap.get(filename) || { additions: 0, deletions: 0 };

        return { filename, oldFilename, status, ...stat };
      });
  } catch (err) {
    console.error('Failed to get commit files:', err);
    return [];
  }
}

/* ------------------------------------------------------------------------ */
/* Diffs                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Returns the unified diff for a single file in the working tree.
 * Untracked files that are not yet staged have no index entry to diff
 * against, so this resolves to an empty string for them by design.
 */
export async function getWorkingTreeDiff(cwd: string, file: string, staged: boolean): Promise<string> {
  try {
    const args = staged ? ['diff', '--cached', '--', file] : ['diff', '--', file];
    return await executeGitCommand(args, cwd);
  } catch (err) {
    console.error('Failed to get working tree diff:', err);
    return '';
  }
}

/** Returns the unified diff a given commit introduced for a single file. */
export async function getCommitFileDiff(cwd: string, hash: string, file: string): Promise<string> {
  try {
    return await executeGitCommand(['show', hash, '--', file], cwd);
  } catch (err) {
    console.error('Failed to get commit file diff:', err);
    return '';
  }
}

export async function revertFile(cwd: string, file: string): Promise<void> {
  try {
    await executeGitCommand(['reset', 'HEAD', '--', file], cwd);
  } catch {
  }

  try {
    await executeGitCommand(['checkout', 'HEAD', '--', file], cwd);
  } catch {
    try {
      await executeGitCommand(['clean', '-f', '--', file], cwd);
    } catch (cleanErr) {
      console.error(`Failed to clean untracked file ${file}:`, cleanErr);
      throw cleanErr;
    }
  }
}

export async function getFileContentFromHead(cwd: string, file: string): Promise<string> {
  try {
    return await executeGitCommand(['show', `HEAD:${file}`], cwd);
  } catch (err) {
    console.error(`Failed to get file content from HEAD for ${file}:`, err);
    throw err;
  }
}