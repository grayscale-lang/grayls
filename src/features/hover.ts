import {
  Hover,
  HoverParams,
  MarkupKind,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DOCS, MODULE_FUNCTION_DOCS } from '../utils/gray-data';
import {
  attributeAt,
  wordAt,
  moduleWordAt,
  compositeTypeAt,
  scanSymbols,
  GraySymbol,
} from '../utils/symbols';

// ---------------------------------------------------------------------------
// Composite type rendering  ([T], [[T]], [T,N], map[K:V])
// ---------------------------------------------------------------------------

function renderCompositeType(typeStr: string): string {
  // Map
  if (typeStr.startsWith('map[')) {
    const inner = typeStr.slice(4, -1); // strip 'map[' and trailing ']'
    const colonIdx = inner.indexOf(':');
    if (colonIdx !== -1) {
      const key = inner.slice(0, colonIdx).trim();
      const val = inner.slice(colonIdx + 1).trim();
      return `**Map** \`${typeStr}\`\n\nKey type: \`${key}\`  →  Value type: \`${val}\``;
    }
    return `**Map** \`${typeStr}\``;
  }

  // Fixed-size array: [T, N]
  const fixedMatch = typeStr.match(/^\[([A-Za-z][A-Za-z0-9_]*),\s*(\d+)\]$/);
  if (fixedMatch) {
    return `**Fixed-size array** \`${typeStr}\`\n\nElement type: \`${fixedMatch[1]}\`  Size: ${fixedMatch[2]}`;
  }

  // Dynamic array (possibly nested): [T] or [[T]] etc.
  let inner = typeStr;
  let depth = 0;
  while (inner.startsWith('[') && inner.endsWith(']')) {
    inner = inner.slice(1, -1);
    depth++;
  }
  if (depth === 1) return `**Array** \`${typeStr}\`\n\nElement type: \`${inner}\``;
  return `**${depth}D array** \`${typeStr}\`\n\nElement type: \`${inner}\``;
}

// ---------------------------------------------------------------------------
// User symbol rendering
// ---------------------------------------------------------------------------

function renderEnum(sym: GraySymbol): string {
  const header = `**Enum** \`${sym.name}\`\n\n`;
  if (!sym.enumMembers || sym.enumMembers.length === 0) {
    return header + `\`\`\`gray\n${sym.declaration}\n\`\`\``;
  }
  const rows = sym.enumMembers
    .map(m => `| \`${m.name}\` | ${m.value} |`)
    .join('\n');
  return header + `| Variant | Value |\n|---------|-------|\n${rows}`;
}

function renderStruct(sym: GraySymbol): string {
  const header = `**Struct** \`${sym.name}\`\n\n`;
  if (!sym.structFields || sym.structFields.length === 0) {
    return header + `\`\`\`gray\n${sym.declaration}\n\`\`\``;
  }
  const rows = sym.structFields
    .map(f => `| \`${f.name}\` | \`${f.type}\` |`)
    .join('\n');
  return header + `| Field | Type |\n|-------|------|\n${rows}`;
}

function renderVariable(sym: GraySymbol): string {
  const kindLabel = sym.kind === 'constant' ? 'Constant' : 'Variable';
  const typeInfo  = sym.type ? ` \`${sym.type}\`` : '';
  return `**${kindLabel}**${typeInfo} \`${sym.name}\`\n\n\`\`\`gray\n${sym.declaration}\n\`\`\``;
}

// ---------------------------------------------------------------------------
// Main hover handler
// ---------------------------------------------------------------------------

export function provideHover(
  params: HoverParams,
  documents: TextDocuments<TextDocument>,
): Hover | null {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text = doc.getText();

  // 1. Composite type: [T], [[T]], [T,N], map[K:V]
  const composite = compositeTypeAt(text, params.position);
  if (composite) {
    return {
      contents: { kind: MarkupKind.Markdown, value: renderCompositeType(composite) },
    };
  }

  // 2. Attribute: #doc, #json, #flags, #strict, #discard
  const attr = attributeAt(text, params.position);
  if (attr && DOCS[attr]) {
    return {
      contents: { kind: MarkupKind.Markdown, value: DOCS[attr] },
    };
  }

  // 3. Module function: arrays.append, math.sqrt, etc.
  const modWord = moduleWordAt(text, params.position);
  if (modWord) {
    const key = `${modWord.module}.${modWord.fn}`;
    if (MODULE_FUNCTION_DOCS[key]) {
      return {
        contents: { kind: MarkupKind.Markdown, value: MODULE_FUNCTION_DOCS[key] },
      };
    }
  }

  const word = wordAt(text, params.position);
  if (!word) return null;

  // 4. Static docs: keywords, primitive types, builtins, module names
  if (DOCS[word]) {
    return {
      contents: { kind: MarkupKind.Markdown, value: DOCS[word] },
    };
  }

  // 5. User-defined symbols
  const symbols = scanSymbols(text);
  const sym = symbols.find(s => s.name === word);
  if (!sym) return null;

  let value: string;
  switch (sym.kind) {
    case 'enum':     value = renderEnum(sym);    break;
    case 'struct':   value = renderStruct(sym);  break;
    case 'function': value = `**Function** \`${sym.name}\`\n\n\`\`\`gray\n${sym.declaration}\n\`\`\``; break;
    default:         value = renderVariable(sym);
  }

  return {
    contents: { kind: MarkupKind.Markdown, value },
  };
}
