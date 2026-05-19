const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

try {
  const dbPath = path.join(process.cwd(), 'database.sqlite');
  console.log("DB Path:", dbPath);
  const db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_final BOOLEAN DEFAULT 0,
      "order" INTEGER,
      active BOOLEAN DEFAULT 1,
      deleted BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  const statusCount = db.prepare('SELECT COUNT(*) as c FROM statuses').get();
  if (statusCount.c === 0) {
    db.prepare(`INSERT INTO statuses (name, "order", is_final) VALUES ('Aberto', 1, 0), ('Em andamento', 2, 0), ('Finalizado', 3, 1)`).run();
  }

  const users = db.prepare('SELECT * FROM users').all();
  console.log("Users:", users.length);
} catch(e) {
  console.error("Error connecting to DB:", e);
}
