const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...getFiles(full));
    else if (item.name.endsWith('.graphql')) files.push(full);
  }
  return files.sort();
}

// Merge repeated `type X { }` blocks into one, keeping extend schema as-is
function mergeRepeatedTypes(content) {
  const lines = content.split('\n');
  const typeBlocks = {}; // name -> [field lines]
  const output = [];
  let currentType = null;
  let depth = 0;

  for (const line of lines) {
    const openBraces  = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    if (currentType === null) {
      // Match `type Foo {` or `type Foo @key(...) {`
      const m = line.match(/^type\s+(\w+)(\s+@[^{]*)?\s*\{/);
      if (m) {
        const name = m[1];
        if (!typeBlocks[name]) {
          typeBlocks[name] = { header: line, fields: [] };
          output.push(`__TYPE_PLACEHOLDER_${name}__`);
        }
        currentType = name;
        depth = openBraces - closeBraces;
        continue;
      }
      output.push(line);
    } else {
      depth += openBraces - closeBraces;
      if (depth <= 0) {
        // closing brace of the type block
        currentType = null;
        depth = 0;
      } else {
        if (line.trim()) typeBlocks[currentType].fields.push(line);
      }
    }
  }

  // Replace placeholders
  return output.map(line => {
    const m = line.match(/^__TYPE_PLACEHOLDER_(\w+)__$/);
    if (m) {
      const name = m[1];
      const { header, fields } = typeBlocks[name];
      return `${header}\n${fields.join('\n')}\n}`;
    }
    return line;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const services = ['auth', 'chat', 'commerce', 'content', 'profile'];
const root = path.join(__dirname, '..');
const schemasDir = path.join(__dirname, 'schemas');

if (!fs.existsSync(schemasDir)) fs.mkdirSync(schemasDir);

for (const service of services) {
  const schemaDir = path.join(root, 'services', service, 'src', 'schema');
  const files = getFiles(schemaDir);
  const raw = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const merged = mergeRepeatedTypes(raw);
  const outFile = path.join(schemasDir, `${service}.graphql`);
  fs.writeFileSync(outFile, merged);
  console.log(`${service}: merged ${files.length} files`);
}
