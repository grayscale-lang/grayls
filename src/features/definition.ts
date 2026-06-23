import {
  DefinitionParams,
  Location,
  TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { wordAt, scanSymbols, findDeclaration } from '../utils/symbols';

export function provideDefinition(
  params: DefinitionParams,
  documents: TextDocuments<TextDocument>,
): Location | null {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text = doc.getText();
  const word = wordAt(text, params.position);
  if (!word) return null;

  const symbols = scanSymbols(text);
  return findDeclaration(word, symbols, params.textDocument.uri);
}
