import { Position, Location } from 'vscode-languageserver/node';

export interface EnumMember {
  name: string;
  value: number | string;
  /** Payload types for a tagged variant, e.g. ['float', 'float'] for Rect(float, float). */
  payload?: string[];
}

export interface FuncParam {
  name: string;
  type: string;
  /** Default value expression, when the parameter declares one. */
  default?: string;
}

export interface StructField {
  name: string;
  type: string;
  /** Default value expression, when the field declares one. */
  default?: string;
}

export interface GraySymbol {
  name: string;
  kind: 'variable' | 'constant' | 'function' | 'struct' | 'enum' | 'alias';
  line: number;   // 0-indexed
  char: number;   // 0-indexed, start of the name
  declaration: string; // full declaration line text
  type?: string;           // parsed Grayscale type for mut/const declarations
  enumMembers?: EnumMember[];
  structFields?: StructField[];
  params?: FuncParam[];
  /** Return signature as written, e.g. `int` or `(quotient int, remainder int)`. */
  returns?: string;
}

// Single-line declaration patterns
const MUT_PATTERN    = /^\s*mut\s+([A-Za-z][A-Za-z0-9_]*)/;
const CONST_VAR_PATTERN = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+(?!struct\b|enum\b)/;
const FUNC_PATTERN   = /^\s*(?:private\s+)?(?:do|fn|func)\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/;
// Keyword-less variable declaration: `mut` is optional, so `count int = 0` and
// `name, other int` are declarations. A type token is required after the name —
// the fully-inferred form (`name = expr`) is indistinguishable from a plain
// assignment and is left to the assignment path.
const BARE_VAR_PATTERN = /^\s*(?:private\s+)?((?:[A-Za-z][A-Za-z0-9_]*\s*,\s*)*[A-Za-z][A-Za-z0-9_]*)\s+(\[|\^|map\b|[A-Za-z][A-Za-z0-9_]*)/;
// Line-leading words that start a statement, never a keyword-less declaration.
const NON_DECL_HEADS = new Set([
  'return', 'for', 'for_each', 'if', 'when', 'switch', 'otherwise', 'else', 'or',
  'elif', 'is', 'case', 'default', 'break', 'continue', 'loop', 'while',
  'as_long_as', 'import', 'use', 'using', 'ensure', 'defer', 'new', 'and',
  'const', 'mut', 'do', 'fn', 'func', 'alias', 'private', 'range', 'cast',
  'in', 'not_in', 'println', 'print', 'eprintln', 'eprint',
]);
const STRUCT_PATTERN = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+struct\b/;
const ENUM_PATTERN   = /^\s*const\s+([A-Za-z][A-Za-z0-9_]*)\s+enum\b/;
const ALIAS_PATTERN  = /^\s*(?:private\s+)?alias\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/;
// Tagged-enum destructuring: `is Shape.Circle(radius)` or `is .Circle(radius)`
const IS_PATTERN     = /^\s*(?:is|case)\s+(?:([A-Za-z][A-Za-z0-9_]*)\s*)?\.([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/;

/**
 * Extract the declared Grayscale type from a `mut` or `const` line.
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
 * Extract the type token from the text immediately following a keyword-less
 * declaration's name list (e.g. ` int = 0`, ` [byte]`, ` map[string:int]`).
 */
function extractTypeAfter(afterNames: string): string | undefined {
  const s = afterNames.trim();
  const mt = s.match(
    /^(\[\[.*?\]\]|\[.*?\]|map\[[^\]]*\]|\^?[A-Za-z][A-Za-z0-9_]*(?:\[[^\]]*\])?)/,
  );
  return mt ? mt[1].trim() : undefined;
}

/**
 * Split a parameter or argument list on top-level commas, ignoring commas
 * nested inside brackets, parens, or string literals.
 */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      current += c;
      if (c === '\\') { current += text[++i] ?? ''; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; current += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += c;
  }
  if (current.trim()) parts.push(current);
  return parts.map(p => p.trim()).filter(Boolean);
}

/**
 * Parse a function parameter list into names, types, and defaults.
 *
 * Handles grouped names sharing a type (`a, b int`), defaults
 * (`port int = 8080`), reference params (`&buf [byte]`), wildcard types
 * (`x ?`), and type parameters (`T <?>`).
 */
function parseParams(list: string): FuncParam[] {
  const params: FuncParam[] = [];
  // Grouped names only bind to the next part that carries a type, so collect
  // bare names until one is found.
  let pending: string[] = [];

  for (const part of splitTopLevel(list)) {
    let decl = part;
    let def: string | undefined;
    const eq = part.search(/=(?!=)/);
    if (eq !== -1) {
      decl = part.slice(0, eq).trim();
      def = part.slice(eq + 1).trim() || undefined;
    }

    const bare = decl.replace(/^&\s*/, '').trim();
    const m = bare.match(/^([A-Za-z][A-Za-z0-9_]*)\s+(.+)$/);
    if (!m) {
      // A name with no type yet: part of a group like `a, b int`.
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(bare)) pending.push(bare);
      continue;
    }

    const type = m[2].trim();
    for (const name of [...pending, m[1]]) {
      params.push(def === undefined ? { name, type } : { name, type, default: def });
    }
    pending = [];
  }
  return params;
}

/**
 * Split a function declaration into its parameter list and return signature.
 */
function parseSignature(line: string): { params: FuncParam[]; returns?: string } {
  const open = line.indexOf('(');
  if (open === -1) return { params: [] };

  let depth = 0;
  let close = -1;
  for (let i = open; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close === -1) return { params: [] };

  const params = parseParams(line.slice(open + 1, close));
  const arrow = line.indexOf('->', close);
  if (arrow === -1) return { params };

  // The return signature ends at the `{` that opens the body. Return types
  // never contain braces, so the first one is always the body.
  let tail = line.slice(arrow + 2);
  const brace = tail.indexOf('{');
  if (brace !== -1) tail = tail.slice(0, brace);
  const returns = tail.trim();
  return { params, returns: returns || undefined };
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

    // Tagged variant with a payload: VARIANT(T) or VARIANT(T, U)
    const tagged = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    if (tagged) {
      const payload = tagged[2].split(',').map(t => t.trim()).filter(Boolean);
      members.push({ name: tagged[1], value: autoInt, payload });
      autoInt++;
      continue;
    }

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
  // Depth relative to the struct body, so nested struct-function bodies are skipped.
  let depth = 0;

  for (const line of body) {
    const trimmed = line.trim().replace(/\/\/.*$/, '').trim();
    const opens  = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    if (depth === 0 && trimmed && !trimmed.startsWith('#')) {
      // Split off a default value at the first `=` that is not part of `==`.
      let decl = trimmed;
      let def: string | undefined;
      const eq = trimmed.search(/=(?!=)/);
      if (eq !== -1) {
        decl = trimmed.slice(0, eq).trim();
        def  = trimmed.slice(eq + 1).trim().replace(/,$/, '').trim() || undefined;
      }

      // `name` or `name, name, ...` followed by the shared type.
      const m = decl.match(
        /^((?:[A-Za-z][A-Za-z0-9_]*\s*,\s*)*)([A-Za-z][A-Za-z0-9_]*)\s+([\[\^]?[A-Za-z][A-Za-z0-9_\[\]:,\s\^]*)$/,
      );
      if (m) {
        const names = (m[1] + m[2]).split(',').map(n => n.trim()).filter(Boolean);
        const type  = m[3].trim();
        for (const name of names) {
          fields.push(def === undefined ? { name, type } : { name, type, default: def });
        }
      }
    }

    depth += opens - closes;
    if (depth < 0) depth = 0;
  }
  return fields;
}

/**
 * Blank out the contents of raw string literals, preserving every offset so
 * line and column positions stay valid.
 *
 * Raw strings are backtick-delimited and may span lines, so their contents
 * would otherwise be scanned as declarations. Comments, regular strings, and
 * character literals are stepped over so a backtick inside one cannot open a
 * spurious raw string.
 */
function maskRawStrings(text: string): string {
  const out = text.split('');
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
    } else if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
    } else if (c === '`') {
      i++;
      while (i < text.length && text[i] !== '`') {
        if (text[i] !== '\n') out[i] = ' ';
        i++;
      }
      i++;
    } else {
      i++;
    }
  }

  return out.join('');
}

/**
 * Scan document text and extract all declared symbols.
 */
export function scanSymbols(text: string): GraySymbol[] {
  const symbols: GraySymbol[] = [];
  // Match against masked text so raw string contents are never scanned;
  // offsets are preserved, so positions remain valid.
  const lines = maskRawStrings(text).split('\n');
  const sourceLines = text.split('\n');
  // Tagged-enum pattern bindings, resolved to payload types after the scan.
  const bindings: { sym: GraySymbol; enumName?: string; variant: string; index: number }[] = [];

  // Line indices that sit directly in a struct/enum body (field region, not a
  // nested struct-function body). `name type` there is a field, not a
  // keyword-less variable declaration, so BARE_VAR_PATTERN must skip them.
  const fieldRegion = new Set<number>();
  {
    let rel = -1; // -1 = not in a struct/enum block; >=0 = brace depth within it
    for (let j = 0; j < lines.length; j++) {
      const l = lines[j];
      if (rel < 0) {
        if (STRUCT_PATTERN.test(l) || ENUM_PATTERN.test(l)) {
          rel = 0;
          rel += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
        }
        continue;
      }
      if (rel === 1 && !/^\s*(?:private\s+)?(?:do|fn|func)\b/.test(l)) fieldRegion.add(j);
      rel += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      if (rel <= 0) rel = -1;
    }
  }

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
        declaration: sourceLines[i].trim(),
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
        declaration: sourceLines[i].trim(),
        enumMembers: members,
      });
    } else if ((m = IS_PATTERN.exec(line))) {
      const [, enumName, variant, rawBindings] = m;
      let searchFrom = line.indexOf('(', m.index);
      rawBindings.split(',').forEach((raw, index) => {
        const name = raw.trim();
        searchFrom = line.indexOf(name, searchFrom);
        if (!name || name === '_' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return;
        const sym: GraySymbol = {
          name,
          kind: 'variable',
          line: i,
          char: searchFrom,
          declaration: sourceLines[i].trim(),
        };
        symbols.push(sym);
        bindings.push({ sym, enumName, variant, index });
      });
    } else if ((m = ALIAS_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'alias',
        line: i,
        char: line.indexOf(m[1]),
        declaration: sourceLines[i].trim(),
        type: m[2].replace(/\/\/.*$/, '').trim(),
      });
    } else if ((m = FUNC_PATTERN.exec(line))) {
      const sig = parseSignature(line);
      symbols.push({
        name: m[1],
        kind: 'function',
        line: i,
        char: line.indexOf(m[1]),
        declaration: sourceLines[i].trim(),
        params: sig.params,
        returns: sig.returns,
      });
    } else if ((m = MUT_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'variable',
        line: i,
        char: line.indexOf(m[1]),
        declaration: sourceLines[i].trim(),
        type: extractType(line),
      });
    } else if ((m = CONST_VAR_PATTERN.exec(line))) {
      symbols.push({
        name: m[1],
        kind: 'constant',
        line: i,
        char: line.indexOf(m[1]),
        declaration: sourceLines[i].trim(),
        type: extractType(line),
      });
    } else if (!fieldRegion.has(i) && (m = BARE_VAR_PATTERN.exec(line))) {
      const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
      if (!NON_DECL_HEADS.has(names[0])) {
        const type = extractTypeAfter(line.slice(line.indexOf(m[1]) + m[1].length));
        for (const name of names) {
          symbols.push({
            name,
            kind: 'variable',
            line: i,
            char: line.indexOf(name),
            declaration: sourceLines[i].trim(),
            type,
          });
        }
      }
    }

    i++;
  }

  // Resolve destructured payload types now that every enum has been scanned.
  for (const b of bindings) {
    const enums = symbols.filter(
      sym => sym.kind === 'enum' && (b.enumName === undefined || sym.name === b.enumName),
    );
    for (const e of enums) {
      const member = e.enumMembers?.find(mem => mem.name === b.variant);
      if (member?.payload && member.payload[b.index]) {
        b.sym.type = member.payload[b.index];
        break;
      }
    }
  }

  return symbols;
}

/**
 * If the cursor is on the variant of an implicit enum selector (`.NORTH`),
 * return the variant name. Returns null when the dot is a member access on a
 * value or module (`Direction.NORTH`, `strings.to_upper`).
 */
export function implicitVariantAt(text: string, position: Position): string | null {
  const lines = text.split('\n');
  if (position.line >= lines.length) return null;
  const line = lines[position.line];
  const ch = position.character;

  let start = ch;
  let end = ch;
  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) start--;
  while (end < line.length && /[A-Za-z0-9_]/.test(line[end])) end++;
  if (start === end) return null;
  if (start === 0 || line[start - 1] !== '.') return null;
  // A preceding identifier or `)`/`]` makes this a member access, not a selector.
  if (start >= 2 && /[A-Za-z0-9_)\]]/.test(line[start - 2])) return null;

  return line.slice(start, end);
}

/**
 * If the cursor is on a wildcard type, return its doc key.
 *
 * Returns `'<?>'` when the cursor sits inside a `<?>` type-parameter
 * annotation, `'?'` for a bare wildcard type, and null otherwise.
 */
export function wildcardAt(text: string, position: Position): string | null {
  const lines = text.split('\n');
  if (position.line >= lines.length) return null;
  const line = lines[position.line];
  const ch = position.character;

  // The cursor may sit on either side of the character it refers to.
  for (const i of [ch, ch - 1]) {
    if (i < 0 || i >= line.length || line[i] !== '?') continue;
    if (line[i - 1] === '<' && line[i + 1] === '>') return '<?>';
    return '?';
  }
  return null;
}

/**
 * If the cursor is on an attribute name, return the attribute key including the
 * hash (e.g. `#discard`). Handles both the stacked form (`#discard`) and the
 * single-line container form (`#[doc("x"), json]`). Returns null otherwise.
 */
export function attributeAt(text: string, position: Position): string | null {
  const lines = text.split('\n');
  if (position.line >= lines.length) return null;
  const line = lines[position.line];
  const ch = position.character;

  let start = ch;
  let end = ch;
  while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) start--;
  while (end < line.length && /[A-Za-z0-9_]/.test(line[end])) end++;
  if (start === end) return null;

  // Stacked form: name immediately preceded by `#`.
  if (line[start - 1] === '#') return '#' + line.slice(start, end);

  // Container form: `#[a, b, c]` — the name sits inside a `#[ ... ]` group,
  // reachable by scanning left past identifiers, commas, whitespace, and
  // balanced `(...)` argument groups until a `[` preceded by `#`.
  let i = start - 1;
  let depth = 0;
  while (i >= 0) {
    const c = line[i];
    if (c === ')') depth++;
    else if (c === '(') { if (depth === 0) return null; depth--; }
    else if (depth === 0) {
      if (c === '[') return line[i - 1] === '#' ? '#' + line.slice(start, end) : null;
      if (!/[A-Za-z0-9_,\s".]/.test(c)) return null;
    }
    i--;
  }
  return null;
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
export function findDeclaration(word: string, symbols: GraySymbol[], uri: string): Location | null {
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
