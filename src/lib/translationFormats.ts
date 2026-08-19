import { PoEntry, PoFileRecord, PoHeader, Workspace } from '../types/gettext';

export type TranslationFormat = 'gettext' | 'csv' | 'json';
export type JsonFormat = 'key-first' | 'language-first';
type TranslationValue = string | string[];
type TranslationMatrix = Record<string, Record<string, TranslationValue>>;

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

function csvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"' && quoted && content[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[index + 1] === '\n') index++;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

function pluralKey(msgid: string, pluralIndex: number, suffix: string): string {
  return `${msgid}${suffix.replace('%d', String(pluralIndex))}`;
}

function matrixFromWorkspace(workspace: Workspace, csvPluralSuffix: string): TranslationMatrix {
  const languages = workspace.poFiles.map((po) => po.language);
  const matrix: TranslationMatrix = {};
  workspace.potFile.entries.forEach((templateEntry) => {
    const matchingEntries = workspace.poFiles.map((po) => po.entries.find((entry) => entry.msgid === templateEntry.msgid && (entry.msgctxt || '') === (templateEntry.msgctxt || '')));
    const pluralCount = templateEntry.msgidPlural
      ? Math.max(1, ...matchingEntries.map((entry) => entry?.msgstr.length || 0))
      : 1;
    for (let pluralIndex = 0; pluralIndex < pluralCount; pluralIndex++) {
      const key = templateEntry.msgidPlural ? pluralKey(templateEntry.msgid, pluralIndex, csvPluralSuffix) : templateEntry.msgid;
      matrix[key] = {};
      languages.forEach((language, languageIndex) => {
        const entry = matchingEntries[languageIndex];
        matrix[key][language] = entry?.msgstr[templateEntry.msgidPlural ? pluralIndex : 0] || '';
      });
    }
  });
  return matrix;
}

export function serializeTranslationsCsv(workspace: Workspace, csvPluralSuffix = '_P%d'): string {
  const languages = workspace.poFiles.map((po) => po.language);
  const matrix = matrixFromWorkspace(workspace, csvPluralSuffix);
  const headers = ['keys', ...languages];
  const rows = Object.entries(matrix).map(([key, translations]) => [key, ...languages.map((language) => String(translations[language] || ''))]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

export function serializeTranslationsJson(workspace: Workspace, csvPluralSuffix = '_P%d', jsonFormat: JsonFormat = 'key-first'): string {
  const matrix = matrixFromWorkspace(workspace, csvPluralSuffix);
  if (jsonFormat === 'key-first') return JSON.stringify(matrix, null, 2) + '\n';
  const languageFirst: TranslationMatrix = {};
  Object.entries(matrix).forEach(([key, translations]) => {
    Object.entries(translations).forEach(([language, value]) => {
      languageFirst[language] = languageFirst[language] || {};
      languageFirst[language][key] = value;
    });
  });
  return JSON.stringify(languageFirst, null, 2) + '\n';
}

function emptyEntry(language: string, msgid: string, msgidPlural?: string, rowIndex = 0): PoEntry {
  return { id: `${language}_${rowIndex}_${msgid}`, msgid, msgidPlural, msgstr: msgidPlural ? [] : [''], comments: [], extractedComments: [], references: [], flags: [] };
}

function matrixToEntries(matrix: TranslationMatrix, csvPluralSuffix: string): Record<string, PoEntry[]> {
  const entriesByLanguage: Record<string, PoEntry[]> = {};
  const escapedSuffix = csvPluralSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%d', '(\\d+)');
  const pluralPattern = new RegExp(`^(.*)${escapedSuffix}$`);
  Object.entries(matrix).forEach(([key, translations], rowIndex) => {
    const pluralMatch = key.match(pluralPattern);
    const baseKey = pluralMatch?.[1] || key;
    const pluralIndex = pluralMatch ? Number(pluralMatch[2]) : 0;
    Object.entries(translations).forEach(([language, value]) => {
      const entries = entriesByLanguage[language] || (entriesByLanguage[language] = []);
      let entry = entries.find((candidate) => candidate.msgid === baseKey);
      if (!entry) {
        entry = emptyEntry(language, baseKey, pluralMatch ? `${baseKey} (plural)` : undefined, rowIndex);
        entries.push(entry);
      }
      const text = Array.isArray(value) ? value[pluralIndex] || '' : value || '';
      if (pluralMatch) {
        entry.msgidPlural = `${baseKey} (plural)`;
        entry.msgstr[pluralIndex] = text;
      } else entry.msgstr[0] = text;
    });
  });
  return entriesByLanguage;
}

export function parseTranslationsCsv(content: string, csvPluralSuffix = '_P%d'): Record<string, PoEntry[]> {
  const rows = csvRows(content);
  if (rows.length < 2) return {};
  const headers = rows[0].map((header) => header.trim());
  const keyIndex = headers.findIndex((header) => ['keys', 'key', 'msgid'].includes(header.toLowerCase()));
  if (keyIndex < 0) return {};
  const matrix: TranslationMatrix = {};
  rows.slice(1).forEach((row) => {
    const key = row[keyIndex] || '';
    if (!key) return;
    matrix[key] = {};
    headers.forEach((language, index) => {
      if (index !== keyIndex && language) matrix[key][language] = row[index] || '';
    });
  });
  return matrixToEntries(matrix, csvPluralSuffix);
}

export function parseTranslationsJson(content: string, csvPluralSuffix = '_P%d'): Record<string, PoEntry[]> {
  const parsed = JSON.parse(content) as { translations?: unknown } | Record<string, unknown>;
  const source = 'translations' in parsed && parsed.translations ? parsed.translations : parsed;
  if (!source || typeof source !== 'object') return {};
  const matrix: TranslationMatrix = {};
  const sourceEntries = Object.entries(source as Record<string, unknown>);
  const languageFirst = sourceEntries.length > 0 && sourceEntries.every(([key, value]) =>
    /^[a-z]{2,3}(?:[-_][a-z]{2,4})?$/i.test(key) && value && typeof value === 'object' && !Array.isArray(value)
  );
  if (languageFirst) {
    sourceEntries.forEach(([language, languageValues]) => {
      Object.entries(languageValues as Record<string, unknown>).forEach(([msgid, translation]) => {
        matrix[msgid] = matrix[msgid] || {};
        matrix[msgid][language] = Array.isArray(translation) ? translation as string[] : String(translation ?? '');
      });
    });
  } else sourceEntries.forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const values = value as Record<string, unknown>;
    matrix[key] = Object.fromEntries(Object.entries(values).map(([language, translation]) => [language, Array.isArray(translation) ? translation as string[] : String(translation ?? '')]));
  });
  return matrixToEntries(matrix, csvPluralSuffix);
}

export function createImportedPoFiles(entriesByLanguage: Record<string, PoEntry[]>): PoFileRecord[] {
  return Object.entries(entriesByLanguage).map(([language, entries], index) => ({
    id: `po_${language}_${Date.now()}_${index}`,
    filename: `${language}.po`, language, languageName: language.toUpperCase(),
    header: { language, rawHeaders: {} } as PoHeader, entries,
  }));
}
