const fs = require('fs');

let content = fs.readFileSync('server.pg.ts', 'utf8');

// The file doubled in size because maybe my regex replaced poorly?
// Let's check how many times setupDatabase is there.
console.log("Lines: ", content.split('\\n').length);
console.log("Imports pg: ", content.match(/import \{ Pool \} from 'pg'/g));
