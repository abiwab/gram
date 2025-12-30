const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// 1. Prepare Parser Code
const grammarPath = path.join(__dirname, '../gram-parser/grammar.ohm');
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');

// Use the COMPILED output from TypeScript
const parserPath = path.join(__dirname, '../gram-parser/dist/index.js');
let parserCode = fs.readFileSync(parserPath, 'utf-8');

// Shim Node.js dependencies and inject grammar
// 1. Remove fs/path imports
parserCode = parserCode.replace(/require\("fs"\)/g, '({})');
parserCode = parserCode.replace(/require\("path"\)/g, '({})');

// 2. Remove file reading logic
parserCode = parserCode.replace(/const grammarPath = .*/, '// grammarPath suppressed');
parserCode = parserCode.replace(/const grammarContent = .*/, `const grammarContent = ${JSON.stringify(grammarContent)};`);

// 3. Fix relative import for compiler
// In dist/index.js it requires "./compiler/index"
// We need to point to the actual file location relative to playground/src/
parserCode = parserCode.replace(/require\("\.\/compiler\/index"\)/, `require('../../gram-parser/dist/compiler/index.js')`);

const newParserCode = parserCode;

const generatedParserPath = path.join(__dirname, 'src/generated-parser.js');
fs.writeFileSync(generatedParserPath, newParserCode);

// 2. Build App & CSS
esbuild.build({
  entryPoints: ['src/app.js', 'src/style.css'],
  bundle: true,
  outdir: 'dist',
  minify: true,
  sourcemap: true,
}).then(() => {
    console.log('Build successful!');
    fs.unlinkSync(generatedParserPath);
}).catch((e) => {
    console.error(e);
    process.exit(1);
});
