import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { GraySymbol, scanSymbols } from './symbols';

const SOURCE_EXTENSIONS = ['.gray', '.grayscale'];

// One entry of an import statement: `"./path"` or `alias "./path"`.
const LOCAL_IMPORT_ITEM = /^(?:([A-Za-z_][A-Za-z0-9_]*)\s+)?"([^"]+)"$/;

export interface LocalImport {
  /** Source file URIs behind the module (one per file in a directory import). */
  files: string[];
  /** The module's own name, which differs from the bound name when aliased. */
  realName: string;
  /** Absolute path of the imported file or directory. */
  target: string;
  isDirectory: boolean;
}

/**
 * Resolve the local imports of a file to the module name each one binds and
 * the source files behind it. Stdlib (`@`) and `extern` imports are skipped.
 * A directory import merges every top-level source file in the directory.
 */
export function resolveLocalImports(text: string, docUri: string): Map<string, LocalImport> {
  const modules = new Map<string, LocalImport>();
  if (!docUri.startsWith('file:')) return modules;
  const baseDir = path.dirname(fileURLToPath(docUri));

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    const match = line.match(/^import\s+(?:and\s+use\s+)?(.+)$/);
    if (!match) continue;

    for (const item of match[1].split(',')) {
      const parts = item.trim().match(LOCAL_IMPORT_ITEM);
      if (!parts) continue;
      const [, alias, importPath] = parts;
      const target = path.resolve(baseDir, importPath);
      const files = resolveImportFiles(target);
      if (files.length === 0) continue;

      const baseName = path.basename(target).replace(/\.(gray|grayscale)$/, '');
      modules.set(alias ?? baseName, {
        files: files.map(file => pathToFileURL(file).toString()),
        realName: baseName,
        target,
        isDirectory: !files.includes(target) && !files.includes(target + '.gray') && !files.includes(target + '.grayscale'),
      });
    }
  }
  return modules;
}

function resolveImportFiles(target: string): string[] {
  if (SOURCE_EXTENSIONS.some(ext => target.endsWith(ext))) {
    return fs.existsSync(target) ? [target] : [];
  }
  for (const ext of SOURCE_EXTENSIONS) {
    if (fs.existsSync(target + ext)) return [target + ext];
  }
  try {
    return fs.readdirSync(target)
      .filter(name => !name.startsWith('.') && SOURCE_EXTENSIONS.some(ext => name.endsWith(ext)))
      .map(name => path.join(target, name));
  } catch {
    return [];
  }
}

const isPrivate = (symbol: GraySymbol): boolean => /^private\b/.test(symbol.declaration);

/**
 * Every file-scope declaration an importer can see in the local module
 * `moduleName`. Locals and struct functions are indented, and `private`
 * declarations (and private struct functions) are not published.
 */
export function importedSymbols(
  text: string,
  docUri: string,
  moduleName: string,
  openText: (fileUri: string) => string | undefined,
): { fileUri: string; symbol: GraySymbol }[] {
  const files = resolveLocalImports(text, docUri).get(moduleName)?.files ?? [];
  const result: { fileUri: string; symbol: GraySymbol }[] = [];
  for (const fileUri of files) {
    const source = openText(fileUri) ?? fs.readFileSync(fileURLToPath(fileUri), 'utf8');
    const lines = source.split('\n');
    for (const symbol of scanSymbols(source)) {
      if (/^\s/.test(lines[symbol.line]) || isPrivate(symbol)) continue;
      result.push({
        fileUri,
        symbol: symbol.kind === 'struct'
          ? { ...symbol, structFunctions: symbol.structFunctions?.filter(fn => !isPrivate(fn)) }
          : symbol,
      });
    }
  }
  return result;
}

/** Find the public file-scope declaration `name` in the local module `moduleName`. */
export function findImportedMember(
  text: string,
  docUri: string,
  moduleName: string,
  name: string,
  openText: (fileUri: string) => string | undefined,
): { fileUri: string; symbol: GraySymbol } | null {
  return importedSymbols(text, docUri, moduleName, openText).find(m => m.symbol.name === name) ?? null;
}

/**
 * Find the struct function `fn` of `Type.fn` (local struct) or `module.Type.fn`
 * (struct from a local import).
 */
export function findStructFunction(
  text: string,
  docUri: string,
  ref: { module?: string; type: string; fn: string },
  openText: (fileUri: string) => string | undefined,
): { fileUri: string; symbol: GraySymbol } | null {
  let owner: { fileUri: string; symbol: GraySymbol } | null;
  if (ref.module) {
    owner = findImportedMember(text, docUri, ref.module, ref.type, openText);
  } else {
    const local = scanSymbols(text).find(s => s.name === ref.type && s.kind === 'struct');
    owner = local ? { fileUri: docUri, symbol: local } : null;
  }
  const symbol = owner?.symbol.kind === 'struct'
    ? owner.symbol.structFunctions?.find(f => f.name === ref.fn)
    : undefined;
  return owner && symbol ? { fileUri: owner.fileUri, symbol } : null;
}
