import {
  DefinitionParams,
  Location,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { wordAt, moduleWordAt, structFunctionAt, fieldAccessAt, isModuleReference, scanSymbols, findDeclaration } from '../utils/symbols';
import { findStructField } from '../utils/fields';
import { findImportedMember, findStructFunction, resolveLocalImports } from '../utils/imports';
import { findUsedName } from '../utils/using';
import { MODULE_FUNCTION_DOCS } from '../utils/gray-data';

export function provideDefinition(
  params: DefinitionParams,
  documents: TextDocuments<TextDocument>,
): Location | null {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text = doc.getText();
  const word = wordAt(text, params.position);
  if (!word) return null;

  // `Dice.create`, `types.Dice.create`: jump to the struct function.
  const structFn = structFunctionAt(text, params.position);
  if (structFn) {
    const found = findStructFunction(
      text,
      params.textDocument.uri,
      structFn,
      fileUri => documents.get(fileUri)?.getText(),
    );
    if (found) return findDeclaration(word, [found.symbol], found.fileUri);
  }

  // `types.Hero`: jump into the imported file.
  const modWord = moduleWordAt(text, params.position);
  if (modWord) {
    const member = findImportedMember(
      text,
      params.textDocument.uri,
      modWord.module,
      modWord.fn,
      fileUri => documents.get(fileUri)?.getText(),
    );
    if (member) return findDeclaration(word, [member.symbol], member.fileUri);
  }

  // `dice.sides`: jump to the struct field.
  const fieldAccess = fieldAccessAt(text, params.position);
  if (fieldAccess) {
    const found = findStructField(
      text,
      params.textDocument.uri,
      params.position,
      fieldAccess,
      fileUri => documents.get(fileUri)?.getText(),
    );
    if (found) {
      const position = { line: found.line, character: 0 };
      return { uri: found.fileUri, range: { start: position, end: position } };
    }
  }

  // `types` in `types.Hero`, or on its import line: open the module's file.
  const localModule = resolveLocalImports(text, params.textDocument.uri).get(word);
  if (localModule && isModuleReference(text, params.position)) {
    const start = { line: 0, character: 0 };
    return { uri: localModule.files[0], range: { start, end: start } };
  }

  // A bare name from `using` or `import and use`. A stdlib member has no source
  // to jump to.
  const used = findUsedName(
    text,
    params.textDocument.uri,
    params.position,
    word,
    key => key in MODULE_FUNCTION_DOCS,
    fileUri => documents.get(fileUri)?.getText(),
  );
  if (used) {
    return 'stdlibKey' in used ? null : findDeclaration(word, [used.symbol], used.fileUri);
  }

  const symbols = scanSymbols(text);
  return findDeclaration(word, symbols, params.textDocument.uri);
}
