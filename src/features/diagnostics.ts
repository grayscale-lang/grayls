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

function parseDiagnostics(output: string, checkedFile: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  let m: RegExpExecArray | null;
  DIAG_PATTERN.lastIndex = 0;

  while ((m = DIAG_PATTERN.exec(output)) !== null) {
    const [, severity, code, message, file, lineStr, colStr] = m;
    // Errors inside imported files belong to those files, not this buffer.
    if (path.basename(file) !== path.basename(checkedFile)) continue;
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

function runCheck(text: string, uri: string): Diagnostic[] {
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
    // 'gray check' type-checks only. Bare 'gray <file>' would compile AND run
    // the program, executing its I/O on every keystroke.
    const result = cp.spawnSync('gray', ['check', tmpFile], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    return parseDiagnostics(output, tmpFile);
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
