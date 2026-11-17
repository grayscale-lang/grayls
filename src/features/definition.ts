import {
  DefinitionParams,
  Location,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { wordAt, moduleWordAt, structFunctionAt, scanSymbols, findDeclaration } from '../utils/symbols';
import { findImportedMember, findStructFunction } from '../utils/imports';

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

  const symbols = scanSymbols(text);
  return findDeclaration(word, symbols, params.textDocument.uri);
}
