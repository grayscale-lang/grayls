import { Position, Location } from 'vscode-languageserver/node';

export interface EnumMember {
  name: string;
  value: number | string;
}

export interface StructField {
  name: string;
  type: string;
}

export interface EzSymbol {
  name: string;
  kind: 'variable' | 'constant' | 'function' | 'struct' | 'enum';
  line: number;   // 0-indexed
  char: number;   // 0-indexed, start of the name
  declaration: string; // full declaration line text
  type?: string;           // parsed EZ type for mut/const declarations
  enumMembers?: EnumMember[];
  structFields?: StructField[];
}

// Single-line declaration patterns
const MUT_PATTERN    = /^\s*mut\s+([A-Za-z][A-Za-z0-9_]*)/;
const CONST_VAR_PATTERN = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+(?!struct\b|enum\b)/;
const FUNC_PATTERN   = /^\s*(?:private\s+)?(?:do|func)\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/;
const STRUCT_PATTERN = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+struct\b/;
const ENUM_PATTERN   = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+enum\b/;

/**
 * Extract the declared EZ type from a `mut` or `const` line.
 *
 * Handles:  mut x int = 42
 *           mut arr [byte] = {}
 *           mut m map[string:int] = {:}
 *           mut p ^Foo = addr(x)
 *           mut foo = new(Foo)      ← no annotation, returns undefined
 */
function extractType(line: string): string | undefined {
  // Tokenise loosely: split on whitespace but keep bracket groups intact
  const trimmed = line.trim();
  // Strip leading keyword (mut / const)
  const withoutKw = trimmed.replace(/^(mut|const)\s+/, '');
  // Strip name
  const afterName = withoutKw.replace(/^[A-Za-z][A-Za-z0-9_]*\s*/, '');

  if (!afterName || afterName.startsWith('=')) return undefined;

  // Match the type token: could be [T], [[T]], [T,N], map[K:V], ^T, or a bare identifier
  const typeMatch = afterName.match(
    /^(\[\[.*?\]\]|\[.*?\]|map\[[^\]]*\]|\^?[A-Za-z][A-Za-z0-9_]*(?:\[[^\]]*\])?)/,
  );
  if (!typeMatch) return undefined;

  const candidate = typeMatch[1].trim();
  // If the candidate is '=' it means no type annotation
  return candidate === '=' ? undefined : candidate;
}

/**
 * Scan a multi-line block body (between the opening `{` and matching `}`)
 * starting at lineIndex + 1 in lines[]. Returns { members, endLine }.
 */
function scanBlock(
  lines: string[],
  startLine: number,
): { content: string[]; endLine: number } {
  const content: string[] = [];
  let depth = 1;
  let i = startLine + 1;

  while (i < lines.length && depth > 0) {
    const l = lines[i];
    if (l.includes('{')) depth++;
    if (l.includes('}')) depth--;
    if (depth > 0) content.push(l);
    i++;
  }
  return { content, endLine: i - 1 };
}

function scanEnumMembers(body: string[]): EnumMember[] {
  const members: EnumMember[] = [];
  let autoInt = 0;
  for (const line of body) {
    const trimmed = line.trim().replace(/,\s*$/, '').replace(/\/\/.*$/, '').trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // String value: VARIANT = "..."
    const withString = trimmed.match(/^([A-Z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/);
    if (withString) {
      members.push({ name: withString[1], value: `"${withString[2]}"` });
      continue; // string enums don't auto-increment
    }

    // Integer value: VARIANT = 42
    const withInt = trimmed.match(/^([A-Z_][A-Za-z0-9_]*)\s*=\s*(-?\d+)/);
    if (withInt) {
      autoInt = parseInt(withInt[2], 10);
      members.push({ name: withInt[1], value: autoInt });
      autoInt++;
      continue;
    }

    // Plain variant (auto-increment)
    const plain = trimmed.match(/^([A-Z_][A-Za-z0-9_]*)/);
    if (plain) {
      members.push({ name: plain[1], value: autoInt });
      autoInt++;
    }
  }
  return members;
}

function scanStructFields(body: string[]): StructField[] {
  const fields: StructField[] = [];
  for (const line of body) {
    const trimmed = line.trim().replace(/\/\/.*$/, '').trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // field name(s) then type: "x int" or "x, y int = 0"
    const m = trimmed.match(/^([A-Za-z][A-Za-z0-9_,\s]*?)\s+([\[\^]?[A-Za-z][A-Za-z0-9_\[\]:,\s]*?)(?:\s*=.*)?$/);
    if (!m) continue;

    const names = m[1].split(',').map(n => n.trim()).filter(Boolean);
    const type  = m[2].trim();
    for (const name of names) {
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        fields.push({ name, type });
      }
    }
  }
  return fields;
}

/**
 * Scan document text and extract all declared symbols.
 */
export function scanSymbols(text: string): EzSymbol[] {
  const symbols: EzSymbol[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    let m: RegExpMatchArray | null;

    if ((m = STRUCT_PATTERN.exec(line))) {
      const name = m[1];
      const { content } = scanBlock(lines, i);
      const fields = scanStructFields(content);
      symbols.push({
        name,
        kind: 'struct',
        line: i,
        char: line.indexOf(name),
        declaration: line.trim(),
        structFields: fields,
      });
    } else if ((m = ENUM_PATTERN.exec(line))) {
      const name = m[1];
      const { content } = scanBlock(lines, i);
      const members = scanEnumMembers(content);
      symbols.push({
        name,
        kind: 'enum',
        line: i,
        char: line.indexOf(name),
        declaration: line.trim(),
        enumMembers: members,
      });
    } else if ((m = FUNC_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'function',
        line: i,
        char: line.indexOf(m[1]),
        declaration: line.trim(),
      });
    } else if ((m = MUT_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'variable',
        line: i,
        char: line.indexOf(m[1]),
        declaration: line.trim(),
        type: extractType(line),
      });
    } else if ((m = CONST_VAR_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'constant',
        line: i,
        char: line.indexOf(m[1]),
        declaration: line.trim(),
        type: extractType(line),
      });
    }

    i++;
  }

  return symbols;
}

/**
 * Find the word at the given position in text.
 */
export function wordAt(text: string, position: Position): string {
  const lines = text.split('\n');
  if (position.line >= lines.length) return '';
  const line = lines[position.line];
  const ch = position.character;

  let start = ch;
  let end = ch;
  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) start--;
  while (end < line.length && /[A-Za-z0-9_]/.test(line[end])) end++;

  return line.slice(start, end);
}

/**
 * If the cursor is on `fn` in `module.fn(...)`, return { module, fn }.
 * Returns null if there is no qualifying module prefix.
 */
export function moduleWordAt(
  text: string,
  position: Position,
): { module: string; fn: string } | null {
  const lines = text.split('\n');
  if (position.line >= lines.length) return null;
  const line = lines[position.line];
  const ch = position.character;

  // Find word boundaries at cursor
  let end = ch;
  let start = ch;
  while (end < line.length && /[A-Za-z0-9_]/.test(line[end])) end++;
  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) start--;

  const fn = line.slice(start, end);
  if (!fn) return null;

  // Check if immediately preceded by '.'
  if (start > 0 && line[start - 1] === '.') {
    let modEnd = start - 1;
    let modStart = modEnd;
    while (modStart > 0 && /[A-Za-z0-9_]/.test(line[modStart - 1])) modStart--;
    const mod = line.slice(modStart, modEnd);
    if (mod) return { module: mod, fn };
  }

  return null;
}

/**
 * If the cursor is on a type token that is part of a composite type —
 * an array `[T]`, nested array `[[T]]`, fixed-size array `[T, N]`, or
 * map `map[K:V]` — return the full composite type string.
 * Returns null when the cursor is on a plain identifier outside brackets.
 *
 * Examples:
 *   cursor on `byte`  in `mut x [byte] = {}`       → "[byte]"
 *   cursor on `int`   in `mut m [[int]] = {}`       → "[[int]]"
 *   cursor on `int`   in `const a [int, 5] = {}`    → "[int, 5]"
 *   cursor on `string` in `mut m map[string:int]`   → "map[string:int]"
 *   cursor on `int`   in `mut m map[string:int]`    → "map[string:int]"
 */
export function compositeTypeAt(text: string, position: Position): string | null {
  const lines = text.split('\n');
  if (position.line >= lines.length) return null;
  const line = lines[position.line];
  const ch = position.character;

  // Word boundaries at cursor
  let wStart = ch, wEnd = ch;
  while (wStart > 0 && /[A-Za-z0-9_]/.test(line[wStart - 1])) wStart--;
  while (wEnd < line.length && /[A-Za-z0-9_]/.test(line[wEnd])) wEnd++;
  if (wStart === wEnd) return null;

  // Helper: from an opening '[' position, find the matching ']' and return the
  // full slice including both brackets.
  function matchedBracket(openPos: number): string | null {
    let depth = 0, i = openPos;
    while (i < line.length) {
      if (line[i] === '[') depth++;
      else if (line[i] === ']') { depth--; if (depth === 0) return line.slice(openPos, i + 1); }
      i++;
    }
    return null;
  }

  // Case 1: cursor is immediately to the right of '[', e.g. [byte], [[int]], [int, 5]
  if (wStart > 0 && line[wStart - 1] === '[') {
    // Find the outermost '[' (handles [[int]] where wStart-1 is inner '[')
    let outerLeft = wStart - 1;
    while (outerLeft > 0 && line[outerLeft - 1] === '[') outerLeft--;

    // If preceded by 'map', the type starts at 'map'
    const typeStart = (outerLeft >= 3 && line.slice(outerLeft - 3, outerLeft) === 'map')
      ? outerLeft - 3
      : outerLeft;

    const bracket = matchedBracket(outerLeft);
    if (bracket) return line.slice(typeStart, outerLeft) + bracket;
  }

  // Case 2: cursor is on the value side of map[K:V] (e.g. on 'int' in map[string:int])
  const prefix = line.slice(0, wStart);
  const mapIdx = prefix.lastIndexOf('map[');
  if (mapIdx !== -1) {
    // Verify no unmatched ']' between 'map[' and cursor (would mean we've left the map type)
    const between = prefix.slice(mapIdx + 4);
    const opens  = (between.match(/\[/g) || []).length;
    const closes = (between.match(/\]/g) || []).length;
    if (opens === closes) {
      const bracket = matchedBracket(mapIdx + 3); // '[' is at mapIdx+3
      if (bracket) return 'map' + bracket;
    }
  }

  return null;
}

/**
 * Given a word and a set of symbols, find the first declaration location.
 */
export function findDeclaration(word: string, symbols: EzSymbol[], uri: string): Location | null {
  const sym = symbols.find(s => s.name === word);
  if (!sym) return null;
  return {
    uri,
    range: {
      start: { line: sym.line, character: sym.char },
      end:   { line: sym.line, character: sym.char + sym.name.length },
    },
  };
}
