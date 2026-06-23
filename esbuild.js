const esbuild = require('esbuild');

// Bundle the server
esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'out/server.js',
  external: ['vscode'],
  sourcemap: true,
}).catch(() => process.exit(1));

// Bundle the extension
esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'out/extension.js',
  external: ['vscode'],
  sourcemap: true,
}).catch(() => process.exit(1));
