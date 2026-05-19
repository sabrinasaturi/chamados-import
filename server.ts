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

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "importflow-super-secret-c2";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "importflow-refresh-secret-c2";

const hashPassword = (password: string) => crypto.createHash("sha256").update(password).digest("hex");

// Segurança e Otimização
app.use(helmet({ contentSecurityPolicy: false })); // Permite Vite no dev
app.use(compression());
app.use(cors({ origin: process.env.VITE_APP_URL || '*' }));
app.use(express.json({ limit: "10mb" })); // Prevenção de payload grande

// Logs de acesso
app.use(morgan('combined')); 

// Rate Limiting para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  message: "Muitas tentativas de login, por favor tente novamente mais tarde."
});

// Logs e variáveis globais
let refreshTokens: string[] = []; // Em memória; num DB, guarde na tabela refresh_tokens

// Configuração de Upload Seguro
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''); // Sanitização do nome original
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const allowedMimes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];
const fileFilter = (req: any, file: any, cb: any) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Extensão de arquivo não permitida para segurança."), false);
  }
};
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite: 10MB
  fileFilter: fileFilter
});
let users = [
  { id: 1, name: "Admin Geral", email: "admin@importflow.com", login: "admin", role: "ADMIN", password: hashPassword("123"), sector: "TI", active: true, forcePasswordReset: false, createdAt: new Date().toISOString(), lastLogin: null }
];

let loginLogs: any[] = [];


let tickets: any[] = [];

let ticketCounter = 1001;
let userCounter = 2;

// --- Parametrizations Mock ---

let banks = [
  { id: 1, name: "Banco Itaú", code: "341", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false },
  { id: 2, name: "Bradesco", code: "237", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false },
  { id: 3, name: "Santander", code: "033", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false },
  { id: 4, name: "Caixa Econômica", code: "104", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false },
  { id: 5, name: "Banco do Brasil", code: "001", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false },
  { id: 6, name: "Safra", code: "422", active: true, observation: "", createdAt: new Date().toISOString(), deleted: false }
];

let importTypes = [
  { id: 1, name: "Produção", description: "Importação de produção diária", color: "#3b82f6", active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 2, name: "Comissão", description: "Importação de relatórios de comissão", color: "#8b5cf6", active: true, createdAt: new Date().toISOString(), deleted: false }
];

let priorities = [
  { id: 1, name: "Normal", color: "#64748b", sla: 4, slaUnit: "horas", active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 2, name: "Urgente", color: "#eab308", sla: 2, slaUnit: "horas", active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 3, name: "Crítico", color: "#ef4444", sla: 0, slaUnit: "imediato", active: true, createdAt: new Date().toISOString(), deleted: false }
];

let statusesArr = [
  { id: 1, name: "Aberto", color: "#3b82f6", order: 1, isFinal: false, isEditable: true, active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 2, name: "Em andamento", color: "#eab308", order: 2, isFinal: false, isEditable: true, active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 3, name: "Aguardando retorno banco", color: "#a855f7", order: 3, isFinal: false, isEditable: true, active: true, createdAt: new Date().toISOString(), deleted: false },
  { id: 4, name: "Finalizado", color: "#22c55e", order: 4, isFinal: true, isEditable: false, active: true, createdAt: new Date().toISOString(), deleted: false }
];

let bankCounter = 7;
let importTypeCounter = 3;
let priorityCounter = 4;
let statusCounter = 5;

let attachmentCounter = 1;
let attachmentsDB: any[] = [];

// ... Auth Middleware ...
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API Routes ---

app.post("/api/login", authLimiter, (req, res) => {
  const { email, password } = req.body;
  const hash = hashPassword(password);
  const user = users.find(u => (u.email === email || u.login === email) && u.password === hash && u.active);
  if (user) {
    user.lastLogin = new Date().toISOString() as any;
    loginLogs.push({ id: Date.now(), userId: user.id, name: user.name, timestamp: user.lastLogin, ip: req.ip || '127.0.0.1', userAgent: req.headers['user-agent'] || 'Unknown' });
    console.log(`[AUTH] Usuário logado: ${user.name}`);

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, forcePasswordReset: user.forcePasswordReset }, SECRET_KEY, { expiresIn: '15m' }); // 15 min expiration
    const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
    refreshTokens.push(refreshToken);
    res.json({ token, refreshToken, user: { id: user.id, name: user.name, role: user.role, email: user.email, forcePasswordReset: user.forcePasswordReset } });
  } else {
    console.warn(`[AUTH] Falha de login para o email: ${email}`);
    res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  }
});

app.post("/api/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);
  if (!refreshTokens.includes(token)) return res.sendStatus(403);
  
  jwt.verify(token, REFRESH_SECRET, (err: any, tokenUser: any) => {
    if (err) return res.sendStatus(403);
    const user = users.find(u => u.id === tokenUser.id);
    if (!user || (!user.active)) return res.sendStatus(403);
    const newAccessToken = jwt.sign({ id: user.id, role: user.role, name: user.name, forcePasswordReset: user.forcePasswordReset }, SECRET_KEY, { expiresIn: '15m' });
    res.json({ token: newAccessToken });
  });
});

app.post("/api/logout", (req, res) => {
  const { token } = req.body;
  refreshTokens = refreshTokens.filter(rt => rt !== token);
  console.log(`[AUTH] Sessão encerrada.`);
  res.sendStatus(204);
});

app.post("/api/users/change-password", authenticateToken, (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  const user: any = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).send();

  if (user.password !== hashPassword(currentPassword)) {
    return res.status(400).json({ error: "Senha atual incorreta." });
  }

  user.password = hashPassword(newPassword);
  user.forcePasswordReset = false;
  res.json({ success: true });
});

// Get user profile
app.get("/api/users/me", authenticateToken, (req: any, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (user) {
    res.json({ id: user.id, name: user.name, role: user.role, email: user.email, forcePasswordReset: user.forcePasswordReset });
  } else {
    res.status(404).send();
  }
});

app.get("/api/users", authenticateToken, (req: any, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email })));
});

// Tickets
app.get("/api/tickets", authenticateToken, (req: any, res) => {
  let filtered = tickets.filter(t => !t.deleted);
  // If requester, see only theirs (unless gestao/admin)
  if (req.user.role === 'SOLICITANTE') {
    filtered = filtered.filter(t => t.requesterId === req.user.id);
  }
  
  const mapped = filtered.map(t => ({
    ...t,
    requester: users.find(u => u.id === t.requesterId),
    assignee: users.find(u => u.id === t.assigneeId)
  }));
  res.json(mapped);
});

app.post("/api/tickets", authenticateToken, (req: any, res) => {
  const { proposals, bank, importType, priority, observation, attachments } = req.body;
  
  const priorObj = priorities.find(p => p.name === priority) || { sla: 4, slaUnit: 'horas' };

  let slaMs = 0;
  if (priorObj.slaUnit === 'minutos') slaMs = priorObj.sla * 60 * 1000;
  else if (priorObj.slaUnit === 'horas') slaMs = priorObj.sla * 60 * 60 * 1000;
  else if (priorObj.slaUnit === 'dias') slaMs = priorObj.sla * 24 * 60 * 60 * 1000;

  const ticket = {
    id: ticketCounter++,
    ticketNumber: `TKT-${ticketCounter}`,
    proposals: Array.isArray(proposals) ? proposals : proposals.split(',').map((p:string)=>p.trim()).filter((p:string)=>p),
    bank,
    importType,
    priority,
    observation,
    status: statusesArr.find(s=>s.order===1)?.name || "Aberto",
    requesterId: req.user.id,
    assigneeId: null,
    createdAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + slaMs).toISOString(),
    history: [{ action: "Chamado criado", timestamp: new Date().toISOString(), userId: req.user.id }],
    comments: [],
    deleted: false
  };
  
  if (attachments && Array.isArray(attachments)) {
    for (let att of attachments) {
      // Validation extension and type
      const ext = att.name.split('.').pop()?.toLowerCase();
      const validExts = ['csv', 'xlsx', 'xls', 'pdf', 'txt', 'png', 'jpg', 'jpeg'];
      if (!validExts.includes(ext)) {
        return res.status(400).json({ error: `Extensão .${ext} não permitida.` });
      }
      
      if (att.size > 10 * 1024 * 1024) { // 10MB limit
        return res.status(400).json({ error: `Arquivo ${att.name} excede o limite de 10MB.` });
      }

      // Safe renaming
      const safeName = att.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const uniqueInternalName = `att_${Date.now()}_${Math.floor(Math.random()*1000)}_${safeName}`;

      attachmentsDB.push({
        id: attachmentCounter++,
        ticketId: ticket.id,
        originalName: att.name,
        internalName: uniqueInternalName,
        extension: ext,
        type: att.type,
        size: att.size,
        userId: req.user.id,
        uploadedAt: new Date().toISOString(),
        data: att.data
      });
      
      ticket.history.push({ 
        action: `Anexo adicionado: ${att.name}`, 
        timestamp: new Date().toISOString(), 
        userId: req.user.id 
      });
    }
  }
  
  tickets.push(ticket as any);
  res.json(ticket);
});

app.get("/api/tickets/:id/attachments", authenticateToken, (req: any, res) => {
  const ticketId = parseInt(req.params.id);
  const atts = attachmentsDB.filter(a => a.ticketId === ticketId).map(a => ({
    id: a.id,
    originalName: a.originalName,
    extension: a.extension,
    size: a.size,
    uploadedAt: a.uploadedAt,
    user: users.find(u => u.id === a.userId)
  }));
  res.json(atts);
});

app.get("/api/attachments/:id/download", authenticateToken, (req: any, res) => {
  const att = attachmentsDB.find(a => a.id === parseInt(req.params.id));
  if (!att) return res.sendStatus(404);
  res.json({ data: att.data, name: att.originalName, type: att.type });
});

app.get("/api/tickets/:id", authenticateToken, (req: any, res) => {
  const ticket = tickets.find(t => t.id === parseInt(req.params.id));
  if (ticket) {
    res.json({
        ...ticket,
        requester: users.find(u => u.id === ticket.requesterId),
        assignee: users.find(u => u.id === ticket.assigneeId),
        historyDetails: ticket.history.map((h: any) => ({...h, user: users.find(u=> u.id === h.userId)})),
        commentsDetails: ticket.comments.map((c: any) => ({...c, user: users.find(u=> u.id === c.userId)}))
    });
  } else {
    res.status(404).send();
  }
});

app.put("/api/tickets/:id", authenticateToken, (req: any, res) => {
  const ticketId = parseInt(req.params.id);
  const { status, assigneeId, comment } = req.body;
  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  
  if (ticketIndex === -1) return res.status(404).send();
  
  let ticket: any = tickets[ticketIndex];
  
  if (status && status !== ticket.status) {
      ticket.history.push({ action: `Status alterado para ${status}`, timestamp: new Date().toISOString(), userId: req.user.id });
      ticket.status = status;
      const isFinal = statusesArr.find(s => s.name === status)?.isFinal;
      if (isFinal && !ticket.finishedAt) {
          ticket.finishedAt = new Date().toISOString();
      } else if (!isFinal) {
          ticket.finishedAt = null;
      }
  }
  
  if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
       ticket.history.push({ action: assigneeId ? `Atribuído` : `Desatribuído`, timestamp: new Date().toISOString(), userId: req.user.id });
       ticket.assigneeId = assigneeId;
  }
  
  if (comment) {
      ticket.comments.push({ text: comment, timestamp: new Date().toISOString(), userId: req.user.id });
  }

  tickets[ticketIndex] = ticket;
  res.json(ticket);
});

// Dashboard stats
app.get("/api/dashboard", authenticateToken, (req: any, res) => {
   const now = new Date();
   let activeTickets = tickets.filter(t => !t.deleted);

   const { startDate, endDate } = req.query;
   if (startDate) {
       const start = new Date(startDate as string);
       activeTickets = activeTickets.filter(t => {
           const ticketDate = new Date(t.createdAt);
           return ticketDate >= start;
       });
   }
   if (endDate) {
       const end = new Date(endDate as string);
       end.setHours(23, 59, 59, 999);
       activeTickets = activeTickets.filter(t => {
           const ticketDate = new Date(t.createdAt);
           return ticketDate <= end;
       });
   }
   
   const stats = {
       abertos: activeTickets.filter(t => t.status === 'Aberto').length,
       emAndamento: activeTickets.filter(t => t.status === 'Em andamento' || t.status === 'Aguardando retorno banco').length,
       finalizados: activeTickets.filter(t => t.status === 'Finalizado').length,
       atrasados: activeTickets.filter(t => t.status !== 'Finalizado' && new Date(t.slaDeadline) < now).length,
       byBank: activeTickets.reduce((acc: any, t) => {
           acc[t.bank] = (acc[t.bank] || 0) + 1;
           return acc;
       }, {}),
       byPriority: activeTickets.reduce((acc: any, t) => {
           acc[t.priority] = (acc[t.priority] || 0) + 1;
           return acc;
       }, {})
   }
   res.json(stats);
});

// Admin Users
app.get("/api/admin/users", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(users.map(u => ({ id: u.id, name: u.name, login: u.login, email: u.email, role: u.role, sector: u.sector, active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin, forcePasswordReset: u.forcePasswordReset })));
});

app.post("/api/admin/users", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const newUser = { 
    id: userCounter++, 
    ...req.body, 
    password: hashPassword(req.body.password),
    active: true, 
    forcePasswordReset: true, 
    createdAt: new Date().toISOString(), 
    lastLogin: null 
  };
  users.push(newUser);
  res.json(newUser);
});

app.put("/api/admin/users/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const id = parseInt(req.params.id);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.sendStatus(404);
  
  const payload = { ...req.body };
  if (payload.password) {
    payload.password = hashPassword(payload.password);
  } else {
    delete payload.password;
  }
  
  users[idx] = { ...users[idx], ...payload };
  res.json(users[idx]);
});

app.post("/api/admin/users/:id/reset-password", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const id = parseInt(req.params.id);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.sendStatus(404);
  
  const tempPassword = Math.random().toString(36).slice(-8); // Generate random simple password
  users[idx].password = hashPassword(tempPassword);
  users[idx].forcePasswordReset = true;
  
  res.json({ success: true, tempPassword });
});

app.get("/api/admin/logs", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(loginLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
});

// Delete Ticket
app.delete("/api/tickets/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  const idx = tickets.findIndex(t => t.id === id);
  if (idx === -1) return res.sendStatus(404);
  
  tickets[idx].deleted = true;
  tickets[idx].status = 'Excluído';
  tickets[idx].deletedBy = req.user.id;
  tickets[idx].deletedAt = new Date().toISOString();
  tickets[idx].deleteReason = reason;
  tickets[idx].history.push({ action: `Chamado excluído. Motivo: ${reason}`, timestamp: new Date().toISOString(), userId: req.user.id });
  
  res.json({ success: true });
});


// --- External Endpoints ---
app.get("/api/params/all", authenticateToken, (req: any, res) => {
  res.json({
    banks: banks.filter(b => !b.deleted && b.active),
    importTypes: importTypes.filter(i => !i.deleted && i.active),
    priorities: priorities.filter(p => !p.deleted && p.active).sort((a,b) => a.sla - b.sla),
    statuses: statusesArr.filter(s => !s.deleted && s.active).sort((a,b) => a.order - b.order)
  });
});

app.get("/api/admin/banks", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(banks.filter(b => !b.deleted));
});
app.post("/api/admin/banks", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const newItem = { id: bankCounter++, ...req.body, createdAt: new Date().toISOString(), deleted: false };
  banks.push(newItem);
  res.json(newItem);
});
app.put("/api/admin/banks/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = banks.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  banks[idx] = { ...banks[idx], ...req.body };
  res.json(banks[idx]);
});
app.delete("/api/admin/banks/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = banks.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  banks[idx].deleted = true;
  res.json({ success: true });
});

// Import Types
app.get("/api/admin/import-types", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(importTypes.filter(b => !b.deleted));
});
app.post("/api/admin/import-types", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const newItem = { id: importTypeCounter++, ...req.body, createdAt: new Date().toISOString(), deleted: false };
  importTypes.push(newItem);
  res.json(newItem);
});
app.put("/api/admin/import-types/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = importTypes.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  importTypes[idx] = { ...importTypes[idx], ...req.body };
  res.json(importTypes[idx]);
});
app.delete("/api/admin/import-types/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = importTypes.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  importTypes[idx].deleted = true;
  res.json({ success: true });
});

// Priorities
app.get("/api/admin/priorities", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(priorities.filter(b => !b.deleted));
});
app.post("/api/admin/priorities", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const newItem = { id: priorityCounter++, ...req.body, createdAt: new Date().toISOString(), deleted: false };
  priorities.push(newItem);
  res.json(newItem);
});
app.put("/api/admin/priorities/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = priorities.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  priorities[idx] = { ...priorities[idx], ...req.body };
  res.json(priorities[idx]);
});
app.delete("/api/admin/priorities/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = priorities.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  priorities[idx].deleted = true;
  res.json({ success: true });
});

// Statuses
app.get("/api/admin/statuses", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  res.json(statusesArr.filter(b => !b.deleted).sort((a,b) => a.order - b.order));
});
app.post("/api/admin/statuses", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const newItem = { id: statusCounter++, ...req.body, createdAt: new Date().toISOString(), deleted: false };
  statusesArr.push(newItem);
  res.json(newItem);
});
app.put("/api/admin/statuses/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = statusesArr.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  statusesArr[idx] = { ...statusesArr[idx], ...req.body };
  res.json(statusesArr[idx]);
});
app.delete("/api/admin/statuses/:id", authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  const idx = statusesArr.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.sendStatus(404);
  statusesArr[idx].deleted = true;
  res.json({ success: true });
});


async function startServer() {
  // Global Error Handler Middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(`[ERRO CRÍTICO] Rota: ${req.url} - `, err.stack);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor. A equipe técnica já foi notificada." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
