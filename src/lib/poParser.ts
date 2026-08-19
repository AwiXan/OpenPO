import { PoEntry, PoHeader } from '../types/gettext';
import { deriveCategory } from './categorizer';
import { getPluralRuleForLanguage } from './pluralEngine';

// Generate lightweight unique IDs
let idCounter = 1;
export function generateEntryId(): string {
  return `entry_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

/**
 * Parses raw header string (found in msgid "" msgstr "")
 */
export function parseHeader(headerStr: string): PoHeader {
  const rawHeaders: Record<string, string> = {};
  const lines = headerStr.split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      rawHeaders[key] = val; // Сохраняем оригинальный регистр
    }
  }

  const getHeader = (key: string) => {
    const foundKey = Object.keys(rawHeaders).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey ? rawHeaders[foundKey] : undefined;
  };

  return {
    projectIdVersion: getHeader('Project-Id-Version'),
    reportMsgidBugsTo: getHeader('Report-Msgid-Bugs-To'),
    potCreationDate: getHeader('POT-Creation-Date'),
    poRevisionDate: getHeader('PO-Revision-Date'),
    lastTranslator: getHeader('Last-Translator'),
    languageTeam: getHeader('Language-Team'),
    language: getHeader('Language'),
    mimeVersion: getHeader('MIME-Version') || '1.0',
    contentType: getHeader('Content-Type') || 'text/plain; charset=UTF-8',
    contentTransferEncoding: getHeader('Content-Transfer-Encoding') || '8bit',
    pluralForms: getHeader('Plural-Forms'),
    xGenerator: getHeader('X-Generator') || 'PoCraft Gettext Studio',
    rawHeaders,
  };
}

/**
 * Serializes PoHeader to gettext header string
 */
export function serializeHeader(header: PoHeader, langOverride?: string): string {
  const lines: string[] = [];
  
  const add = (k: string, v?: string) => {
    if (v) lines.push(`${k}: ${v}\\n`);
  };

  const lang = langOverride || header.language || 'en';

  add('Project-Id-Version', header.projectIdVersion || 'Project 1.0');
  add('Report-Msgid-Bugs-To', header.reportMsgidBugsTo || '');
  add('POT-Creation-Date', header.potCreationDate || new Date().toISOString().slice(0, 19).replace('T', ' ') + '+0000');
  add('PO-Revision-Date', header.poRevisionDate || new Date().toISOString().slice(0, 19).replace('T', ' ') + '+0000');
  add('Last-Translator', header.lastTranslator || 'Translator <translator@example.com>');
  add('Language-Team', header.languageTeam || 'English <team@example.com>');
  add('Language', lang);
  add('MIME-Version', header.mimeVersion || '1.0');
  add('Content-Type', header.contentType || 'text/plain; charset=UTF-8');
  add('Content-Transfer-Encoding', header.contentTransferEncoding || '8bit');

  let pluralForms = header.pluralForms;
  if (!pluralForms || pluralForms.trim() === '') {
    pluralForms = getPluralRuleForLanguage(lang).formula;
  }
  add('Plural-Forms', pluralForms);
  add('X-Generator', header.xGenerator || 'PoCraft Gettext Studio');

  // Any custom raw headers not explicitly covered (игнорируем дубликаты в любом регистре)
  const skipKeys = ['Project-Id-Version', 'Report-Msgid-Bugs-To', 'POT-Creation-Date', 'PO-Revision-Date', 'Last-Translator', 'Language-Team', 'Language', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding', 'Plural-Forms', 'X-Generator'];
  
  for (const [k, v] of Object.entries(header.rawHeaders || {})) {
    const isStandard = skipKeys.some(sk => sk.toLowerCase() === k.toLowerCase());
    if (!isStandard) {
      add(k, v);
    }
  }

  return lines.join('');
}

/**
 * Unescapes gettext string literal
 */
function unescapePoString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Escapes gettext string literal
 */
function escapePoString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

/**
 * Formats a string as PO quoted block (handles multi-line formatting cleanly)
 */
function formatPoBlock(prefix: string, value: string): string {
  if (value.includes('\n')) {
    const lines = value.split('\n');
    let out = `${prefix} ""\n`;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const escaped = escapePoString(line);
      out += `"${escaped}${isLast ? '' : '\\n'}"\n`;
    }
    return out;
  } else {
    return `${prefix} "${escapePoString(value)}"\n`;
  }
}

/**
 * Parses a .po or .pot file content into { header, entries }
 */
export function parsePoContent(content: string): { header: PoHeader; entries: PoEntry[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const entries: PoEntry[] = [];
  let header: PoHeader = {
    rawHeaders: {},
    contentType: 'text/plain; charset=UTF-8',
    contentTransferEncoding: '8bit',
  };

  let currentComments: string[] = [];
  let currentOpenPoCat: string | undefined;
  let currentExtractedComments: string[] = [];
  let currentReferences: string[] = [];
  let currentFlags: string[] = [];
  let currentPreviousMsgid: string | undefined;
  let currentMsgctxt: string | undefined;
  let currentMsgid: string | null = null;
  let currentMsgidPlural: string | undefined;
  let currentMsgstr: string[] = [];
  let currentPluralIndex = 0;

  let currentField: 'msgctxt' | 'msgid' | 'msgid_plural' | 'msgstr' | null = null;

  const commitCurrentEntry = () => {
    if (currentMsgid !== null) {
      if (currentMsgid === '' && (!currentMsgctxt || currentMsgctxt === '')) {
        // Header entry
        const headerStr = currentMsgstr[0] || '';
        header = parseHeader(headerStr);
      } else {
        // Normal entry
        let category: string | undefined = currentOpenPoCat;
        for (const ec of currentExtractedComments) {
          if (/^openpocat:\s*/i.test(ec)) continue;
          const match = ec.match(/^category:\s*(.+)$/i);
          if (match) {
            category = match[1].trim();
            break;
          }
        }
        if (!category) {
          for (const c of currentComments) {
            const match = c.match(/^category:\s*(.+)$/i);
            if (match) {
              category = match[1].trim();
              break;
            }
          }
        }

        entries.push({
          id: generateEntryId(),
          msgid: currentMsgid,
          msgidPlural: currentMsgidPlural,
          msgctxt: currentMsgctxt,
          msgstr: currentMsgstr.length > 0 ? currentMsgstr : [''],
          comments: currentComments.filter((comment) => !/^(?:openpocat|category):\s*/i.test(comment)),
          extractedComments: currentExtractedComments.filter((comment) => !/^(?:openpocat|category):\s*/i.test(comment)),
          references: [...currentReferences],
          flags: [...currentFlags],
          previousMsgid: currentPreviousMsgid,
          category,
        });
      }
    }

    // Reset state
    currentComments = [];
    currentOpenPoCat = undefined;
    currentExtractedComments = [];
    currentReferences = [];
    currentFlags = [];
    currentPreviousMsgid = undefined;
    currentMsgctxt = undefined;
    currentMsgid = null;
    currentMsgidPlural = undefined;
    currentMsgstr = [];
    currentPluralIndex = 0;
    currentField = null;
  };

  const extractQuoted = (line: string): string | null => {
    const match = line.match(/^"([\s\S]*)"$/);
    if (match) {
      return unescapePoString(match[1]);
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (currentMsgid !== null) {
        commitCurrentEntry();
      }
      continue;
    }

    // Comments & flags
    if (line.startsWith('#')) {
      if (currentMsgid !== null && currentField === 'msgstr') {
        // New block started
        commitCurrentEntry();
      }

      if (line.startsWith('#.')) {
        const comment = line.slice(2).trim();
        const openPoCat = comment.match(/^openpocat:\s*(.*)$/i);
        const category = comment.match(/^category:\s*(.*)$/i);
        if (openPoCat) currentOpenPoCat = openPoCat[1].trim();
        else if (category) currentOpenPoCat = category[1].trim();
        else currentExtractedComments.push(comment);
      } else if (line.startsWith('#:')) {
        const refs = line.slice(2).trim().split(/\s+/);
        currentReferences.push(...refs);
      } else if (line.startsWith('#,')) {
        const flags = line.slice(2).trim().split(',').map(f => f.trim());
        currentFlags.push(...flags);
      } else if (line.startsWith('#|')) {
        const prev = line.slice(2).trim();
        if (prev.startsWith('msgid')) {
          const match = prev.match(/msgid\s+"(.*)"/);
          if (match) currentPreviousMsgid = unescapePoString(match[1]);
        }
      } else {
        const comment = line.slice(1).trim();
        const openPoCat = comment.match(/^openpocat:\s*(.*)$/i);
        const category = comment.match(/^category:\s*(.*)$/i);
        if (openPoCat) currentOpenPoCat = openPoCat[1].trim();
        else if (category) currentOpenPoCat = category[1].trim();
        else currentComments.push(comment);
      }
      continue;
    }

    // msgctxt
    if (line.startsWith('msgctxt')) {
      const match = line.match(/^msgctxt\s+"([\s\S]*)"$/);
      if (match) {
        currentMsgctxt = unescapePoString(match[1]);
        currentField = 'msgctxt';
      }
      continue;
    }

    // msgid_plural
    if (line.startsWith('msgid_plural')) {
      const match = line.match(/^msgid_plural\s+"([\s\S]*)"$/);
      if (match) {
        currentMsgidPlural = unescapePoString(match[1]);
        currentField = 'msgid_plural';
      }
      continue;
    }

    // msgid
    if (line.startsWith('msgid')) {
      const match = line.match(/^msgid\s+"([\s\S]*)"$/);
      if (match) {
        currentMsgid = unescapePoString(match[1]);
        currentField = 'msgid';
      }
      continue;
    }

    // msgstr[N]
    const pluralMatch = line.match(/^msgstr\[(\d+)\]\s+"([\s\S]*)"$/);
    if (pluralMatch) {
      currentPluralIndex = parseInt(pluralMatch[1], 10);
      const strVal = unescapePoString(pluralMatch[2]);
      while (currentMsgstr.length <= currentPluralIndex) {
        currentMsgstr.push('');
      }
      currentMsgstr[currentPluralIndex] = strVal;
      currentField = 'msgstr';
      continue;
    }

    // msgstr
    if (line.startsWith('msgstr')) {
      const match = line.match(/^msgstr\s+"([\s\S]*)"$/);
      if (match) {
        currentMsgstr = [unescapePoString(match[1])];
        currentPluralIndex = 0;
        currentField = 'msgstr';
      }
      continue;
    }

    // Continuation line (multi-line string literal)
    if (line.startsWith('"') && line.endsWith('"')) {
      const quoted = extractQuoted(line);
      if (quoted !== null) {
        if (currentField === 'msgid' && currentMsgid !== null) {
          currentMsgid += quoted;
        } else if (currentField === 'msgid_plural' && currentMsgidPlural !== undefined) {
          currentMsgidPlural += quoted;
        } else if (currentField === 'msgctxt' && currentMsgctxt !== undefined) {
          currentMsgctxt += quoted;
        } else if (currentField === 'msgstr') {
          if (currentMsgstr.length <= currentPluralIndex) {
            currentMsgstr.push('');
          }
          currentMsgstr[currentPluralIndex] += quoted;
        }
      }
    }
  }

  // Commit last pending entry if any
  commitCurrentEntry();

  return { header, entries };
}

/**
 * Serializes PoHeader & PoEntry list back into valid gettext .po or .pot file
 */
export function serializePoFile(header: PoHeader, entries: PoEntry[], isPot = false, autoGenerateCategories = false, langOverride?: string): string {
  let output = '';

  // 1. Header block
  output += '#, fuzzy\n';
  output += 'msgid ""\n';
  output += 'msgstr ""\n';
  const serializedHeader = serializeHeader(header, langOverride);
  for (const line of serializedHeader.split('\\n')) {
    if (line) {
      output += `"${line}\\n"\n`;
    }
  }
  output += '\n';

  // 2. Entries
  for (const entry of entries) {
    const category = entry.category?.trim() || (autoGenerateCategories ? deriveCategory(entry, true) : '');
    // Comments
    for (const c of entry.comments) {
      if (!/^(?:openpocat|category):\s*/i.test(c)) output += `# ${c}\n`;
    }
    if (category) {
      output += `#. Category: ${category}\n`;
    }
    for (const ec of entry.extractedComments) {
      if (!/^(?:openpocat|category):\s*/i.test(ec)) output += `#. ${ec}\n`;
    }
    for (const ref of entry.references) {
      output += `#: ${ref}\n`;
    }
    if (entry.flags.length > 0) {
      output += `#, ${entry.flags.join(', ')}\n`;
    }
    if (entry.previousMsgid) {
      output += `#| msgid "${escapePoString(entry.previousMsgid)}"\n`;
    }

    // Context
    if (entry.msgctxt) {
      output += formatPoBlock('msgctxt', entry.msgctxt);
    }

    // msgid
    output += formatPoBlock('msgid', entry.msgid);

    // Plural
    if (entry.msgidPlural) {
      output += formatPoBlock('msgid_plural', entry.msgidPlural);
      if (isPot) {
        output += 'msgstr[0] ""\n';
        output += 'msgstr[1] ""\n';
      } else {
        const count = Math.max(entry.msgstr.length, 2);
        for (let i = 0; i < count; i++) {
          const val = entry.msgstr[i] || '';
          output += formatPoBlock(`msgstr[${i}]`, val);
        }
      }
    } else {
      if (isPot) {
        output += 'msgstr ""\n';
      } else {
        const val = entry.msgstr[0] || '';
        output += formatPoBlock('msgstr', val);
      }
    }

    output += '\n';
  }

  return output;
}
