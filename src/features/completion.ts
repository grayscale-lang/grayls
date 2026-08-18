import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { KEYWORDS, TYPES, BUILTINS, STDLIB_MODULES, ATTRIBUTES, DOCS } from '../utils/gray-data';
import { scanSymbols } from '../utils/symbols';

// Pre-built static completion lists (created once)
const KEYWORD_ITEMS: CompletionItem[] = KEYWORDS.map(k => ({
  label: k,
  kind: CompletionItemKind.Keyword,
  detail: 'keyword',
  documentation: DOCS[k],
}));

const TYPE_ITEMS: CompletionItem[] = TYPES.map(t => ({
  label: t,
  kind: CompletionItemKind.TypeParameter,
  detail: 'type',
  documentation: DOCS[t],
}));

const BUILTIN_ITEMS: CompletionItem[] = BUILTINS.map(b => ({
  label: b,
  kind: CompletionItemKind.Function,
  detail: 'builtin',
  documentation: DOCS[b],
}));

const ATTRIBUTE_ITEMS: CompletionItem[] = ATTRIBUTES.map(a => ({
  label: `#${a}`,
  kind: CompletionItemKind.Property,
  detail: 'attribute',
  documentation: DOCS[`#${a}`],
  filterText: a,
  insertText: a,
}));

const MODULE_ITEMS: CompletionItem[] = STDLIB_MODULES.map(m => ({
  label: m,
  kind: CompletionItemKind.Module,
  detail: 'stdlib module',
  documentation: DOCS[m],
  insertText: m,
}));

// Static items always available
const STATIC_ITEMS: CompletionItem[] = [
  ...KEYWORD_ITEMS,
  ...TYPE_ITEMS,
  ...BUILTIN_ITEMS,
];

function getLinePrefix(doc: TextDocument, params: CompletionParams): string {
  const lines = doc.getText().split('\n');
  const line = lines[params.position.line] ?? '';
  return line.slice(0, params.position.character);
}

export function provideCompletion(
  params: CompletionParams,
  documents: TextDocuments<TextDocument>,
): CompletionItem[] {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const prefix = getLinePrefix(doc, params);

  // Context: after `import @`, `import and use @`, or a comma continuation
  // of either → suggest module names.
  if (/^\s*import\s+(?:and\s+use\s+)?(?:@\w*\s*,\s*)*@\w*$/.test(prefix)) {
    return MODULE_ITEMS;
  }

  // Context: after `#` → suggest attribute names
  if (/#\w*$/.test(prefix)) {
    return ATTRIBUTE_ITEMS;
  }

  // Context: after `import @module using` → still show modules (already picked)
  // For now, just return static items. Module-member completion would need
  // a per-module symbol table which is a follow-up.

  const text = doc.getText();
  const fileSymbols = scanSymbols(text);

  // Context: a bare `.` not preceded by an identifier → implicit enum selector.
  // Offer every variant declared in the file; the compiler resolves the type.
  if (/(?:^|[\s({\[,:=!<>+\-*/])\.\w*$/.test(prefix)) {
    const variantItems: CompletionItem[] = [];
    for (const sym of fileSymbols) {
      if (sym.kind !== 'enum' || !sym.enumMembers) continue;
      for (const mem of sym.enumMembers) {
        const payload = mem.payload && mem.payload.length > 0
          ? `(${mem.payload.join(', ')})`
          : '';
        variantItems.push({
          label: mem.name,
          kind: CompletionItemKind.EnumMember,
          detail: `${sym.name}.${mem.name}${payload}`,
          documentation: payload ? undefined : `= ${mem.value}`,
        });
      }
    }
    if (variantItems.length > 0) return variantItems;
  }

  const symbolItems: CompletionItem[] = fileSymbols.map(sym => ({
    label: sym.name,
    kind: sym.kind === 'function'
      ? CompletionItemKind.Function
      : sym.kind === 'struct'
        ? CompletionItemKind.Struct
        : sym.kind === 'enum'
          ? CompletionItemKind.Enum
          : sym.kind === 'alias'
            ? CompletionItemKind.TypeParameter
            : sym.kind === 'constant'
              ? CompletionItemKind.Constant
              : CompletionItemKind.Variable,
    detail: `${sym.kind} — ${sym.declaration}`,
  }));

  return [...STATIC_ITEMS, ...symbolItems];
}
