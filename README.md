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
- `gray` on your `$PATH` (required for diagnostics — all other features work without it)

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

### Neovim

#### Prerequisites

Before configuring Neovim, build the server:

```sh
git clone https://github.com/grayscale-lang/grayls
cd grayls
npm install
npm run build
```

This produces `out/server.js`, which is the path you point Neovim at below.
Note the absolute path — the rest of this section refers to it as
`/path/to/grayls/out/server.js`.

You also need Node.js v18+, and `gray` on your `$PATH` for diagnostics. Every
other feature works without it.

#### Step 1: Register the `gray` filetype

Neovim does not know about `.gray` files out of the box. Without this, the
server never attaches:

```lua
vim.filetype.add({ extension = { gray = 'gray' } })
```

#### Step 2: Configure the server

**Neovim 0.11+** (built-in `vim.lsp.config`, no plugin required):

```lua
vim.lsp.config.grayls = {
  cmd = { 'node', '/path/to/grayls/out/server.js', '--stdio' },
  filetypes = { 'gray' },
  root_markers = { '.git' },
}

vim.lsp.enable('grayls')
```

**Older Neovim, via `nvim-lspconfig`:**

```lua
{ "neovim/nvim-lspconfig" }
```

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.grayls then
  configs.grayls = {
    default_config = {
      cmd = { 'node', '/path/to/grayls/out/server.js', '--stdio' },
      filetypes = { 'gray' },
      root_dir = lspconfig.util.root_pattern('.git', '*.gray'),
      single_file_support = true,
    },
  }
end

lspconfig.grayls.setup({})
```

Open a `.gray` file and the server attaches automatically.

#### Step 3: Syntax highlighting (optional)

The language server provides diagnostics, completion, hover, and
go-to-definition — but not syntax highlighting. For that, use the Tree-sitter
grammar at [`grayscale-lang/tree-sitter-gray`](https://github.com/grayscale-lang/tree-sitter-gray).

With `nvim-treesitter` installed, register the parser:

```lua
local parsers = require('nvim-treesitter.parsers').get_parser_configs()

parsers.gray = {
  install_info = {
    url = 'https://github.com/grayscale-lang/tree-sitter-gray',
    files = { 'src/parser.c' },
    branch = 'main',
  },
  filetype = 'gray',
}
```

Then run `:TSInstall gray`.

`nvim-treesitter` does not install queries for third-party parsers, so the
highlight queries have to go on your runtimepath yourself. Copy them from the
grammar repository:

```sh
git clone https://github.com/grayscale-lang/tree-sitter-gray
mkdir -p ~/.config/nvim/queries/gray
cp tree-sitter-gray/queries/highlights.scm ~/.config/nvim/queries/gray/
```

#### Troubleshooting

**Check whether the server attached.** With a `.gray` file open:

```vim
:checkhealth vim.lsp
```

On older versions, use `:LspInfo`. If no client is listed, the filetype is
usually the cause — confirm with `:set filetype?`, which must report `gray`.

**Check the server actually starts.** Run it by hand; it should sit and wait
for input rather than exiting or erroring:

```sh
node /path/to/grayls/out/server.js --stdio
```

If this fails, `out/server.js` is missing or stale — re-run `npm run build`.

**Read the log** for startup errors and crashes:

```vim
:LspLog
```

**No diagnostics, but hover and completion work.** Diagnostics shell out to
`gray`, so it must be on the `$PATH` Neovim inherits. Verify from inside
Neovim, not just your shell:

```vim
:echo exepath('gray')
```

An empty result means Neovim cannot see it.

**After changing server code:** run `npm run build`, then `:LspRestart`.

---

## How Diagnostics Work

On every file open, change, and save, grayls writes the buffer to a temp file and runs:

```sh
gray /tmp/gray-lsp-XXXX.gray
```

The output is parsed for error and warning lines of the form:

```
error[E3018]: type mismatch in 'when'; comparing 'int' with 'string'
  --> myfile.gray:42:10
```

Each becomes an inline diagnostic at the correct line and column, debounced 300 ms.

If `gray` is not on your `$PATH`, diagnostics are silently skipped — completion, hover, and go to definition still work.

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

---

## Developer Guide

This section covers how to extend grayls when the Grayscale language itself changes, or when you want to add new LSP features.

### Adding a new keyword, type, or builtin

All static language data lives in `src/utils/gray-data.ts`. It has three arrays and two doc maps:

| Export | What to update |
|--------|---------------|
| `KEYWORDS` | Add reserved words that appear in control flow or declarations |
| `TYPES` | Add new primitive or sized types |
| `BUILTINS` | Add new builtin functions |
| `STDLIB_MODULES` | Add new `@module` names |
| `DOCS` | Add hover documentation for any of the above |
| `MODULE_FUNCTION_DOCS` | Add hover docs for `module.function` calls |

**Example — adding a new builtin `format`:**

1. Add `'format'` to the `BUILTINS` array
2. Add an entry to `DOCS`:
   ```ts
   'format': '**`format(template string, ...args) -> string`** — Format a string with substitutions.',
   ```

Rebuild (`npm run build`) and reopen a `.gray` file — the new builtin appears in completion and hover immediately.

---

### Adding hover docs for a stdlib function

Add an entry to `MODULE_FUNCTION_DOCS` in `gray-data.ts`. The key is `"module.function"`:

```ts
'arrays.my_new_fn': '**`arrays.my_new_fn(arr [T], n int) -> T`** — Description here.',
```

---

### Updating enum or struct scanning

The scanner lives in `src/utils/symbols.ts`. Two functions handle multi-line bodies:

- `scanEnumMembers(body: string[])` — parses variant names and their values (integer or string)
- `scanStructFields(body: string[])` — parses field names and types

If Grayscale adds a new enum or struct syntax (e.g. associated values, visibility modifiers), update the relevant regex patterns in those functions.

Top-level declaration matching is driven by the `*_PATTERN` regexes at the top of the file. `mut` is optional in Grayscale, so keyword-less declarations (`count int = 0`) are matched by `BARE_VAR_PATTERN`; it requires a type token after the name to stay distinct from a plain assignment, and the `fieldRegion` pre-pass in `scanSymbols` keeps struct/enum field lines from being picked up as variables.

---

### Updating diagnostics parsing

The diagnostic parser is in `src/features/diagnostics.ts`. It uses one regex against `gray` output:

```ts
const DIAG_PATTERN =
  /^(error|warning)\[([EW]\d+)\]:\s+(.+)\n\s+-->\s+[^:]+:(\d+):(\d+)/gm;
```

If `gray`'s error output format changes (e.g. new severity levels, different arrow syntax), update this regex. The capture groups map to: `severity`, `code`, `message`, `line`, `column`.

---

### Adding a new LSP feature

1. Create `src/features/myfeature.ts` and export a `provideX` function that takes `(params, documents)` and returns the appropriate LSP type.

2. Register it in `src/server.ts`:
   ```ts
   import { provideMyFeature } from './features/myfeature';

   // Inside onInitialize, add the capability:
   myFeatureProvider: true,

   // Then register the handler:
   connection.onMyFeature((params) => provideMyFeature(params, documents));
   ```

The [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node) package provides types and handler names for all standard LSP features (semantic tokens, code actions, rename, references, etc.).

---

### Build workflow

```sh
npm run build       # compile TypeScript + bundle with esbuild
npm run compile     # TypeScript only (no bundle) — fast type-check
```

Always rebuild before testing changes. The server binary at `out/server.js` is what all editors load.
