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
  implicitVariantAt,
  wildcardAt,
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
  const tagged = sym.enumMembers.some(m => m.payload && m.payload.length > 0);

  if (tagged) {
    const rows = sym.enumMembers
      .map(m => `| \`${m.name}\` | ${m.payload && m.payload.length > 0 ? `\`${m.payload.join(', ')}\`` : '—'} |`)
      .join('\n');
    return `**Tagged enum** \`${sym.name}\`\n\n| Variant | Payload |\n|---------|---------|\n${rows}`;
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
  const hasDefaults = sym.structFields.some(f => f.default !== undefined);

  if (hasDefaults) {
    const rows = sym.structFields
      .map(f => `| \`${f.name}\` | \`${f.type}\` | ${f.default !== undefined ? `\`${f.default}\`` : '—'} |`)
      .join('\n');
    return header + `| Field | Type | Default |\n|-------|------|---------|\n${rows}`;
  }

  const rows = sym.structFields
    .map(f => `| \`${f.name}\` | \`${f.type}\` |`)
    .join('\n');
  return header + `| Field | Type |\n|-------|------|\n${rows}`;
}

function renderFunction(sym: GraySymbol): string {
  const header = `**Function** \`${sym.name}\`\n\n\`\`\`gray\n${sym.declaration}\n\`\`\``;
  if (!sym.params || sym.params.length === 0) return header;

  const rows = sym.params
    .map(p => `| \`${p.name}\` | \`${p.type}\` | ${p.default !== undefined ? `\`${p.default}\`` : '—'} |`)
    .join('\n');

  // Parameter names double as named-argument labels at the call site.
  const example = sym.params.map(p => `${p.name}: ...`).join(', ');

  return `${header}\n\n| Parameter | Type | Default |\n|-----------|------|---------|\n${rows}\n\nCallable with named arguments:\n\n\`\`\`gray\n${sym.name}(${example})\n\`\`\``;
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

  // 2. Wildcard type `?` / type parameter `<?>`
  const wildcard = wildcardAt(text, params.position);
  if (wildcard && DOCS[wildcard]) {
    return {
      contents: { kind: MarkupKind.Markdown, value: DOCS[wildcard] },
    };
  }

  // 3. Attribute: #doc, #json, #flags, #strict, #discard
  const attr = attributeAt(text, params.position);
  if (attr && DOCS[attr]) {
    return {
      contents: { kind: MarkupKind.Markdown, value: DOCS[attr] },
    };
  }

  // 4. Module function: arrays.append, math.sqrt, etc.
  const modWord = moduleWordAt(text, params.position);
  if (modWord) {
    const key = `${modWord.module}.${modWord.fn}`;
    if (MODULE_FUNCTION_DOCS[key]) {
      return {
        contents: { kind: MarkupKind.Markdown, value: MODULE_FUNCTION_DOCS[key] },
      };
    }
    // C interop: any `c.` member resolves to the imported C header.
    if (modWord.module === 'c') {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**\`c.${modWord.fn}\`** \u2014 C function or constant, resolved by the C compiler from the imported headers.\n\nReturn types are inferred by the C compiler. Annotate the variable when Grayscale needs to know the type:\n\n\`\`\`gray\nmut x float = c.sqrt(2.0)\n\`\`\``,
        },
      };
    }
  }

  // 5. Implicit enum selector: `.NORTH`
  const variant = implicitVariantAt(text, params.position);
  if (variant) {
    const owners = scanSymbols(text).filter(
      sym => sym.kind === 'enum' && sym.enumMembers?.some(mem => mem.name === variant),
    );
    if (owners.length > 0) {
      const body = owners
        .map(owner => {
          const mem = owner.enumMembers!.find(m => m.name === variant)!;
          const payload = mem.payload && mem.payload.length > 0 ? `(${mem.payload.join(', ')})` : '';
          return `\`${owner.name}.${variant}${payload}\`${payload ? '' : ` = ${mem.value}`}`;
        })
        .join('\n\n');
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**Enum variant** \`.${variant}\`\n\n${body}\n\nImplicit selector \u2014 the enum type is inferred from context.`,
        },
      };
    }
  }

  const word = wordAt(text, params.position);
  if (!word) return null;

  // 6. Static docs: keywords, primitive types, builtins, module names
  if (DOCS[word]) {
    return {
      contents: { kind: MarkupKind.Markdown, value: DOCS[word] },
    };
  }

  // 7. User-defined symbols
  const symbols = scanSymbols(text);
  const sym = symbols.find(s => s.name === word);
  if (!sym) return null;

  let value: string;
  switch (sym.kind) {
    case 'enum':     value = renderEnum(sym);    break;
    case 'struct':   value = renderStruct(sym);  break;
    case 'function': value = renderFunction(sym); break;
    case 'alias':    value = `**Type alias** \`${sym.name}\` → \`${sym.type ?? '?'}\`\n\n\`\`\`gray\n${sym.declaration}\n\`\`\``; break;
    default:         value = renderVariable(sym);
  }

  return {
    contents: { kind: MarkupKind.Markdown, value },
  };
}
