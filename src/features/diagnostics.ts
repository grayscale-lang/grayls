import * as fs from 'fs';
import * as os from 'os';
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
  /^(error|warning)\[([EW]\d+)\]:\s+(.+)\n\s+-->\s+[^:]+:(\d+):(\d+)/gm;

function parseDiagnostics(output: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  let m: RegExpExecArray | null;
  DIAG_PATTERN.lastIndex = 0;

  while ((m = DIAG_PATTERN.exec(output)) !== null) {
    const [, severity, code, message, lineStr, colStr] = m;
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

function runCheck(text: string): Diagnostic[] {
  // Write to a temp file so gray can read it (handles unsaved buffers too)
  const tmpFile = path.join(os.tmpdir(), `gray-lsp-${process.pid}.gray`);
  try {
    fs.writeFileSync(tmpFile, text, 'utf8');
  } catch {
    return [];
  }

  try {
    const result = cp.spawnSync('gray', [tmpFile], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    const output = (result.stdout ?? '') + (result.stderr ?? '');
    return parseDiagnostics(output);
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
        const diags = runCheck(doc.getText());
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
