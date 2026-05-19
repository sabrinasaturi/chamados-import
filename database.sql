-- Estrutura de Banco de Dados para Produção (PostgreSQL / Supabase)
-- ImportFlow C2

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  login VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  active BOOLEAN DEFAULT true,
  force_password_reset BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Inserir usuário admin padrão (Senha: 123 - com hash sha256)
-- O hash de '123' em sha256 é a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
INSERT INTO users (name, email, login, role, password, sector, active, force_password_reset)
VALUES ('Admin Geral', 'admin@importflow.com', 'admin', 'ADMIN', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'TI', true, false);

-- 2. LOGIN LOGS
CREATE TABLE login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip VARCHAR(50),
  user_agent TEXT
);

-- 3. PARAMETERS

-- Banks
CREATE TABLE banks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  observation TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);

-- Import Types
CREATE TABLE import_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);

-- Priorities
CREATE TABLE priorities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  sla INTEGER DEFAULT 0,
  sla_unit VARCHAR(50) DEFAULT 'horas',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);

-- Statuses
CREATE TABLE statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  "order" INTEGER DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  is_editable BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT false
);

-- 4. TICKETS
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(100) UNIQUE NOT NULL,
  proposals JSONB,
  bank VARCHAR(255),
  import_type VARCHAR(255),
  priority VARCHAR(255),
  observation TEXT,
  status VARCHAR(255),
  requester_id INTEGER REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sla_deadline TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by INTEGER REFERENCES users(id),
  delete_reason TEXT
);

-- 5. TICKET HISTORY
CREATE TABLE ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TICKET COMMENTS
CREATE TABLE ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. ATTACHMENTS
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  internal_name VARCHAR(255) NOT NULL,
  extension VARCHAR(20),
  type VARCHAR(100),
  size INTEGER,
  user_id INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  storage_path VARCHAR(500) -- Caminho no storage (ex: S3, Supabase Storage)
);

-- Índices Recomendados
CREATE INDEX idx_tickets_requester ON tickets(requester_id);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_login_logs_user ON login_logs(user_id);
