import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
