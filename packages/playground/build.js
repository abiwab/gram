const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// 1. Prepare Parser Code (Shimmed)
const grammarPath = path.join(__dirname, '../parser/grammar.ohm');
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');

// Use the COMPILED output from TypeScript
const parserPath = path.join(__dirname, '../parser/dist/index.js');
let parserCode = fs.readFileSync(parserPath, 'utf-8');

// Shim Node.js dependencies and inject grammar
// 1. Remove fs/path imports
parserCode = parserCode.replace(/require\("fs"\)/g, '({})');
parserCode = parserCode.replace(/require\("path"\)/g, '({})');
parserCode = parserCode.replace(/require\("\.\/types"\)/g, '({})');

// 2. Remove file reading logic (assuming variable names match dist output)
// This relies on the emitted JS having "grammarPath" and "grammarContent" variables.
// If they are optimized away or renamed, this might fail.
// We fallback to replacing the fs.readFileSync calls if variables are not found?
// But tsc output usually preserves variable names if they are top-level constants.

parserCode = parserCode.replace(/const grammarPath = .*/, '// grammarPath suppressed');
parserCode = parserCode.replace(/const grammarContent = .*/, `const grammarContent = ${JSON.stringify(grammarContent)};`);

// 3. Remove/Fix unused imports?
// gram-parser now only exports types and getAST. No internal compiler import to fix.

const shimmedParserPath = path.join(__dirname, 'src/shimmed-gram-parser.js');
fs.writeFileSync(shimmedParserPath, parserCode);

// 2. Build App & CSS
esbuild.build({
  entryPoints: ['src/app.js', 'src/style.css'],
  bundle: true,
  outdir: 'dist',
  minify: true,
  sourcemap: true,
  alias: {
      'gram-parser': shimmedParserPath,
      'gram-compiler': path.resolve(__dirname, '../compiler/dist/index.js')
  }
}).then(() => {
    console.log('Build successful!');
    fs.unlinkSync(shimmedParserPath);
}).catch((e) => {
    console.error(e);
    process.exit(1);
});
