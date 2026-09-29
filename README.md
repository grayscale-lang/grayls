# grayls — Grayscale Language Server

A Language Server Protocol (LSP) implementation for the [Grayscale programming language](https://github.com/grayscale-lang/Grayscale).

## Features

- **Diagnostics** — inline errors and warnings powered by `gray`
- **Completion** — keywords, types, builtins, stdlib modules, and in-file symbols
- **Hover docs** — documentation for all Grayscale keywords, types, and builtins
- **Go to definition** — jump to variable, `const`, function (`do`/`fn`), `struct`, `enum`, and `alias` declarations within the current file

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- `gray` on your `$PATH` (required for diagnostics — all other features work without it), kept up to date with `gray update`

grayls always runs whichever `gray` comes first on your `$PATH`, typically the installed release. It does not look for a `gray` built from a local checkout of the Grayscale repo. If you build the compiler yourself, put that build first on your `$PATH` (for example `export PATH="/path/to/Grayscale:$PATH"`, where `/path/to/Grayscale` contains the built `gray`), then restart your editor.

An out-of-date `gray` reports newer syntax as errors. For example, a release from before `;` separators were added flags every `;` as an error.

Verify both:

```sh
node --version
gray 
```

---

## Build

```sh
git clone https://github.com/grayscale-lang/grayls
cd grayls
npm install
npm run build
```

The compiled server lands in `out/server.js`.

---

## Editor Setup

### VS Code

Install the extension once as a `.vsix` package. After that it activates automatically whenever you open a `.gray` file — no extra steps.

```sh
cd /path/to/grayls
npm install -g @vscode/vsce
npm run build
vsce package          # produces grayls-0.1.0.vsix
code --install-extension grayls-0.1.0.vsix
```

Or install via the VS Code UI: **Extensions → ⋯ → Install from VSIX…**

**After updating server code:** rebuild and reinstall:

```sh
npm run build && vsce package && code --install-extension grayls-0.1.0.vsix
```

Then reload VS Code (`Cmd+Shift+P` → **Reload Window**).

> **For extension development only:** press **F5** in the grayls folder to open an Extension Development Host window. This is for debugging the extension itself, not for daily use.

---

### Zed

Zed requires a small dev extension (in the `zed-extension/` folder of this repo) to register the Grayscale language and syntax highlighting.

**Step 1:** Build grayls:

```sh
npm run build
```

**Step 2:** Install the dev extension in Zed:

- `Cmd+Shift+P` → **"zed: install dev extension"**
- Select the `zed-extension/` folder inside this repo
- Wait ~30 seconds for Zed to compile the Rust extension

The extension auto-detects your node installation (NVM or Homebrew) and assumes grayls is cloned to `~/code/grayls`.

**Step 3 (only if grayls is cloned somewhere other than `~/code/grayls`):** Override the server path in `~/.config/zed/settings.json`:

```json
{
  "lsp": {
    "grayls": {
      "binary": {
        "path": "node",
        "arguments": ["/absolute/path/to/grayls/out/server.js", "--stdio"]
      }
    }
  }
}
```

> **Important:** Use the full absolute path — do not use `~`.

Zed spawns the server automatically when you open any `.gray` file. No `.zed/settings.json` is needed in your project — the extension handles language registration.

**After updating server code:** run `npm run build`, then close and reopen the `.gray` file.

To confirm the server is running: `Cmd+Shift+P` → **"zed: open log"**, search for `grayls`.

---

## Try It Out

Once your editor is set up, open [`main.gray`](main.gray) in the root of this repo. It is a single file that exercises everything grayls and the tree-sitter grammar support: syntax highlighting for every kind of token, hover docs for keywords, builtins, standard library functions and your own symbols, completion, go to definition, and diagnostics. The comments in the file point out what to try.

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
  out/                    compiled output (generated by npm run build)
  package.json
  tsconfig.json
```
