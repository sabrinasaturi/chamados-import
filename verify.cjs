const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

try {
  const dbPath = path.join(process.cwd(), 'database.sqlite');
  console.log("DB Path:", dbPath);
  const db = new Database(dbPath);
  const users = db.prepare('SELECT * FROM users').all();
  console.log("Users:", users);
  
  const tickets = db.prepare('SELECT * FROM tickets').all();
  console.log("Tickets:", tickets);
} catch(e) {
  console.error("Error connecting to DB:", e);
}
