import { PluralRuleInfo } from '../types/gettext';

export const COMMON_PLURAL_RULES: Record<string, PluralRuleInfo> = {
  en: {
    language: 'English',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n != 1);',
    names: ['One (n=1)', 'Other (n!=1)'],
    examples: { 1: '1 file', 2: '2 files', 0: '0 files' },
  },
  es: {
    language: 'Spanish',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n != 1);',
    names: ['Singular (n=1)', 'Plural (n!=1)'],
    examples: { 1: '1 archivo', 5: '5 archivos' },
  },
  fr: {
    language: 'French',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n > 1);',
    names: ['Singular (n=0, 1)', 'Plural (n > 1)'],
    examples: { 0: '0 fichier', 1: '1 fichier', 2: '2 fichiers' },
  },
  de: {
    language: 'German',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n != 1);',
    names: ['Singular (n=1)', 'Plural (n!=1)'],
    examples: { 1: '1 Datei', 3: '3 Dateien' },
  },
  it: {
    language: 'Italian',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n != 1);',
    names: ['Singular (n=1)', 'Plural (n!=1)'],
    examples: { 1: '1 elemento', 2: '2 elementi' },
  },
  pt_BR: {
    language: 'Portuguese (Brazil)',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n > 1);',
    names: ['Singular (n=0, 1)', 'Plural (n > 1)'],
    examples: { 1: '1 item', 2: '2 itens' },
  },
  ru: {
    language: 'Russian',
    nplurals: 3,
    formula: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    names: ['One (1, 21, 31...)', 'Few (2-4, 22-24...)', 'Many (0, 5-20, 25-30...)'],
    examples: { 1: '1 файл', 2: '2 файла', 5: '5 файлов' },
  },
  pl: {
    language: 'Polish',
    nplurals: 3,
    formula: 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    names: ['One (1)', 'Few (2-4, 22-24)', 'Many (0, 5-21, 25+)'],
    examples: { 1: '1 plik', 2: '2 pliki', 5: '5 plików' },
  },
  cs: {
    language: 'Czech',
    nplurals: 3,
    formula: 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;',
    names: ['One (1)', 'Few (2-4)', 'Other (0, 5+)'],
    examples: { 1: '1 soubor', 3: '3 soubory', 5: '5 souborů' },
  },
  ar: {
    language: 'Arabic',
    nplurals: 6,
    formula: 'nplurals=6; plural=n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5;',
    names: ['Zero (0)', 'One (1)', 'Two (2)', 'Few (3-10)', 'Many (11-99)', 'Other (100+)'],
    examples: { 0: '0 ملف', 1: 'ملف واحد', 2: 'ملفان', 3: '3 ملفات', 15: '15 ملفاً', 100: '100 ملف' },
  },
  ja: {
    language: 'Japanese',
    nplurals: 1,
    formula: 'nplurals=1; plural=0;',
    names: ['Single form'],
    examples: { 1: '1 件のファイル', 5: '5 件のファイル' },
  },
  zh_CN: {
    language: 'Chinese (Simplified)',
    nplurals: 1,
    formula: 'nplurals=1; plural=0;',
    names: ['Single form'],
    examples: { 1: '1 个文件', 5: '5 个文件' },
  },
  ko: {
    language: 'Korean',
    nplurals: 1,
    formula: 'nplurals=1; plural=0;',
    names: ['Single form'],
    examples: { 1: '1 개 파일', 5: '5 개 파일' },
  },
  tr: {
    language: 'Turkish',
    nplurals: 2,
    formula: 'nplurals=2; plural=(n > 1);',
    names: ['Singular (1)', 'Plural (0, >1)'],
    examples: { 1: '1 dosya', 2: '2 dosya' },
  },
};

/**
 * Gets plural info for language code
 */
export function getPluralRuleForLanguage(langCode: string, customHeaderPlural?: string): PluralRuleInfo {
  const norm = langCode.replace('-', '_').split('.')[0];
  
  if (COMMON_PLURAL_RULES[norm]) {
    return COMMON_PLURAL_RULES[norm];
  }
  const base = norm.split('_')[0];
  if (COMMON_PLURAL_RULES[base]) {
    return COMMON_PLURAL_RULES[base];
  }

  // Parse customHeaderPlural if provided, e.g. "nplurals=2; plural=(n != 1);"
  if (customHeaderPlural) {
    const matchN = customHeaderPlural.match(/nplurals=(\d+)/);
    const n = matchN ? parseInt(matchN[1], 10) : 2;
    const names = Array.from({ length: n }, (_, i) => i === 0 ? 'Singular' : `Plural form ${i}`);
    return {
      language: langCode,
      nplurals: n,
      formula: customHeaderPlural,
      names,
      examples: {},
    };
  }

  // Default to 2 forms
  return {
    language: langCode,
    nplurals: 2,
    formula: 'nplurals=2; plural=(n != 1);',
    names: ['Form 0 (Singular)', 'Form 1 (Plural)'],
    examples: { 1: '1 item', 2: '2 items' },
  };
}

/**
 * Evaluates the plural form index for a given integer count `n`
 */
export function evaluatePluralIndex(n: number, rule: PluralRuleInfo): number {
  try {
    // Extract expression after "plural="
    const exprMatch = rule.formula.match(/plural=([^;]+)/);
    if (!exprMatch) {
      return (n !== 1) ? 1 : 0;
    }
    const expr = exprMatch[1].trim();

    // Safe evaluator without eval by converting C-like operators
    // Since formula is restricted to arithmetic & ternary with `n`
    const safeFunction = new Function('n', `
      var n = Math.abs(Number(n));
      var res = (${expr});
      return typeof res === 'boolean' ? (res ? 1 : 0) : Number(res);
    `);

    const result = safeFunction(n);
    if (typeof result === 'number' && !isNaN(result) && result >= 0 && result < rule.nplurals) {
      return Math.floor(result);
    }
    return 0;
  } catch {
    return n === 1 ? 0 : 1;
  }
}
