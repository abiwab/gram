const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// 1. Prepare Parser Code
const grammarPath = path.join(__dirname, '../gram-parser/grammar.ohm');
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');

const parserPath = path.join(__dirname, '../gram-parser/src/index.js');
const parserCode = fs.readFileSync(parserPath, 'utf-8');

// Replace fs/path usage with pre-loaded content
const newParserCode = `
const ohm = require('ohm-js');
const grammarContent = ${JSON.stringify(grammarContent)};
${parserCode
    .replace(/const fs = require\('fs'\);/, '// const fs = require("fs");')
    .replace(/const path = require\('path'\);/, '// const path = require("path");')
    .replace(/const ohm = require\('ohm-js'\);/, '// const ohm = already required;')
    .replace(/const grammarPath = path.join\(__dirname, '\.\.\/grammar.ohm'\);/, '')
    .replace(/const grammarContent = fs.readFileSync\(grammarPath, 'utf-8'\);/, '')
    .replace(/require\('\.\/compiler\/index'\)/, "require('../../gram-parser/src/compiler/index')")}
`;

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
