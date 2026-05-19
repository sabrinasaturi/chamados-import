import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import compression from "compression";
import morgan from "morgan";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "importflow-super-secret-c2";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "importflow-refresh-secret-c2";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Conexão com o Postgres do Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

const hashPassword = (password: string) => crypto.createHash("sha256").update(password).digest("hex");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.VITE_APP_URL || '*' }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan('combined'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  message: "Muitas tentativas de login, por favor tente novamente mais tarde."
});

let refreshTokens: string[] = []; 

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

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
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Utils ---
const toCamel = (o: any) => {
  let newO: any = {};
  for (let k in o) {
    newO[k.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = o[k];
  }
  return newO;
};

// --- API Routes (Supabase Postgres Integrado) ---

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE (email = $1 OR login = $1) AND active = true', [email]);
    const user = rows[0];

    if (user && user.password === hashPassword(password)) {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
      await pool.query('INSERT INTO login_logs (user_id, name, ip, user_agent) VALUES ($1, $2, $3, $4)', [user.id, user.name, req.ip, req.headers['user-agent']]);
      
      const tokenUser = { id: user.id, role: user.role, name: user.name, forcePasswordReset: user.force_password_reset };
      const token = jwt.sign(tokenUser, SECRET_KEY, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
      refreshTokens.push(refreshToken);

      res.json({ token, refreshToken, user: { id: user.id, name: user.name, role: user.role, email: user.email, forcePasswordReset: user.force_password_reset } });
    } else {
      res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erro de servidor (Supabase)" });
  }
});

app.post("/api/refresh", async (req, res) => {
  const { token } = req.body;
  if (!token || !refreshTokens.includes(token)) return res.sendStatus(401);
  jwt.verify(token, REFRESH_SECRET, async (err: any, tokenUser: any) => {
    if (err) return res.sendStatus(403);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [tokenUser.id]);
    if (rows.length === 0) return res.sendStatus(403);
    const user = rows[0];
    const newToken = jwt.sign({ id: user.id, role: user.role, name: user.name, forcePasswordReset: user.force_password_reset }, SECRET_KEY, { expiresIn: '15m' });
    res.json({ token: newToken });
  });
});

app.post("/api/logout", (req, res) => {
  refreshTokens = refreshTokens.filter(rt => rt !== req.body.token);
  res.sendStatus(204);
});

app.post("/api/users/change-password", authenticateToken, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || rows[0].password !== hashPassword(currentPassword)) return res.status(400).json({ error: "Senha atual incorreta." });
  
  await pool.query('UPDATE users SET password = $1, force_password_reset = false WHERE id = $2', [hashPassword(newPassword), req.user.id]);
  res.json({ success: true });
});

app.get("/api/users/me", authenticateToken, async (req: any, res) => {
  const { rows } = await pool.query('SELECT id, name, role, email, force_password_reset FROM users WHERE id = $1', [req.user.id]);
  if (rows[0]) res.json(toCamel(rows[0]));
  else res.status(404).send();
});

app.get("/api/users", authenticateToken, async (req: any, res) => {
  const { rows } = await pool.query('SELECT id, name, role, email FROM users WHERE active = true');
  res.json(rows);
});

// Tickets
app.get("/api/tickets", authenticateToken, async (req: any, res) => {
  try {
    let q = 'SELECT t.*, u1.name as requester_name, u2.name as assignee_name FROM tickets t LEFT JOIN users u1 ON t.requester_id = u1.id LEFT JOIN users u2 ON t.assignee_id = u2.id WHERE t.deleted = false';
    let params: any[] = [];
    q += ' ORDER BY t.created_at DESC';
    const { rows } = await pool.query(q, params);
    
    res.json(rows.map((r: any) => ({
      id: r.id, ticketNumber: r.ticket_number, proposals: r.proposals, bank: r.bank, 
      importType: r.import_type, priority: r.priority, observation: r.observation, 
      status: r.status, requesterId: r.requester_id, assigneeId: r.assignee_id,
      createdAt: r.created_at, slaDeadline: r.sla_deadline, finishedAt: r.finished_at,
      requester: { id: r.requester_id, name: r.requester_name },
      assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null
    })));
  } catch (e: any) { console.error(e); res.status(500).send(); }
});

app.post("/api/tickets", authenticateToken, async (req: any, res) => {
  try {
    const { proposals, bank, importType, priority, observation, attachments } = req.body;
    
    const { rows: priorRows } = await pool.query('SELECT sla, sla_unit FROM priorities WHERE name = $1', [priority]);
    const priorObj = priorRows[0] || { sla: 4, sla_unit: 'horas' };
    
    let slaMs = 0;
    if (priorObj.sla_unit === 'minutos') slaMs = priorObj.sla * 60 * 1000;
    else if (priorObj.sla_unit === 'horas') slaMs = priorObj.sla * 60 * 60 * 1000;
    else if (priorObj.sla_unit === 'dias') slaMs = priorObj.sla * 24 * 60 * 60 * 1000;
    const slaDeadline = new Date(Date.now() + slaMs);

    const { rows: statusRows } = await pool.query('SELECT name FROM statuses WHERE "order" = 1');
    const firstStatus = statusRows[0]?.name || "Aberto";

    const pArr = Array.isArray(proposals) ? proposals : proposals.split(',').map((p:string)=>p.trim()).filter((p:string)=>p);
    const num = `TKT-${Date.now()}`; 

    const { rows: tRows } = await pool.query(
      `INSERT INTO tickets (ticket_number, proposals, bank, import_type, priority, observation, status, requester_id, sla_deadline) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [num, JSON.stringify(pArr), bank, importType, priority, observation, firstStatus, req.user.id, slaDeadline]
    );
    const ticket = tRows[0];

    await pool.query('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES ($1, $2, $3)', [ticket.id, "Chamado criado", req.user.id]);

    if (attachments && Array.isArray(attachments)) {
      for (let att of attachments) {
        const ext = att.name.split('.').pop()?.toLowerCase();
        const safeName = att.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const uniqueInternalName = `att_${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}`;
        let supabasePath = null;
        
        if (supabase) {
          try {
             const buffer = Buffer.from(att.data.replace(/^data:.*?;base64,/, ""), "base64");
             const { data: uploadData } = await supabase.storage.from('attachments').upload(uniqueInternalName, buffer, { contentType: att.type });
             supabasePath = uploadData?.path;
          } catch(e) { console.error("[SUPABASE UPLOAD]", e); }
        }

        await pool.query(
          `INSERT INTO attachments (ticket_id, original_name, internal_name, extension, type, size, user_id, storage_path) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ticket.id, att.name, uniqueInternalName, ext, att.type, att.size, req.user.id, (supabasePath || '')]
        );
        await pool.query('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES ($1, $2, $3)', [ticket.id, `Anexo adicionado: ${att.name}`, req.user.id]);
      }
    }
    res.json({ id: ticket.id, ticketNumber: ticket.ticket_number, createdAt: ticket.created_at, status: ticket.status });
  } catch (e: any) { console.error(e); res.status(500).send(); }
});

app.get("/api/tickets/:id/attachments", authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query('SELECT a.*, u.name as user_name FROM attachments a LEFT JOIN users u ON a.user_id = u.id WHERE a.ticket_id = $1', [req.params.id]);
    res.json(rows.map((r: any) => ({
      id: r.id, originalName: r.original_name, extension: r.extension, size: r.size, uploadedAt: r.uploaded_at, user: { name: r.user_name }
    })));
  } catch(e) { res.status(500).send(); }
});

app.get("/api/attachments/:id/download", authenticateToken, async (req: any, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    const att = rows[0];
    if (!att) return res.sendStatus(404);
    
    if (att.storage_path && supabase) {
      const { data, error } = await supabase.storage.from('attachments').download(att.storage_path);
      if (error || !data) return res.status(500).json({ error: "Erro Supabase Download" });
      const buffer = Buffer.from(await data.arrayBuffer());
      const base64 = buffer.toString('base64');
      return res.json({ data: `data:${att.type};base64,${base64}`, name: att.original_name, type: att.type });
    }
    res.status(404).send();
  } catch(e) { console.error(e); res.status(500).send(); }
});

app.get("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rows: tRows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (tRows.length === 0) return res.sendStatus(404);
    const ticket = tRows[0];

    const { rows: uRows } = await pool.query('SELECT id, name FROM users WHERE id IN ($1, $2)', [ticket.requester_id, ticket.assignee_id || -1]);
    const reqU = uRows.find((u:any) => u.id === ticket.requester_id);
    const assU = uRows.find((u:any) => u.id === ticket.assignee_id);

    const { rows: hRows } = await pool.query('SELECT h.*, u.name as user_name FROM ticket_history h LEFT JOIN users u ON h.user_id = u.id WHERE h.ticket_id = $1 ORDER BY h.timestamp ASC', [id]);
    const { rows: cRows } = await pool.query('SELECT c.*, u.name as user_name FROM ticket_comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.ticket_id = $1 ORDER BY c.timestamp ASC', [id]);

    res.json({
      id: ticket.id, ticketNumber: ticket.ticket_number, proposals: ticket.proposals, bank: ticket.bank, importType: ticket.import_type, priority: ticket.priority, observation: ticket.observation, status: ticket.status, requesterId: ticket.requester_id, assigneeId: ticket.assignee_id, createdAt: ticket.created_at, slaDeadline: ticket.sla_deadline, finishedAt: ticket.finished_at,
      requester: reqU,
      assignee: assU,
      historyDetails: hRows.map((h:any) => ({ id: h.id, action: h.action, timestamp: h.timestamp, user: { name: h.user_name } })),
      commentsDetails: cRows.map((c:any) => ({ id: c.id, text: c.text, timestamp: c.timestamp, user: { name: c.user_name } }))
    });
  } catch(e) { res.status(500).send(); }
});

app.put("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, assigneeId, comment } = req.body;
    
    const { rows: tRows } = await pool.query('SELECT status, assignee_id FROM tickets WHERE id = $1', [id]);
    if (tRows.length === 0) return res.sendStatus(404);
    const ticket = tRows[0];

    if (status && status !== ticket.status) {
      const { rows: sRows } = await pool.query('SELECT is_final FROM statuses WHERE name = $1', [status]);
      const isFinal = sRows[0]?.is_final;
      await pool.query('UPDATE tickets SET status = $1, finished_at = $2 WHERE id = $3', [status, (isFinal ? new Date() : null), id]);
      await pool.query('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES ($1, $2, $3)', [id, `Status alterado para ${status}`, req.user.id]);
    }
    
    if (assigneeId !== undefined && assigneeId !== ticket.assignee_id) {
       await pool.query('UPDATE tickets SET assignee_id = $1 WHERE id = $2', [assigneeId, id]);
       await pool.query('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES ($1, $2, $3)', [id, assigneeId ? `Atribuído` : `Desatribuído`, req.user.id]);
    }
    
    if (comment) {
       await pool.query('INSERT INTO ticket_comments (ticket_id, text, user_id) VALUES ($1, $2, $3)', [id, comment, req.user.id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).send(); }
});

app.delete("/api/tickets/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    await pool.query('UPDATE tickets SET deleted = true, status = $1, deleted_at = NOW(), deleted_by = $2, delete_reason = $3 WHERE id = $4', ['Excluído', req.user.id, reason, id]);
    await pool.query('INSERT INTO ticket_history (ticket_id, action, user_id) VALUES ($1, $2, $3)', [id, `Chamado excluído. Motivo: ${reason}`, req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).send(); }
});

// Dashboard
app.get("/api/dashboard", authenticateToken, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    let baseWhere = 'deleted = false';
    let params: any[] = [];
    if (startDate) { params.push(startDate); baseWhere += ` AND created_at >= $1`; }
    if (endDate) { params.push(`${endDate} 23:59:59`); baseWhere += ` AND created_at <= $${params.length}`; }
    
    const { rows } = await pool.query(`SELECT status, bank, priority, sla_deadline FROM tickets WHERE ${baseWhere}`, params);
    
    const stats = {
       abertos: rows.filter((t:any) => t.status === 'Aberto').length,
       emAndamento: rows.filter((t:any) => t.status === 'Em andamento' || t.status === 'Aguardando retorno banco').length,
       finalizados: rows.filter((t:any) => t.status === 'Finalizado').length,
       atrasados: rows.filter((t:any) => t.status !== 'Finalizado' && new Date(t.sla_deadline) < new Date()).length,
       byBank: rows.reduce((acc:any, t:any) => { acc[t.bank] = (acc[t.bank] || 0) + 1; return acc; }, {}),
       byPriority: rows.reduce((acc:any, t:any) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {})
    };
    res.json(stats);
  } catch(e) { res.status(500).send(); }
});

// Admin Users
app.get("/api/admin/users", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const { rows } = await pool.query('SELECT id, name, login, email, role, sector, active, created_at as "createdAt", last_login as "lastLogin", force_password_reset as "forcePasswordReset" FROM users');
    res.json(rows);
  } catch(e) { res.status(500).send(); }
});

app.post("/api/admin/users", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const { name, email, login, role, sector, password } = req.body;
    const pwd = hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, login, role, sector, password, active, force_password_reset) VALUES ($1, $2, $3, $4, $5, $6, true, true) RETURNING id, name, email, role, sector`,
      [name, email, login, role, sector, pwd]
    );
    res.json(rows[0]);
  } catch(e) { console.error(e); res.status(500).send(); }
});

app.put("/api/admin/users/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const id = parseInt(req.params.id);
    const { name, email, login, role, sector, active, password } = req.body;
    if (password) {
       await pool.query('UPDATE users SET name=$1, email=$2, login=$3, role=$4, sector=$5, active=$6, password=$7 WHERE id=$8', [name, email, login, role, sector, active, hashPassword(password), id]);
    } else {
       await pool.query('UPDATE users SET name=$1, email=$2, login=$3, role=$4, sector=$5, active=$6 WHERE id=$7', [name, email, login, role, sector, active, id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).send(); }
});

app.post("/api/admin/users/:id/reset-password", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const tempPassword = Math.random().toString(36).slice(-8);
    await pool.query('UPDATE users SET password = $1, force_password_reset = true WHERE id = $2', [hashPassword(tempPassword), req.params.id]);
    res.json({ success: true, tempPassword });
  } catch(e) { res.status(500).send(); }
});

app.get("/api/admin/logs", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    const { rows } = await pool.query('SELECT * FROM login_logs ORDER BY timestamp DESC');
    res.json(rows.map(toCamel));
  } catch(e) { res.status(500).send(); }
});

// External Params
app.get("/api/params/all", authenticateToken, async (req: any, res) => {
  try {
    const banks = await pool.query('SELECT * FROM banks WHERE deleted = false AND active = true');
    const impTypes = await pool.query('SELECT * FROM import_types WHERE deleted = false AND active = true');
    const prios = await pool.query('SELECT * FROM priorities WHERE deleted = false AND active = true ORDER BY sla ASC');
    const stats = await pool.query('SELECT * FROM statuses WHERE deleted = false AND active = true ORDER BY "order" ASC');
    
    res.json({
      banks: banks.rows.map(toCamel),
      importTypes: impTypes.rows.map(toCamel),
      priorities: prios.rows.map(toCamel),
      statuses: stats.rows.map(toCamel)
    });
  } catch(e) { res.status(500).send(); }
});

const generateCrud = (pathPrefix: string, tableName: string) => {
  app.get(`/api/admin/${pathPrefix}`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    try { const { rows } = await pool.query(`SELECT * FROM ${tableName} WHERE deleted = false`); res.json(rows.map(toCamel)); } catch(e) { res.status(500).send(); }
  });
  app.post(`/api/admin/${pathPrefix}`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'deleted');
      const qCols = keys.map(k => `"${k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())}"`).join(', ');
      const qVals = keys.map((_, i) => `$${i+1}`).join(', ');
      const vals = keys.map(k => req.body[k]);
      const { rows } = await pool.query(`INSERT INTO ${tableName} (${qCols}) VALUES (${qVals}) RETURNING *`, vals);
      res.json(toCamel(rows[0]));
    } catch(e) { console.error(e); res.status(500).send(); }
  });
  app.put(`/api/admin/${pathPrefix}/:id`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    try {
      const keys = Object.keys(req.body).filter(k => k !== 'id' && k !== 'createdAt' && k !== 'deleted');
      const qSet = keys.map((k, i) => `"${k.replace(/[A-Z]/g, m => "_" + m.toLowerCase())}" = $${i+1}`).join(', ');
      const vals = keys.map(k => req.body[k]);
      vals.push(req.params.id);
      const { rows } = await pool.query(`UPDATE ${tableName} SET ${qSet} WHERE id = $${vals.length} RETURNING *`, vals);
      res.json(toCamel(rows[0]));
    } catch(e) { console.error(e); res.status(500).send(); }
  });
  app.delete(`/api/admin/${pathPrefix}/:id`, authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    try {
      await pool.query(`UPDATE ${tableName} SET deleted = true WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch(e) { res.status(500).send(); }
  });
};

generateCrud('banks', 'banks');
generateCrud('import-types', 'import_types');
generateCrud('priorities', 'priorities');
generateCrud('statuses', 'statuses');

// Root Express config
async function startServer() {
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(`[ERRO CRÍTICO] Rota: ${req.url} - `, err.stack);
    res.status(500).json({ error: "Erro interno no servidor." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}
startServer();
