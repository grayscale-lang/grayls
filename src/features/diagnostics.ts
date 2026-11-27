import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as cp from 'child_process';
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentChangeEvent,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Debounce timer per document URI
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Match: error[E3018]: message\n  --> file.gray:42:10
// or:    warning[W1234]: message\n  --> file.gray:42:10
const DIAG_PATTERN =
  /^(error|warning)\[([EW]\d+)\]:\s+(.+)\n\s+-->\s+([^:]+):(\d+):(\d+)/gm;

const SOURCE_FILE = /\.(gray|grayscale)$/;
const MAIN_DECLARATION = /^[ \t]*do[ \t]+main[ \t]*\(/m;

function parseDiagnostics(output: string, checkedFile: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  let m: RegExpExecArray | null;
  DIAG_PATTERN.lastIndex = 0;

  while ((m = DIAG_PATTERN.exec(output)) !== null) {
    const [, severity, code, message, file, lineStr, colStr] = m;
    // Errors inside imported files belong to those files, not this buffer.
    if (path.basename(file) !== path.basename(checkedFile)) continue;
    if (path.basename(path.dirname(file)) !== path.basename(path.dirname(checkedFile))) continue;
    const line = Math.max(0, parseInt(lineStr, 10) - 1);  // to 0-indexed
    const col  = Math.max(0, parseInt(colStr, 10) - 1);

    diags.push({
      range: {
        start: { line, character: col },
        end:   { line, character: col + 1 },
      },
      severity: severity === 'error'
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning,
      code,
      message,
      source: 'grayc',
    });
  }
  return diags;
}

function runGrayCheck(file: string): string {
  // 'gray check' type-checks only. Bare 'gray <file>' would compile AND run
  // the program, executing its I/O on every keystroke.
  const result = cp.spawnSync('gray', ['check', file], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  return (result.stdout ?? '') + (result.stderr ?? '');
}

// The source files beside `file` that form one directory module with it, or
// null when the directory holds a program: a file declaring main.
function moduleSiblings(file: string, text: string): string[] | null {
  const own = path.basename(file);
  if (own.startsWith('.') || !SOURCE_FILE.test(own) || MAIN_DECLARATION.test(text)) return null;
  const directory = path.dirname(file);
  const siblings = fs.readdirSync(directory, { withFileTypes: true })
    .filter(e => !e.isDirectory() && e.name !== own && !e.name.startsWith('.') && SOURCE_FILE.test(e.name))
    .map(e => path.join(directory, e.name));
  const hasMain = siblings.some(s => MAIN_DECLARATION.test(fs.readFileSync(s, 'utf8')));
  return hasMain ? null : siblings;
}

// Check the buffer together with the rest of its directory module. A copy of
// the module, holding the buffer, goes in a hidden directory next to the real
// one so relative imports resolve at the same depth.
function runModuleCheck(text: string, file: string, siblings: string[]): Diagnostic[] {
  const parent = path.dirname(path.dirname(file));
  const copyDir = path.join(parent, `.gray-lsp-${process.pid}-module`);
  const tmpFile = path.join(copyDir, path.basename(file));
  try {
    fs.mkdirSync(copyDir, { recursive: true });
    for (const sibling of siblings) {
      fs.copyFileSync(sibling, path.join(copyDir, path.basename(sibling)));
    }
    fs.writeFileSync(tmpFile, text, 'utf8');
    return parseDiagnostics(runGrayCheck(copyDir), tmpFile);
  } finally {
    fs.rmSync(copyDir, { recursive: true, force: true });
  }
}

function runCheck(text: string, uri: string): Diagnostic[] {
  if (uri.startsWith('file:')) {
    try {
      const file = fileURLToPath(uri);
      const siblings = moduleSiblings(file, text);
      if (siblings) return runModuleCheck(text, file, siblings);
    } catch {
      // The module cannot be read or copied: check the buffer on its own.
    }
  }

  // Write the buffer to a hidden file next to the document so relative imports
  // resolve against its real directory (handles unsaved buffers too). Hidden
  // files are skipped by directory imports. Fall back to the temp directory.
  const fileName = `.gray-lsp-${process.pid}.gray`;
  let tmpFile = path.join(os.tmpdir(), fileName);
  if (uri.startsWith('file:')) {
    tmpFile = path.join(path.dirname(fileURLToPath(uri)), fileName);
  }
  try {
    fs.writeFileSync(tmpFile, text, 'utf8');
  } catch {
    tmpFile = path.join(os.tmpdir(), fileName);
    try {
      fs.writeFileSync(tmpFile, text, 'utf8');
    } catch {
      return [];
    }
  }

  try {
    return parseDiagnostics(runGrayCheck(tmpFile), tmpFile);
  } catch {
    return [];
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export function registerDiagnostics(
  connection: Connection,
  documents: TextDocuments<TextDocument>,
): void {
  function validate(doc: TextDocument): void {
    const uri = doc.uri;
    const existing = timers.get(uri);
    if (existing) clearTimeout(existing);

    timers.set(
      uri,
      setTimeout(() => {
        timers.delete(uri);
        const diags = runCheck(doc.getText(), uri);
        connection.sendDiagnostics({ uri, diagnostics: diags });
      }, 300),
    );
  }

  documents.onDidOpen((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));
  documents.onDidSave((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));
  documents.onDidChangeContent((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));

  documents.onDidClose((e: TextDocumentChangeEvent<TextDocument>) => {
    const t = timers.get(e.document.uri);
    if (t) { clearTimeout(t); timers.delete(e.document.uri); }
    // Clear diagnostics when file is closed
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
  });
}
