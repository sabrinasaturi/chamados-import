# Guia de Deploy de Produção - ImportFlow C2

Este guia documenta o passo a passo para colocar o ImportFlow C2 em ambiente de produção utilizando Supabase (Banco de Dados), Render (Backend Node.js) e Vercel (Frontend React).

---

## 1. Banco de Dados (Supabase)

O primeiro passo é provisionar a infraestrutura de dados.
1. Crie uma conta no [Supabase](https://supabase.com).
2. Crie um novo projeto. O Supabase irá fornecer as credenciais do banco de dados (String de conexão PostgreSQL ou `DATABASE_URL`).
3. Vá no painel lateral do Supabase, em **"SQL Editor"**, clique em "New query".
4. Copie todo o conteúdo do arquivo `database.sql` presente na raiz do seu projeto e cole no SQL Editor do Supabase.
5. Clique em **"Run"**.
   > *Isso irá criar toda a estrutura de tabelas, índices e funções. Também irá criar o usuário "Admin" padrão com as credenciais (login: admin / senha: 123).*
6. **(Importante)** Vá nas configurações do projeto Supabase -> "Database" e anote a sua **Connection String** padrão. Você precisará dela no Backend.

---

## 2. Backend (Render.com)

Preparando o código da API Express para produção. Atualmente ele roda "in-memory" e está preparado estruturalmente. Para produção estrita com Supabase será necessário instalar um ORM (como Prisma ou TypeORM) ou o cliente `pg` para conectar as rotas diretamente nas tabelas (`database.sql`).

**Passo a Passo de Deploy no Render**:
1. Crie uma conta no [Render](https://render.com).
2. Crie um novo **Web Service**.
3. Conecte com o repositório GitHub onde está o código do projeto.
4. Preencha os campos:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Na seção **Environment Variables**, adicione as variáveis (como no arquivo `.env.example`):
   - `JWT_SECRET` = _(Gere uma chave longa e secreta)_
   - `VITE_APP_URL` = _Temporariamente deixe como `*`, mas depois altere para a URL final do frontend na Vercel (ex: `https://meu-app.vercel.app`)_
   - `DATABASE_URL` = _(Cole a connection string do Supabase que você obteve no passo 1)_
   - `PORT` = `3000` (Geralmente o Render define automaticamente, mas é bom documentar)
6. Finalize e aguarde o deploy. Quando concluir, copie a **URL** do serviço (ex: `https://importflow-backend.onrender.com`).

---

## 3. Frontend (Vercel)

1. Crie uma conta na [Vercel](https://vercel.com).
2. Clique em **Add New -> Project**.
3. Importe o mesmo repositório do GitHub.
4. A Vercel detectará que é um projeto Vite/React automaticamente.
5. Antes de clicar no botão "Deploy", expanda a aba **Environment Variables**.
6. Adicione a seguinte variável:
   - Name: `VITE_API_URL`
   - Value: `https://importflow-backend.onrender.com/api` *(Substitua pela URL base fornecida no Render e mantenha o /api no final)*
7. Clique em **Deploy** e aguarde 1 a 2 minutos.
8. Ao concluir o deploy, a Vercel informará a URL final (ex: `https://importflow.vercel.app`).
9. **Finalizando a Segurança (CORS)**: Volte no painel do **Render** (Backend), vá em Environment Variables, mude a variável `VITE_APP_URL` de `*` para a exata URL fornecida pela Vercel (`https://importflow.vercel.app`), garantindo que apenas o seu frontend se aproprie do backend.

---

## 4. Estrutura de Arquivos Estáticos e Responsividade

Para completar os builds otimizados e garantir arquivos compactos (responsividade, carregamento elegante):
- O script `npm run build` cria o frontend estático e também gera um pacote CommonJS (`dist/server.cjs`) otimizado sem source-map da API (configurado no `package.json`).
- Para armazenamento de rotina (arquivos de anexo), considere utilizar o **Supabase Storage**.

## 5. Backup (Supabase)
O banco de dados PostgreSQL do Supabase já possui **Backup Automático Diário**.
- Realiza retenção padrão nos planos PITR (Point in Time Recovery) da plataforma.
- Certifique-se de configurar ou verificar as políticas de backup no painel "Database > Backups".
- Exportações manuais de esquemas/dados podem ser feitas via CLI local (`supabase db dump`).

## 6. Primeiro Acesso
- Entre no endereço público que a Vercel gerou.
- Realize o login com a credencial criada pelo script `.sql`:
  - Login: `admin@importflow.com` (ou login: `admin`)
  - Senha: `123`
- *Lembre-se de ir até as "Configurações" logo no primeiro acesso e alterar esta senha inicial!!*
