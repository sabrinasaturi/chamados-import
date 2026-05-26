import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import compression from "compression";
import morgan from "morgan";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { Pool } from "pg";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "importflow-super-secret-c2";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "importflow-refresh-secret-c2";

console.log("=========================================");
console.log("[ENV TICK] INIT SERVER");
console.log("[ENV] DATABASE_URL:", !!process.env.DATABASE_URL);
console.log("[ENV] JWT_SECRET:", !!process.env.JWT_SECRET);
console.log("=========================================");

const hashPassword = (password: string) => crypto.createHash("sha256").update(password).digest("hex");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.VITE_APP_URL || '*' }));
app.use(express.json({ limit: "50mb" }));

// Request Timeout Middleware
app.use((req, res, next) => {
  req.setTimeout(25000, () => {
    console.log(`[API TIMEOUT] ${req.method} ${req.url}`);
    res.status(504).json({ error: "Gateway Timeout - Request taking too long" });
  });
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[API START] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[API RESPONSE] ${req.method} ${req.url} - ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});
app.use(morgan('combined'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  message: { error: "Muitas tentativas de login, por favor tente novamente mais tarde." }
});

const uploadDir = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch(e) {
    console.error("[INIT] Warning: Could not create upload directory", e);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + safeName);
  }
});
const allowedMimes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];
const fileFilter = (req: any, file: any, cb: any) => cb(null, allowedMimes.includes(file.mimetype));
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Token ausente" });
  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Token inválido ou expirado" });
    req.user = user;
    next();
  });
};

const toCamel = (o: any) => {
  let newO: any = {};
  for (let k in o) {
    newO[k.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = o[k];
  }
  return newO;
};

let pool: Pool;
let db: any = {
  prepare: () => { throw new Error("DATABASE_URL não configurada ou banco offline. Conexão real com o banco está desabilitada."); },
  exec: () => { throw new Error("DATABASE_URL não configurada ou banco offline. Conexão real com o banco está desabilitada."); }
};

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error("\n❌ [BOOT ERRO] DATABASE_URL não definida! Para usar o PostgreSQL do Supabase, configure a secret DATABASE_URL no AI Studio.\n");
    return;
  }
  
  console.log("✅ [DATABASE_URL LOADED] Conectando ao banco...");

  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Explicitado para o Supabase
    connectionTimeoutMillis: 10000, // Timeout para falha de conexão (10s)
    idleTimeoutMillis: 30000,
    max: 20
  });

  pool.on('error', (err) => {
    console.error("❌ [PostgreSQL] Erro inesperado no pool de conexões:", err);
  });

  try {
    const client = await pool.connect();
    console.log("✅ [POSTGRES CONNECTED] PostgreSQL conectado com sucesso.");
    client.release();
  } catch (e) {
    console.error("\n❌ [BOOT ERRO] Falha na conexão com o banco de dados PostgreSQL. Verifique suas credenciais.");
    console.error(e);
    console.error("\n");
    return; // Não inicializa o `db` e não tenta criar as tabelas.
  }

  db = {
    exec: async (sql: string) => {
      const pgSql = sql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
        .replace(/DATETIME/g, 'TIMESTAMP')
        .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT true')
        .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT false');
      try {
        console.log(`[QUERY START - EXEC]: ${pgSql.slice(0, 100)}...`);
        const res = await pool.query({ text: pgSql });
        console.log(`[QUERY SUCCESS] Executado comando struct: ${pgSql.slice(0, 50)}...`);
        return res;
      } catch (e) {
        console.error(`❌ [QUERY ERROR] Falha ao executar exec: ${pgSql.slice(0, 50)}`, e);
        throw e;
      }
    },
    prepare: (sql: string) => {
      let pgSql = sql;
      let i = 1;
      pgSql = pgSql.replace(/\?/g, () => '$' + (i++));
      let isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
         pgSql += ' RETURNING id';
      }
      return {
        get: async (...params: any[]) => {
          let paramArr = params;
          if(paramArr.length === 1 && Array.isArray(paramArr[0])) paramArr = paramArr[0];
          let client;
          try {
             client = await pool.connect();
             await client.query('SET statement_timeout = 10000');
             const res = await client.query({ text: pgSql, values: paramArr });
             console.log(`[QUERY SUCCESS] Row fetched -> ${pgSql.slice(0, 60)}...`);
             return res.rows[0];
          } catch(e) {
             console.error(`❌ [QUERY ERROR] (GET): ${pgSql.slice(0, 60)}...`, e);
             throw e;
          } finally {
             if (client) client.release();
          }
        },
        all: async (...params: any[]) => {
          let paramArr = params;
          if(paramArr.length === 1 && Array.isArray(paramArr[0])) paramArr = paramArr[0];
          let client;
          try {
             client = await pool.connect();
             await client.query('SET statement_timeout = 10000');
             const res = await client.query({ text: pgSql, values: paramArr });
             console.log(`[QUERY SUCCESS] ${res.rowCount} rows fetched -> ${pgSql.slice(0, 60)}...`);
             return res.rows;
          } catch(e) {
             console.error(`❌ [QUERY ERROR] (ALL): ${pgSql.slice(0, 60)}...`, e);
             throw e;
          } finally {
             if (client) client.release();
          }
        },
        run: async (...params: any[]) => {
          let paramArr = params;
          if(paramArr.length === 1 && Array.isArray(paramArr[0])) paramArr = paramArr[0];
          let client;
          try {
             client = await pool.connect();
             await client.query('SET statement_timeout = 10000');
             const res = await client.query({ text: pgSql, values: paramArr });
             console.log(`[QUERY SUCCESS] Run/Insert success -> ${pgSql.slice(0, 60)}...`);
             return { lastInsertRowid: res.rows[0]?.id };
          } catch(e) {
             console.error(`❌ [QUERY ERROR] (RUN): ${pgSql.slice(0, 60)}...`, e);
             throw e;
          } finally {
             if (client) client.release();
          }
        }
      }
    }
  };

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        login TEXT UNIQUE,
        role TEXT NOT NULL,
        sector TEXT,
        password TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        force_password_reset BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_number TEXT UNIQUE NOT NULL,
        proposals TEXT,
        bank TEXT,
        import_type TEXT,
        priority TEXT,
        observation TEXT,
        status TEXT,
        requester_id INTEGER,
        assignee_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sla_deadline TIMESTAMP,
        finished_at TIMESTAMP,
        deleted BOOLEAN DEFAULT false,
        delete_reason TEXT,
        deleted_by INTEGER,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ticket_history (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER,
        action TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS ticket_comments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER,
        text TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER,
        original_name TEXT,
        internal_name TEXT,
        extension TEXT,
        type TEXT,
        size INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        storage_path TEXT,
        local_path TEXT,
        file_data TEXT
      );

      CREATE TABLE IF NOT EXISTS banks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        active BOOLEAN DEFAULT true,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS import_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        active BOOLEAN DEFAULT true,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS priorities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sla INTEGER,
        sla_unit TEXT,
        color TEXT,
        active BOOLEAN DEFAULT true,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS statuses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        is_final BOOLEAN DEFAULT false,
        "order" INTEGER,
        color TEXT,
        active BOOLEAN DEFAULT true,
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ [BOOT INFO] Tabelas criadas/verificadas com sucesso.");
  } catch (e) {
    console.error("❌ [BOOT ERRO] Falha ao executar migrations iniciais (CREATE TABLE):", e);
  }

  try { await db.exec('ALTER TABLE banks ADD COLUMN color TEXT'); } catch(e){}
  try { await db.exec('ALTER TABLE import_types ADD COLUMN color TEXT'); } catch(e){}
  try { await db.exec('ALTER TABLE priorities ADD COLUMN color TEXT'); } catch(e){}
  try { await db.exec('ALTER TABLE statuses ADD COLUMN color TEXT'); } catch(e){}
  try { await db.exec('ALTER TABLE attachments ADD COLUMN file_data TEXT'); } catch(e){}

  try {
    const usersCount = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (parseInt(usersCount.c, 10) === 0) {
      const pwd = hashPassword('admin123');
      await db.prepare('INSERT INTO users (name, email, login, role, sector, password, active, force_password_reset) VALUES (?, ?, ?, ?, ?, ?, true, false)')
        .run('Administrador', 'admin@c2.com', 'admin', 'ADMIN', 'Tecnologia', pwd);
      console.log("🌟 [BOOT INFO] Usuário Admin criado (admin/admin123).");
    } else {
      // Force reset admin password for safety during debug
      const pwd = hashPassword('admin123');
      await db.prepare("UPDATE users SET password = ? WHERE login = 'admin' OR email = 'admin@c2.com'").run(pwd);
      console.log("🌟 [BOOT INFO] Senha do Admin redefinida para 'admin123'.");
    }

    const statusCount = await db.prepare('SELECT COUNT(*) as c FROM statuses').get();
    if (parseInt(statusCount.c, 10) === 0) {
      await db.prepare(`INSERT INTO statuses (name, "order", is_final) VALUES ('Aberto', 1, false), ('Em andamento', 2, false), ('Finalizado', 3, true)`).run();
      await db.prepare(`INSERT INTO priorities (name, sla, sla_unit) VALUES ('Baixa', 24, 'horas'), ('Média', 8, 'horas'), ('Alta', 4, 'horas')`).run();
      await db.prepare(`INSERT INTO banks (name) VALUES ('Banco do Brasil'), ('Caixa'), ('Itaú'), ('Santander'), ('Bradesco')`).run();
      await db.prepare(`INSERT INTO import_types (name) VALUES ('CSV Padrão'), ('Planilha Excel'), ('Integração API')`).run();
      console.log("🌟 [BOOT INFO] Dados de parametrização iniciais inseridos com sucesso.");
    }
  } catch(e) {
    console.error("❌ [BOOT ERRO] Falha ao rodar os seeds iniciais:", e);
  }
}

// Root Express config
let isDbSetup = false;
let dbSetupPromise: Promise<void> | null = null;

// Middleware para garantir que o banco seja inicializado antes de qualquer rota /api em ambiente Serverless
app.use(async (req, res, next) => {
  if (req.url.startsWith('/api')) {
    if (!isDbSetup) {
      if (!dbSetupPromise) dbSetupPromise = setupDatabase();
      await dbSetupPromise;
      isDbSetup = true;
    }
  }
  next();
});

// --- API Routes ---

app.set('trust proxy', 1);

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    console.log("[LOGIN START] Body:", req.body.email);
    const { email, password } = req.body;
    if (!email || !password) {
       console.log("[LOGIN ERROR] Email ou senha faltando");
       return res.status(400).json({ error: "Email e senha obrigatórios." });
    }
    
    const user = await db.prepare('SELECT * FROM users WHERE (email = ? OR login = ?) AND active = true').get(email, email);

    if (user) {
       console.log("[USER FOUND] User ID:", user.id, "Name:", user.name);
       const incomingHash = hashPassword(password);
       const incomingHashTrimmed = hashPassword(password.trim());
       if (user.password === incomingHash || user.password === incomingHashTrimmed) {
          console.log("[PASSWORD MATCH] Login success for user ID:", user.id);
          await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
          await db.prepare('INSERT INTO login_logs (user_id, name, ip, user_agent) VALUES (?, ?, ?, ?)').run(user.id, user.name, req.ip || 'Unknown', req.headers['user-agent'] || 'Unknown');
          
          const tokenUser = { id: user.id, role: user.role, name: user.name, forcePasswordReset: user.force_password_reset };
          const token = jwt.sign(tokenUser, SECRET_KEY, { expiresIn: '12h' });
          const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

          console.log("[JWT GENERATED] Login Success");
          res.json({ token, refreshToken, user: { id: user.id, name: user.name, role: user.role, email: user.email, forcePasswordReset: user.force_password_reset } });
       } else {
          console.log("[LOGIN ERROR] Password mismatch for user ID:", user.id);
          console.log("[LOGIN ERROR DEBUG] DB Hash:", user.password, "Incoming Hash:", incomingHash, "Incoming Raw len:", password.length);
          res.status(401).json({ error: "Credenciais inválidas. Tente novamente." });
       }
    } else {
      console.log("[LOGIN ERROR] User not found or inactive for:", email);
      res.status(401).json({ error: "Credenciais inválidas. Tente novamente." });
    }
  } catch (e: any) {
    console.error("[LOGIN ERROR] 500 falha interna:", e.message);
    res.status(500).json({ error: "Erro interno: " + e.message });
  }
});

app.post("/api/refresh", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: "Token ausente" });
    jwt.verify(token, REFRESH_SECRET, async (err: any, tokenUser: any) => {
      if (err) return res.status(403).json({ error: "Refresh token expirado" });
      const user = await db.prepare('SELECT * FROM users WHERE id = ? AND active = true').get(tokenUser.id);
      if (!user) return res.status(403).json({ error: "Usuário inativo" });
      const newToken = jwt.sign({ id: user.id, role: user.role, name: user.name, forcePasswordReset: user.force_password_reset }, SECRET_KEY, { expiresIn: '12h' });
      res.json({ token: newToken });
    });
  } catch (e) {
    res.status(500).json({ error: "Erro ao atualizar token" });
  }
});

app.post("/api/logout", async (req, res) => {
  res.status(200).json({ success: true });
});

app.post("/api/users/change-password", authenticateToken, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.password !== hashPassword(currentPassword)) return res.status(400).json({ error: "Senha atual incorreta." });
    
    await db.prepare('UPDATE users SET password = ?, force_password_reset = false WHERE id = ?').run(hashPassword(newPassword), req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erro ao alterar a senha" });
  }
});

app.get("/api/users/me", authenticateToken, async (req: any, res) => {
  try {
    const user = await db.prepare('SELECT id, name, role, email, force_password_reset FROM users WHERE id = ?').get(req.user.id);
    if (user) res.json(toCamel(user));
    else res.status(404).json({ error: "Usuário não encontrado" });
  } catch (e) {
    res.status(500).json({ error: "Erro ao buscar usuário logado" });
  }
});

app.get("/api/users", authenticateToken, async (req: any, res) => {
  try {
    const rows = await db.prepare('SELECT id, name, role, email FROM users WHERE active = true').all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// Tickets
app.get("/api/tickets", authenticateToken, async (req: any, res) => {
  try {
    let q = 'SELECT t.*, u1.name as requester_name, u2.name as assignee_name FROM tickets t LEFT JOIN users u1 ON t.requester_id = u1.id LEFT JOIN users u2 ON t.assignee_id = u2.id WHERE t.deleted = false';
    let params: any[] = [];
    q += ' ORDER BY t.created_at DESC';
    const rows = await db.prepare(q).all(...params);
    
    res.json(rows.map((r: any) => ({
      id: r.id, ticketNumber: r.ticket_number, proposals: typeof r.proposals === 'string' ? JSON.parse(r.proposals) : (r.proposals || []), bank: r.bank, 
      importType: r.import_type, priority: r.priority, observation: r.observation, 
      status: r.status, requesterId: r.requester_id, assigneeId: r.assignee_id,
      createdAt: r.created_at, slaDeadline: r.sla_deadline, finishedAt: r.finished_at,
      requester: { id: r.requester_id, name: r.requester_name },
      assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null
    })));
  } catch (e: any) { 
    console.error("[GET TICKETS ERROR]", e); 
    res.status(500).json({ error: "Erro ao buscar a fila operacional" }); 
  }
});

app.post("/api/tickets", authenticateToken, async (req: any, res) => {
  try {
    const { proposals, bank, importType, priority, observation, attachments } = req.body;
    
    const priorObj = await db.prepare('SELECT sla, sla_unit FROM priorities WHERE name = ?').get(priority) || { sla: 4, sla_unit: 'horas' };
    
    let slaMs = 0;
    if (priorObj.sla_unit === 'minutos') slaMs = priorObj.sla * 60 * 1000;
    else if (priorObj.sla_unit === 'horas') slaMs = priorObj.sla * 60 * 60 * 1000;
    else if (priorObj.sla_unit === 'dias') slaMs = priorObj.sla * 24 * 60 * 60 * 1000;
    const slaDeadline = new Date(Date.now() + slaMs).toISOString();

    const statusObj = await db.prepare('SELECT name FROM statuses ORDER BY "order" ASC LIMIT 1').get();
    const firstStatus = statusObj?.name || "Aberto";

    const pArr = Array.isArray(proposals) ? proposals : proposals.split(',').map((p:string)=>p.trim()).filter((p:string)=>p);
    const tempNum = `TEMP-${Date.now()}`;

    const result = await db.prepare(
      `INSERT INTO tickets (ticket_number, proposals, bank, import_type, priority, observation, status, requester_id, sla_deadline) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(tempNum, JSON.stringify(pArr), bank, importType, priority, observation, firstStatus, req.user.id, slaDeadline);
    
    const ticketId = result.lastInsertRowid;
    const finalNum = `IMP-${ticketId}`;
    await db.prepare('UPDATE tickets SET ticket_number = ? WHERE id = ?').run(finalNum, ticketId);

    await db.prepare('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES (?, ?, ?)').run(ticketId, "Chamado criado", req.user.id);
    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

    if (attachments && Array.isArray(attachments)) {
      for (let att of attachments) {
        const ext = att.name.split('.').pop()?.toLowerCase();
        const safeName = att.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const uniqueInternalName = `att_${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}`;
        
        try {
           const base64Data = att.data.replace(/^data:.*?;base64,/, "");

           await db.prepare(
             `INSERT INTO attachments (ticket_id, original_name, internal_name, extension, type, size, user_id, file_data) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
           ).run(ticketId, att.name, uniqueInternalName, ext, att.type, att.size, req.user.id, base64Data);
           await db.prepare('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES (?, ?, ?)').run(ticketId, `Anexo adicionado: ${att.name}`, req.user.id);
        } catch(e) { console.error("[FILE UPLOAD ERROR]", e); }
      }
    }
    res.json({ id: ticket.id, ticketNumber: ticket.ticket_number, createdAt: ticket.created_at, status: ticket.status });
  } catch (e: any) { 
    console.error("[POST TICKET ERROR]", e); 
    res.status(500).json({ error: "Erro ao criar chamado" }); 
  }
});

app.get("/api/tickets/:id/attachments", authenticateToken, async (req: any, res) => {
  try {
    const rows = await db.prepare('SELECT a.*, u.name as user_name FROM attachments a LEFT JOIN users u ON a.user_id = u.id WHERE a.ticket_id = ?').all(req.params.id);
    res.json(rows.map((r: any) => ({
      id: r.id, originalName: r.original_name, extension: r.extension, size: r.size, uploadedAt: r.uploaded_at, user: { name: r.user_name }
    })));
  } catch(e) { res.status(500).json({ error: "Erro ao carregar anexos" }); }
});

app.get("/api/attachments/:id/download", authenticateToken, async (req: any, res) => {
  try {
    const att = await db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) return res.status(404).json({ error: "Anexo não localizado" });
    
    if (att.file_data) {
      return res.json({ data: `data:${att.type};base64,${att.file_data}`, name: att.original_name, type: att.type });
    } else if (att.local_path && fs.existsSync(att.local_path)) {
      // Fallback para anexos antigos
      const buffer = fs.readFileSync(att.local_path);
      const base64 = buffer.toString('base64');
      return res.json({ data: `data:${att.type};base64,${base64}`, name: att.original_name, type: att.type });
    }
    res.status(404).json({ error: "Arquivo corrompido ou indisponível" });
  } catch(e) { console.error("[DOWNLOAD ERROR]", e); res.status(500).json({ error: "Erro ao baixar anexo" }); }
});

app.get("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const ticket = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: "Chamado não localizado" });

    const uRows = await db.prepare(`SELECT id, name FROM users WHERE id IN (?, ?)`).all(ticket.requester_id, ticket.assignee_id || -1);
    const reqU = uRows.find((u:any) => u.id === ticket.requester_id);
    const assU = uRows.find((u:any) => u.id === ticket.assignee_id);

    const hRows = await db.prepare('SELECT h.*, u.name as user_name FROM ticket_history h LEFT JOIN users u ON h.user_id = u.id WHERE h.ticket_id = ? ORDER BY h.timestamp ASC').all(id);
    
    let cRows: any[] = [];
    if (req.user.role === 'ADMIN' || req.user.role === 'IMPORTACAO') {
      cRows = await db.prepare('SELECT c.*, u.name as user_name FROM ticket_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.ticket_id = ? ORDER BY c.timestamp ASC').all(id);
    }

    res.json({
      id: ticket.id, ticketNumber: ticket.ticket_number, proposals: typeof ticket.proposals === 'string' ? JSON.parse(ticket.proposals) : (ticket.proposals || []), bank: ticket.bank, importType: ticket.import_type, priority: ticket.priority, observation: ticket.observation, status: ticket.status, requesterId: ticket.requester_id, assigneeId: ticket.assignee_id, createdAt: ticket.created_at, slaDeadline: ticket.sla_deadline, finishedAt: ticket.finished_at,
      requester: reqU,
      assignee: assU,
      historyDetails: hRows.map((h:any) => ({ id: h.id, action: h.action, timestamp: h.timestamp, user: { name: h.user_name } })),
      commentsDetails: cRows.map((c:any) => ({ id: c.id, text: c.text, timestamp: c.timestamp, user: { name: c.user_name } }))
    });
  } catch(e) { console.error("[GET TICKET ERROR]", e); res.status(500).json({ error: "Erro ao visualizar chamado" }); }
});

app.put("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role === 'SOLICITANTE') return res.status(403).json({ error: "Acesso negado" });
  try {
    const id = parseInt(req.params.id);
    const { status, assigneeId, comment } = req.body;
    
    const ticket = await db.prepare('SELECT status, assignee_id FROM tickets WHERE id = ?').get(id);
    if (!ticket) return res.status(404).json({ error: "Chamado não localizado" });

    if (status && status !== ticket.status) {
      const sObj = await db.prepare('SELECT is_final FROM statuses WHERE name = ?').get(status);
      const isFinal = sObj?.is_final;
      await db.prepare('UPDATE tickets SET status = ?, finished_at = ? WHERE id = ?').run(status, (isFinal ? new Date().toISOString() : null), id);
      await db.prepare('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES (?, ?, ?)').run(id, `Status alterado para ${status}`, req.user.id);
    }
    
    if (assigneeId !== undefined && assigneeId !== ticket.assignee_id) {
       await db.prepare('UPDATE tickets SET assignee_id = ? WHERE id = ?').run(assigneeId, id);
       await db.prepare('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES (?, ?, ?)').run(id, assigneeId ? `Atribuído` : `Desatribuído`, req.user.id);
    }
    
    if (comment) {
       await db.prepare('INSERT INTO ticket_comments (ticket_id, text, user_id) VALUES (?, ?, ?)').run(id, comment, req.user.id);
    }
    res.json({ success: true });
  } catch(e) { console.error("[PUT TICKET ERROR]", e); res.status(500).json({ error: "Erro ao atualizar chamado" }); }
});

app.delete("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso negado" });
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    await db.prepare('UPDATE tickets SET deleted = true, status = ?, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, delete_reason = ? WHERE id = ?').run('Excluído', req.user.id, reason, id);
    await db.prepare('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES (?, ?, ?)').run(id, `Chamado excluído. Motivo: ${reason}`, req.user.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Erro ao excluir o chamado" }); }
});

// Dashboard
app.get("/api/dashboard", authenticateToken, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    let baseWhere = 'deleted = false';
    let params: any[] = [];
    if (startDate) { params.push(startDate); baseWhere += ` AND created_at >= ?`; }
    if (endDate) { params.push(endDate); baseWhere += ` AND created_at <= ?`; }
    
    const rows = await db.prepare(`SELECT status, bank, priority, sla_deadline FROM tickets WHERE ${baseWhere}`).all(...params);
    const dbStatuses = await db.prepare('SELECT name, is_final, "order" FROM statuses WHERE deleted = false AND active = true ORDER BY "order" ASC').all();
    
    // Categorias dinamicamente baseadas nas statuses
    const abertosNames = dbStatuses.filter((s:any) => s.order === 1).map((s:any) => s.name);
    const finalizadosNames = dbStatuses.filter((s:any) => s.is_final).map((s:any) => s.name);
    
    const stats = {
       abertos: rows.filter((t:any) => abertosNames.includes(t.status)).length,
       emAndamento: rows.filter((t:any) => !abertosNames.includes(t.status) && !finalizadosNames.includes(t.status)).length,
       finalizados: rows.filter((t:any) => finalizadosNames.includes(t.status)).length,
       atrasados: rows.filter((t:any) => !finalizadosNames.includes(t.status) && new Date(t.sla_deadline) < new Date()).length,
       byBank: rows.reduce((acc:any, t:any) => { acc[t.bank] = (acc[t.bank] || 0) + 1; return acc; }, {}),
       byPriority: rows.reduce((acc:any, t:any) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {})
    };
    res.json(stats);
  } catch(e) { 
    console.error("[DASHBOARD ERROR]", e); 
    res.status(500).json({ error: "Erro ao carregar dados do dashboard" }); 
  }
});

app.get("/api/analytics/insights", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'GESTAO') return res.status(403).json({ error: "Acesso restrito" });
  try {
    const tickets = await db.prepare(`SELECT t.status, t.bank, t.priority, t.import_type, t.created_at, t.finished_at, t.sla_deadline, u.name as assignee FROM tickets t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.deleted = false`).all();
    
    const prompt = `Você é um analista de operações sênior do sistema ImportFlow C2. 
Aqui estão os chamados do sistema em formato JSON:
${JSON.stringify(tickets)}

Gere um resumo executivo com insights operacionais, tendências, gargalos e problemas. Responda APENAS em formato JSON com o seguinte schema:
{
  "summary": "Resumo geral da saúde da operação.",
  "insights": [ "Insight 1 sobre bancos", "Insight 2 sobre equipe", etc ],
  "bottlenecks": [ "Gargalo 1 detectado", etc ]
}
Limite a 5 insights e 3 gargalos. Seja direto, profissional e baseie-se estritamente nos dados. Se houver poucos dados, avise no summary.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    if (response.text) {
      const cleanText = response.text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(cleanText));
    } else {
      res.json({ summary: "Não foi possível gerar insights no momento.", insights: [], bottlenecks: [] });
    }
  } catch(e) {
    console.error("[IA Insights Error]", e);
    res.status(500).json({ error: "Erro interno ao contactar a LLM" });
  }
});

// Admin Users
app.get("/api/admin/users", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
  try {
    const rows = await db.prepare('SELECT id, name, login, email, role, sector, active, created_at as "createdAt", last_login as "lastLogin", force_password_reset as "forcePasswordReset" FROM users').all();
    res.json(rows.map((row: any) => ({ ...row, active: Boolean(row.active), forcePasswordReset: Boolean(row.forcePasswordReset) })));
  } catch(e) { res.status(500).json({ error: "Erro ao buscar usuários" }); }
});

app.post("/api/admin/users", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
  try {
    const { name, email, login, role, sector, password } = req.body;
    const pwd = hashPassword(password);
    const result = await db.prepare(
      `INSERT INTO users (name, email, login, role, sector, password, active, force_password_reset) VALUES (?, ?, ?, ?, ?, ?, true, true)`
    ).run(name, email, login, role, sector, pwd);
    const user = await db.prepare('SELECT id, name, email, role, sector FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json(user);
  } catch(e) { console.error("[CREATE USER ERROR]", e); res.status(500).json({ error: "Erro ao cadastrar usuário" }); }
});

app.put("/api/admin/users/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
  try {
    const id = parseInt(req.params.id);
    const { name, email, login, role, sector, active, password } = req.body;
    if (password) {
       await db.prepare('UPDATE users SET name=?, email=?, login=?, role=?, sector=?, active=?, password=? WHERE id=?').run(name, email, login, role, sector, active ? true : false, hashPassword(password), id);
    } else {
       await db.prepare('UPDATE users SET name=?, email=?, login=?, role=?, sector=?, active=? WHERE id=?').run(name, email, login, role, sector, active ? true : false, id);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: "Erro ao atualizar usuário" }); }
});

app.post("/api/admin/users/:id/reset-password", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const tempPassword = Math.random().toString(36).slice(-8);
    await db.prepare('UPDATE users SET password = ?, force_password_reset = true WHERE id = ?').run(hashPassword(tempPassword), req.params.id);
    res.json({ success: true, tempPassword });
  } catch(e) { res.status(500).json({ error: "Erro ao redefinir a senha" }); }
});

app.get("/api/admin/logs", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const rows = await db.prepare('SELECT * FROM login_logs ORDER BY timestamp DESC').all();
    res.json(rows.map(toCamel));
  } catch(e) { res.status(500).json({ error: "Erro ao carregar logs" }); }
});

// External Params
app.get("/api/params/all", authenticateToken, async (req: any, res) => {
  try {
    const banks = await db.prepare('SELECT * FROM banks WHERE deleted = false AND active = true').all();
    const impTypes = await db.prepare('SELECT * FROM import_types WHERE deleted = false AND active = true').all();
    const prios = await db.prepare('SELECT * FROM priorities WHERE deleted = false AND active = true ORDER BY sla ASC').all();
    const stats = await db.prepare('SELECT * FROM statuses WHERE deleted = false AND active = true ORDER BY "order" ASC').all();
    
    res.json({
      banks: banks.map(toCamel),
      importTypes: impTypes.map(toCamel),
      priorities: prios.map(toCamel),
      statuses: stats.map(toCamel)
    });
  } catch(e) { console.error("[GET PARAMS ERROR]", e); res.status(500).json({ error: "Erro ao buscar opções de formulários" }); }
});

const generateCrud = (pathPrefix: string, tableName: string) => {
  app.get(`/api/admin/${pathPrefix}`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
    try { const rows = await db.prepare(`SELECT * FROM ${tableName} WHERE deleted = false`).all(); res.json(rows.map((row: any) => ({ ...toCamel(row), active: Boolean(row.active) }))); } catch(e) { res.status(500).json({ error: `Erro na leitura de ${tableName}` }); }
  });
  app.post(`/api/admin/${pathPrefix}`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
    try {
      let keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'deleted');
      const qCols = keys.map(k => `"${k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())}"`).join(', ');
      const qVals = keys.map((_, i) => `?`).join(', ');
      const vals = keys.map(k => typeof req.body[k] === 'boolean' ? (req.body[k] ? true : false) : req.body[k]);
      
      const result = await db.prepare(`INSERT INTO ${tableName} (${qCols}) VALUES (${qVals})`).run(...vals);
      const newRow = await db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid);
      res.json({ ...toCamel(newRow), active: Boolean((newRow as any).active) });
    } catch(e) { console.error(e); res.status(500).json({ error: `Erro ao adicionar em ${tableName}` }); }
  });
  app.put(`/api/admin/${pathPrefix}/:id`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'deleted');
      const qSet = keys.map((k, i) => `"${k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())}" = ?`).join(', ');
      const vals = keys.map(k => typeof req.body[k] === 'boolean' ? (req.body[k] ? true : false) : req.body[k]);
      vals.push(req.params.id);
      
      await db.prepare(`UPDATE ${tableName} SET ${qSet} WHERE id = ?`).run(...vals);
      const updatedRow = await db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(req.params.id);
      res.json({ ...toCamel(updatedRow), active: Boolean((updatedRow as any).active) });
    } catch(e) { console.error(e); res.status(500).json({ error: `Erro ao atualizar em ${tableName}` }); }
  });
  app.delete(`/api/admin/${pathPrefix}/:id`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: "Acesso restrito" });
    try {
      await db.prepare(`UPDATE ${tableName} SET deleted = true WHERE id = ?`).run(req.params.id);
      res.json({ success: true });
    } catch(e) { res.status(500).json({ error: `Erro ao excluir em ${tableName}` }); }
  });
};

generateCrud('banks', 'banks');
generateCrud('import-types', 'import_types');
generateCrud('priorities', 'priorities');
generateCrud('statuses', 'statuses');

app.use((err: any, req: any, res: any, next: any) => {
  console.error(`[ERRO CRÍTICO] Rota: ${req.url} - `, err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

async function startServer() {
  if (!isDbSetup) {
    if (!dbSetupPromise) dbSetupPromise = setupDatabase();
    await dbSetupPromise;
    isDbSetup = true;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER READY] API online na porta ${PORT}`);
  });
}

if (process.env.VERCEL) {
  // Em ambiente Serverless (Vercel), não iniciamos app.listen nem vite middleware.
  // exportamos o app para que a Vercel o utilize como função.
} else {
  // Em ambiente local ou container convencional, subimos o servidor
  startServer();
}

export default app;
