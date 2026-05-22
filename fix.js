import fs from 'fs';
let text = fs.readFileSync('server.ts', 'utf8');
text = text.replace(/\\`/g, '`');
text = text.replace(/\\\$/g, '$');
text = text.replace(/\\\\n/g, '\\n');
fs.writeFileSync('server.ts', text);
