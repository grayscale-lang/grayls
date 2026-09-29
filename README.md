# grayls — Grayscale Language Server

A Language Server Protocol (LSP) implementation for the [Grayscale programming language](https://github.com/grayscale-lang/Grayscale).

## Features

- **Diagnostics** — inline errors and warnings powered by `gray`
- **Completion** — keywords, types, builtins, stdlib modules, and in-file symbols
- **Hover docs** — documentation for all Grayscale keywords, types, and builtins
- **Go to definition** — jump to variable, `const`, function (`do`/`fn`), `struct`, `enum`, and `alias` declarations within the current file

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later (Zed and other editors only; VS Code does not need it)
- `gray` on your `$PATH` (required for diagnostics — all other features work without it), kept up to date with `gray update`

grayls always runs whichever `gray` comes first on your `$PATH`, typically the installed release. It does not look for a `gray` built from a local checkout of the Grayscale repo. If you build the compiler yourself, put that build first on your `$PATH` (for example `export PATH="/path/to/Grayscale:$PATH"`, where `/path/to/Grayscale` contains the built `gray`), then restart your editor.

An out-of-date `gray` reports newer syntax as errors. For example, a release from before `;` separators were added flags every `;` as an error.

Verify both:

```sh
node --version
gray 
```

---

## Editor Setup

### VS Code

1. Download `grayls.vsix` from the [latest release](https://github.com/grayscale-lang/grayls/releases).
2. In VS Code, open **Extensions → ⋯ → Install from VSIX…** and select the file. Or run `code --install-extension grayls.vsix`.
3. Open a `.gray` file. The extension activates automatically.

To update, download the newest `grayls.vsix` and install it the same way, then reload VS Code (`Cmd+Shift+P` → **Reload Window**).

---

### Zed

Zed needs a small dev extension (the `zed-extension/` folder of this repo) for the Grayscale language, syntax highlighting, and the language server. Zed compiles it, so [Rust](https://www.rust-lang.org/tools/install) must be installed via `rustup`.

1. Clone this repo:
   ```sh
   git clone https://github.com/grayscale-lang/grayls
   ```
2. In Zed, press `Cmd+Shift+P` → **"zed: install dev extension"** and select the `zed-extension/` folder inside the clone.
3. Wait ~30 seconds for Zed to compile the extension.
4. Open a `.gray` file.

The first time you open a `.gray` file, the extension downloads `server.js` from the latest [grayls release](https://github.com/grayscale-lang/grayls/releases) and runs it with your `node`. Node.js v18 or later must be on your `PATH`. Later releases are picked up automatically; you only reinstall the extension if the `zed-extension/` folder changes.

To confirm the server is running: `Cmd+Shift+P` → **"zed: open log"**, search for `grayls`.

### Other editors

Each release also includes `server.js`. Any editor that can launch a language server over stdio can use it: download `server.js` and run `node server.js --stdio`.

---

## Try It Out

Once your editor is set up, open [`main.gray`](main.gray) from the root of this repo (download it from GitHub if you only installed the extension). It is a single file that exercises everything grayls and the tree-sitter grammar support: syntax highlighting for every kind of token, hover docs for keywords, builtins, standard library functions and your own symbols, completion, go to definition, and diagnostics. The comments in the file point out what to try.

---

## How Diagnostics Work

On every file open, change, and save, grayls writes the buffer to a temp file and runs:

```sh
gray check /tmp/gray-lsp-XXXX.gray
```

The output is parsed for error and warning lines of the form:

```
error[E3018]: type mismatch in 'when'; comparing 'i64' with 'string'
  --> myfile.gray:42:10
```

Each becomes an inline diagnostic at the correct line and column, debounced 300 ms.

If `gray` is not on your `$PATH`, diagnostics are silently skipped — completion, hover, and go to definition still work.

The `gray` that runs is the first one on your `$PATH`, so diagnostics match that compiler's version. See [Prerequisites](#prerequisites).

---

## Project Structure

```
grayls/
  src/
    extension.ts          VS Code extension entry point
    server.ts             LSP server (stdio transport)
    features/
      diagnostics.ts      gray integration + output parser
      completion.ts       keyword / type / builtin / symbol completion
      hover.ts            hover docs for keywords, types, builtins, symbols
      definition.ts       go-to-definition (single-file)
    utils/
      gray-data.ts        all Grayscale keywords, types, builtins, and docs
      symbols.ts          in-file symbol scanner
  zed-extension/          Zed dev extension (registers Grayscale language + grayls)
  package.json
  tsconfig.json
```
