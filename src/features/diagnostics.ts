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
const CHECK_TIMEOUT_MS = 10_000;

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

// The files written for one run of 'gray check'.
interface CheckFiles {
  target: string;   // the path handed to 'gray check'
  buffer: string;   // the copy of the document being checked
  remove(): void;
}

// Numbers each run so overlapping checks never share a temporary path.
let runCount = 0;

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
function writeModuleCopy(text: string, file: string, siblings: string[], name: string): CheckFiles {
  const parent = path.dirname(path.dirname(file));
  const copyDir = path.join(parent, `${name}-module`);
  const buffer = path.join(copyDir, path.basename(file));
  const remove = () => fs.rmSync(copyDir, { recursive: true, force: true });
  try {
    fs.mkdirSync(copyDir, { recursive: true });
    for (const sibling of siblings) {
      fs.copyFileSync(sibling, path.join(copyDir, path.basename(sibling)));
    }
    fs.writeFileSync(buffer, text, 'utf8');
  } catch (error) {
    remove();
    throw error;
  }
  return { target: copyDir, buffer, remove };
}

function writeCheckFiles(text: string, uri: string): CheckFiles | null {
  const name = `.gray-lsp-${process.pid}-${++runCount}`;
  if (uri.startsWith('file:')) {
    try {
      const file = fileURLToPath(uri);
      const siblings = moduleSiblings(file, text);
      if (siblings) return writeModuleCopy(text, file, siblings, name);
    } catch {
      // The module cannot be read or copied: check the buffer on its own.
    }
  }

  // Write the buffer to a hidden file next to the document so relative imports
  // resolve against its real directory (handles unsaved buffers too). Hidden
  // files are skipped by directory imports. Fall back to the temp directory.
  const directories = [os.tmpdir()];
  if (uri.startsWith('file:')) directories.unshift(path.dirname(fileURLToPath(uri)));
  for (const directory of directories) {
    const buffer = path.join(directory, `${name}.gray`);
    try {
      fs.writeFileSync(buffer, text, 'utf8');
    } catch {
      continue;
    }
    return { target: buffer, buffer, remove: () => fs.rmSync(buffer, { force: true }) };
  }
  return null;
}

// 'gray' runs the compiler as a child process, so stopping a check means
// stopping the whole tree: the process group, or taskkill on Windows.
function killTree(child: cp.ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    cp.spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch { /* already exited */ }
}

// Starts checking the buffer and returns a function that cancels the check.
// 'done' is not called for a cancelled check.
function startCheck(
  text: string,
  uri: string,
  done: (diagnostics: Diagnostic[]) => void,
): () => void {
  const files = writeCheckFiles(text, uri);
  if (!files) {
    done([]);
    return () => {};
  }

  // 'gray check' type-checks only. Bare 'gray <file>' would compile AND run
  // the program, executing its I/O on every keystroke.
  const child = cp.spawn('gray', ['check', files.target], {
    // A process group of its own, for killTree.
    detached: process.platform !== 'win32',
  });
  let output = '';
  let isFinished = false;
  const timeout = setTimeout(() => killTree(child), CHECK_TIMEOUT_MS);

  function finish(): void {
    isFinished = true;
    clearTimeout(timeout);
    try { files!.remove(); } catch { /* ignore */ }
  }

  for (const stream of [child.stdout, child.stderr]) {
    stream?.setEncoding('utf8');
    stream?.on('data', (chunk: string) => { output += chunk; });
  }
  // A failed spawn emits 'error' and then 'close'.
  child.on('error', () => {});
  child.on('close', () => {
    if (isFinished) return;
    finish();
    done(parseDiagnostics(output, files.buffer));
  });

  return () => {
    if (isFinished) return;
    killTree(child);
    finish();
  };
}

export function registerDiagnostics(
  connection: Connection,
  documents: TextDocuments<TextDocument>,
): void {
  // Cancel function of the running check per document URI
  const running = new Map<string, () => void>();

  function cancel(uri: string): void {
    const timer = timers.get(uri);
    if (timer) { clearTimeout(timer); timers.delete(uri); }
    running.get(uri)?.();
    running.delete(uri);
  }

  function validate(doc: TextDocument): void {
    const uri = doc.uri;
    cancel(uri);

    timers.set(
      uri,
      setTimeout(() => {
        timers.delete(uri);
        running.set(uri, startCheck(doc.getText(), uri, (diagnostics) => {
          connection.sendDiagnostics({ uri, diagnostics });
        }));
      }, 300),
    );
  }

  documents.onDidOpen((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));
  documents.onDidSave((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));
  documents.onDidChangeContent((e: TextDocumentChangeEvent<TextDocument>) => validate(e.document));

  documents.onDidClose((e: TextDocumentChangeEvent<TextDocument>) => {
    cancel(e.document.uri);
    // Clear diagnostics when file is closed
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
  });

  // Stop running checks and remove their files when the server exits. A signal
  // ends the process without an 'exit' event unless it is turned into one.
  process.on('exit', () => running.forEach(stop => stop()));
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => process.exit());
  }
}
