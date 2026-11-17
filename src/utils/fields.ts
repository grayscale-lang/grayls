import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { Position } from 'vscode-languageserver/node';
import { findImportedMember } from './imports';
import { GraySymbol, StructField, scanSymbols } from './symbols';

type OpenText = (fileUri: string) => string | undefined;

/** A file's text and URI: types written inside a struct resolve relative to its file. */
interface FileContext {
  text: string;
  uri: string;
}

interface StructInContext {
  struct: GraySymbol;
  context: FileContext;
}

function readFile(fileUri: string, openText: OpenText): string {
  return openText(fileUri) ?? fs.readFileSync(fileURLToPath(fileUri), 'utf8');
}

// `Dice`, `^Dice`, `types.Dice` -> the struct they name, with its file.
function resolveStruct(typeName: string, context: FileContext, openText: OpenText): StructInContext | null {
  const name = typeName.trim().replace(/^\^/, '');
  const qualified = name.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (qualified) {
    const member = findImportedMember(context.text, context.uri, qualified[1], qualified[2], openText);
    if (member?.symbol.kind !== 'struct') return null;
    return {
      struct: member.symbol,
      context: { text: readFile(member.fileUri, openText), uri: member.fileUri },
    };
  }
  const lines = context.text.split('\n');
  const local = scanSymbols(context.text).find(
    s => s.name === name && s.kind === 'struct' && !/^\s/.test(lines[s.line]),
  );
  return local ? { struct: local, context } : null;
}

// The written type of a variable, constant or parameter in scope at the cursor.
function declaredTypeOf(name: string, text: string, position: Position): string | undefined {
  const symbols = scanSymbols(text);
  const enclosing = symbols
    .filter(s => s.kind === 'function' && s.line <= position.line)
    .sort((a, b) => b.line - a.line)[0];
  const variable = symbols
    .filter(s => s.name === name && (s.kind === 'variable' || s.kind === 'constant') && s.type && s.line <= position.line)
    .sort((a, b) => b.line - a.line)[0];
  if (variable && (!enclosing || variable.line >= enclosing.line)) return variable.type;
  return enclosing?.params?.find(p => p.name === name)?.type ?? variable?.type;
}

/**
 * Resolve `a.b.field` to the struct field it names. The root `a` needs an
 * explicit type (annotation or parameter); each step follows the field's type.
 */
export function findStructField(
  text: string,
  docUri: string,
  position: Position,
  access: { chain: string[]; field: string },
  openText: OpenText,
): { fileUri: string; line: number; field: StructField; structName: string } | null {
  let typeName = declaredTypeOf(access.chain[0], text, position);
  let context: FileContext = { text, uri: docUri };
  for (const step of [...access.chain.slice(1), access.field]) {
    if (!typeName) return null;
    const resolved = resolveStruct(typeName, context, openText);
    const field = resolved?.struct.structFields?.find(f => f.name === step);
    if (!resolved || !field) return null;
    if (step === access.field) {
      return {
        fileUri: resolved.context.uri,
        line: fieldLine(resolved.context.text, resolved.struct, step),
        field,
        structName: resolved.struct.name,
      };
    }
    typeName = field.type;
    context = resolved.context;
  }
  return null;
}

// Line of the field inside its struct body, found at the body's own brace depth.
function fieldLine(source: string, struct: GraySymbol, field: string): number {
  const lines = source.split('\n');
  const pattern = new RegExp(`^\\s*(?:[A-Za-z_]\\w*\\s*,\\s*)*${field}\\b`);
  let depth = (lines[struct.line].match(/\{/g) || []).length - (lines[struct.line].match(/\}/g) || []).length;
  for (let i = struct.line + 1; i < lines.length && depth > 0; i++) {
    if (depth === 1 && pattern.test(lines[i])) return i;
    depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
  }
  return struct.line;
}
