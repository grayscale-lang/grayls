import { Position } from 'vscode-languageserver/node';
import { importedSymbols } from './imports';
import { fileScopeSymbols, functionSpans, maskText, offsetAt } from './scope';
import { GraySymbol, scanSymbols } from './symbols';

type OpenText = (fileUri: string) => string | undefined;

const USING = /(?<![\w.])using\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)/g;
// One import item: `@module`, `"./path"` or `alias "./path"`.
const IMPORT_ITEM = /^(?:@(\w+)|(?:([A-Za-z_]\w*)\s+)?"([^"]+)")$/;

interface ImportedName {
  name: string;
  isStdlib: boolean;
  isUsed: boolean; // written as `import and use`
  offset: number;
}

/** A module brought into scope by `using` or `import and use`. */
export interface UsedModule {
  name: string;
  isStdlib: boolean;
}

function importedNames(text: string, masked: string): ImportedName[] {
  const names: ImportedName[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    // The masked line says where the code ends and any comment begins.
    const code = line.slice(0, masked.slice(offset, offset + line.length).trimEnd().length);
    for (const statement of code.split(';')) {
      const match = statement.trim().match(/^import\s+(and\s+use\s+)?(.+)$/);
      if (!match) continue;
      for (const item of match[2].split(',')) {
        const parts = item.trim().match(IMPORT_ITEM);
        if (!parts) continue;
        const [, stdlib, alias, importPath] = parts;
        const name = stdlib ?? alias
          ?? importPath.replace(/\/+$/, '').split('/').pop()!.replace(/\.(gray|grayscale)$/, '');
        names.push({ name, isStdlib: stdlib !== undefined, isUsed: match[1] !== undefined, offset });
      }
    }
    offset += line.length + 1;
  }
  return names;
}

/**
 * The modules whose members are bare names at `position`. A file-scope `using`
 * applies to the whole file; one inside a function applies from the statement
 * to the end of that function. Both must follow the module's import.
 */
export function usedModulesAt(text: string, position: Position): UsedModule[] {
  const masked = maskText(text);
  const imports = importedNames(text, masked);
  const spans = functionSpans(masked);
  const cursor = offsetAt(text, position);

  const used = new Map<string, UsedModule>();
  const add = ({ name, isStdlib }: ImportedName) => used.set(name, { name, isStdlib });
  imports.filter(i => i.isUsed).forEach(add);

  for (const match of masked.matchAll(USING)) {
    const at = match.index!;
    const scope = spans.find(s => s.start < at && at < s.end);
    if (scope && (cursor < at + match[0].length || cursor > scope.end)) continue;
    for (const name of match[1].split(',')) {
      const imported = imports.find(i => i.name === name.trim() && i.offset < at);
      if (imported) add(imported);
    }
  }
  return [...used.values()];
}

/**
 * What the bare name `word` at `position` refers to when a used module supplies
 * it: a declaration of a local module, or a stdlib member's `module.name` key.
 * Null when a declaration of this file is visible under that name.
 */
export function findUsedName(
  text: string,
  docUri: string,
  position: Position,
  word: string,
  isStdlibMember: (key: string) => boolean,
  openText: OpenText,
): { stdlibKey: string } | { fileUri: string; symbol: GraySymbol } | null {
  const line = text.split('\n')[position.line] ?? '';
  let start = position.character;
  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) start--;
  if (line[start - 1] === '.') return null;

  const modules = usedModulesAt(text, position);
  if (modules.length === 0) return null;

  const spans = functionSpans(maskText(text));
  const cursor = offsetAt(text, position);
  const current = spans.find(s => s.start <= cursor && cursor <= s.end);
  const isDeclaredHere = fileScopeSymbols(text).some(symbol => symbol.name === word)
    || scanSymbols(text).some(symbol => {
      if (symbol.name !== word || !current) return false;
      const declared = offsetAt(text, { line: symbol.line, character: symbol.char });
      return current.start <= declared && declared <= current.end;
    });
  if (isDeclaredHere) return null;

  for (const module of modules) {
    if (module.isStdlib) {
      const key = `${module.name}.${word}`;
      if (isStdlibMember(key)) return { stdlibKey: key };
    } else {
      const found = importedSymbols(text, docUri, module.name, openText).find(m => m.symbol.name === word);
      if (found) return found;
    }
  }
  return null;
}
