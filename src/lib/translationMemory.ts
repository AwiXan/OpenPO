import { PoEntry, TmSuggestion, Workspace } from '../types/gettext';

/**
 * Calculates string similarity using Levenshtein distance (0 to 1.0)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 0.99;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - distance / maxLen);
}

export class TranslationMemory {
  private entries: Map<string, TmSuggestion[]> = new Map(); // key: targetLanguage

  constructor() {
    this.entries = new Map();
  }

  /**
   * Index all translated entries from workspaces
   */
  public indexWorkspaces(workspaces: Workspace[]) {
    this.entries.clear();

    for (const ws of workspaces) {
      for (const poFile of ws.poFiles) {
        const lang = poFile.language;
        if (!this.entries.has(lang)) {
          this.entries.set(lang, []);
        }
        const langList = this.entries.get(lang)!;

        for (const entry of poFile.entries) {
          const trans = entry.msgstr[0];
          if (trans && trans.trim()) {
            langList.push({
              id: `${ws.id}_${poFile.id}_${entry.id}`,
              sourceMsgid: entry.msgid,
              suggestedMsgstr: trans,
              similarity: 1.0,
              sourceLanguage: 'en',
              targetLanguage: lang,
              originWorkspace: ws.name,
            });
          }
        }
      }
    }
  }

  /**
   * Query suggestions for a given msgid and target language
   */
  public query(msgid: string, targetLanguage: string, minSimilarity = 0.5): TmSuggestion[] {
    if (!msgid || !msgid.trim()) return [];

    const candidates = this.entries.get(targetLanguage) || [];
    const results: TmSuggestion[] = [];
    const seenTranslations = new Set<string>();

    for (const c of candidates) {
      // Never suggest a translation indexed from the same source key.
      if (c.sourceMsgid.trim().toLowerCase() === msgid.trim().toLowerCase()) continue;
      if (seenTranslations.has(c.suggestedMsgstr)) continue;

      const sim = calculateSimilarity(msgid, c.sourceMsgid);
      if (sim >= minSimilarity) {
        seenTranslations.add(c.suggestedMsgstr);
        results.push({
          ...c,
          similarity: Math.round(sim * 100),
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }
}

export const globalTranslationMemory = new TranslationMemory();
