const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');
c = c.replace(/\\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('server.ts', c);
console.log('Fixed');
