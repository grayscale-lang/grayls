import { Position } from 'vscode-languageserver/node';
import { GraySymbol, scanSymbols } from './symbols';

// A function declaration at the start of a statement.
const FUNCTION_START = /(?<=(?:^|[\n;{}])[ \t]*)(?:private\s+)?(?:unsafe\s+)?(?:do|fn|func)\s+[A-Za-z_]\w*\s*\(/g;

export interface Span {
  start: number;
  end: number;
}

/**
 * Blank out comments and the contents of string and character literals,
 * preserving every offset, so braces and keywords inside them are not read.
 */
export function maskText(text: string): string {
  const out = text.split('');
  const blank = (i: number) => { if (i < text.length && text[i] !== '\n') out[i] = ' '; };

  // Blanks the literal opened at `i` and returns the offset after it.
  function skipLiteral(i: number): number {
    const quote = text[i++];
    while (i < text.length && text[i] !== quote) {
      if (quote !== '`' && text[i] === '\n') return i;
      if (quote !== '`' && text[i] === '\\') {
        blank(i++);
        blank(i++);
      } else if (quote === '"' && text[i] === '$' && text[i + 1] === '{') {
        // An interpolation may hold braces and further strings.
        let depth = 0;
        blank(i++);
        do {
          if (text[i] === '"' || text[i] === "'") { i = skipLiteral(i); continue; }
          if (text[i] === '{') depth++;
          else if (text[i] === '}') depth--;
          blank(i++);
        } while (i < text.length && text[i] !== '\n' && depth > 0);
      } else {
        blank(i++);
      }
    }
    return i + 1;
  }

  let i = 0;
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') blank(i++);
    } else if (text[i] === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      while (i < end) blank(i++);
    } else if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
      i = skipLiteral(i);
    } else {
      i++;
    }
  }
  return out.join('');
}

/** From each function declaration to the brace that closes its body. */
export function functionSpans(masked: string): Span[] {
  return [...masked.matchAll(FUNCTION_START)].map(match => {
    let parens = 0;
    let braces = 0;
    for (let i = match.index!; i < masked.length; i++) {
      const c = masked[i];
      if (c === '(') parens++;
      else if (c === ')') parens--;
      else if (c === '{' && parens <= 0) braces++;
      else if (c === '}' && parens <= 0 && --braces <= 0) return { start: match.index!, end: i };
    }
    return { start: match.index!, end: masked.length };
  });
}

export function offsetAt(text: string, position: Position): number {
  const before = text.split('\n').slice(0, position.line);
  return before.reduce((total, line) => total + line.length + 1, 0) + position.character;
}

/** The symbols of a file that are declared outside every function body. */
export function fileScopeSymbols(text: string): GraySymbol[] {
  const spans = functionSpans(maskText(text));
  // Grayscale has no nested functions, so a function is never a local.
  return scanSymbols(text).filter(symbol => {
    if (symbol.kind === 'function') return true;
    const declared = offsetAt(text, { line: symbol.line, character: symbol.char });
    return !spans.some(s => s.start <= declared && declared <= s.end);
  });
}
