import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { Shield, Plus, Edit, UserX, UserCheck, ShieldAlert, Key, ActivitySquare, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function UsersManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [tempPass, setTempPass] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SOLICITANTE');
  const [sector, setSector] = useState('');
  
  const { user } = useAuth();
  
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/logs');
      setLogs(res.data);
      setViewingLogs(true);
    } catch (e) {
      console.error(e);
    }
  };

  const resetPassword = async (u: any) => {
    if (confirm(`Deseja resetar a senha do usuário ${u.name}? Ele precisará cadastrar uma nova no próximo acesso.`)) {
      try {
        const res = await api.post(`/admin/users/${u.id}/reset-password`);
        setTempPass(res.data.tempPassword);
        alert(`Senha resetada com sucesso!\nNova senha temporária: ${res.data.tempPassword}\n\nO usuário deverá alterá-la no próximo acesso.`);
        fetchUsers();
      } catch (e) {
        console.error(e);
        alert('Erro ao resetar senha.');
      }
    }
  };

  const handleOpenModal = (u?: any) => {
    if (u) {
      setEditingUser(u);
      setName(u.name);
      setEmail(u.email);
      setLogin(u.login);
      setPassword(''); // Don't prefill password
      setRole(u.role);
      setSector(u.sector || '');
    } else {
      setEditingUser(null);
      setName('');
      setEmail('');
      setLogin('');
      setPassword('');
      setRole('SOLICITANTE');
      setSector('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { name, email, login, role, sector };
      if (password) payload.password = password; // include only if changed/set
      
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, payload);
      } else {
        if (!password) { alert('Senha é obrigatória para novo usuário'); return; }
        await api.post('/admin/users', payload);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStatus = async (u: any) => {
    if (confirm(`Deseja realmente ${u.active ? 'desativar' : 'ativar'} o usuário ${u.name}?`)) {
      try {
        await api.put(`/admin/users/${u.id}`, { active: !u.active });
        fetchUsers();
      } catch(e) {
        console.error(e);
      }
    }
  };

  if (user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-400">Acesso Negado</div>;
  }

  if (viewingLogs) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
        <div className="flex items-center gap-4">
          <button onClick={() => setViewingLogs(false)} className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors shadow-sm">
             <ArrowLeft className="w-5 h-5 text-[var(--color-ink-secondary)]" />
          </button>
          <div>
             <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)] flex items-center gap-3">
               <ActivitySquare className="text-[var(--color-brand-wine)] w-6 h-6" /> Logs de Acesso
             </h1>
             <p className="text-sm text-[var(--color-ink-secondary)] mt-1">Histórico de autenticações no sistema</p>
          </div>
        </div>
        <div className="glass-panel overflow-hidden flex-1 flex flex-col shadow-sm">
          <div className="overflow-auto flex-1">
            <table className="data-table">
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-secondary)] shadow-sm">
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Endereço IP</th>
                  <th>Device / Browser</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(lg => (
                  <tr key={lg.id} className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                     <td className="text-xs font-mono font-medium text-[var(--color-ink-secondary)]">{format(new Date(lg.timestamp), 'dd/MM/yyyy HH:mm:ss')}</td>
                     <td className="font-bold text-[13px] text-[var(--color-ink-primary)]">{lg.name}</td>
                     <td className="text-xs font-mono text-[var(--color-ink-secondary)]">{lg.ip}</td>
                     <td className="text-xs font-medium text-[var(--color-ink-secondary)] truncate max-w-xs">{lg.userAgent}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-[var(--color-ink-secondary)]">
                      <ActivitySquare className="w-12 h-12 text-[var(--color-border)] mx-auto mb-3" />
                      <p className="font-medium text-lg text-[var(--color-ink-primary)]">Sem Registros</p>
                      <p className="text-sm">Nenhum acesso registrado ainda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)] flex items-center gap-3">
             <Shield className="text-[var(--color-brand-wine)] w-6 h-6" /> Gestão de Usuários
           </h1>
           <p className="text-sm text-[var(--color-ink-secondary)] mt-1">Recursos administrativos e controle de acesso</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button onClick={fetchLogs} className="btn-secondary py-2 px-4 shadow-sm flex-1 sm:flex-none justify-center">
            <ActivitySquare className="w-4 h-4 mr-2" /> Histórico Acessos
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary py-2 px-4 shadow-md flex-1 sm:flex-none justify-center">
            <Plus className="w-4 h-4 mr-2" /> Novo Usuário
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-auto flex-1">
          <table className="data-table">
            <thead className="sticky top-0 z-10 bg-[var(--color-bg-secondary)] shadow-sm">
              <tr>
                <th>Nome Completo</th>
                <th>Dados de Acesso</th>
                <th>Perfil Sistêmico</th>
                <th>Status da Conta</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`${!u.active ? 'opacity-60 bg-[var(--color-bg-secondary)]/30' : 'hover:bg-[var(--color-bg-secondary)]/50'} transition-colors group`}>
                   <td>
                      <div className="flex items-center gap-3">
                         <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm border border-[var(--color-border)] ${u.active ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-ink-secondary)]'}`}>
                            {u.name.substring(0,2).toUpperCase()}
                         </div>
                         <div>
                            <div className="font-bold text-[13px] text-[var(--color-ink-primary)]">{u.name}</div>
                            <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] mt-0.5">{u.email}</div>
                         </div>
                      </div>
                   </td>
                   <td>
                      <div className="font-mono text-xs font-bold text-[var(--color-ink-primary)]">{u.login}</div>
                      <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] mt-0.5">Criado: {format(new Date(u.createdAt), 'dd/MM/yyyy')}</div>
                   </td>
                   <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-critical' : u.role === 'IMPORTACAO' ? 'badge-urgent' : 'badge-normal'} shadow-sm`}>
                        {u.role}
                      </span>
                      {u.forcePasswordReset && <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1.5 uppercase tracking-widest">Troca Senha Pendente</div>}
                   </td>
                   <td>
                      <div className="mb-1.5">
                        {u.active ? <span className="text-[var(--color-status-success)] flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"><UserCheck className="w-3.5 h-3.5" /> Ativo</span> 
                                  : <span className="text-red-500 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"><UserX className="w-3.5 h-3.5" /> Inativo</span>}
                      </div>
                      <div className="text-[11px] font-medium text-[var(--color-ink-secondary)]">
                        Último Acesso: {u.lastLogin ? <span className="font-mono">{format(new Date(u.lastLogin), 'dd/MM/yyyy HH:mm')}</span> : 'Nunca'}
                      </div>
                   </td>
                   <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => resetPassword(u)} className="p-2 text-[var(--color-ink-secondary)] hover:text-amber-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-amber-500/30 transition-all rounded-lg" title="Resetar Senha Administrativa">
                            <Key className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleOpenModal(u)} className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand-wine)]/30 transition-all rounded-lg" title="Editar Usuário">
                            <Edit className="w-4 h-4" />
                         </button>
                         <button onClick={() => toggleStatus(u)} className="p-2 text-[var(--color-ink-secondary)] hover:text-red-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-red-500/30 transition-all rounded-lg" title={u.active ? "Inativar Usuário" : "Ativar Usuário"}>
                            <ShieldAlert className="w-4 h-4" />
                         </button>
                      </div>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-[500px] shadow-2xl p-8"
            >
               <h2 className="text-xl font-bold tracking-tight mb-8 text-[var(--color-ink-primary)] border-b border-[var(--color-border)] pb-4 flex items-center gap-3">
                 <Shield className="w-5 h-5 text-[var(--color-brand-wine)]" />
                 {editingUser ? 'Editar Conta de Usuário' : 'Novo Registro de Usuário'}
               </h2>
               <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Nome Completo</label>
                    <input type="text" value={name} onChange={e=>setName(e.target.value)} className="input-field shadow-sm py-2.5" required />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                     <div>
                       <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Login de Acesso</label>
                       <input type="text" value={login} onChange={e=>setLogin(e.target.value)} className="input-field shadow-sm py-2.5 font-mono text-sm" required />
                     </div>
                     <div>
                       <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Setor Operacional</label>
                       <input type="text" value={sector} onChange={e=>setSector(e.target.value)} className="input-field shadow-sm py-2.5" />
                     </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">E-mail Corporativo</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input-field shadow-sm py-2.5" required />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                     <div>
                       <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Perfil de Acesso</label>
                       <select value={role} onChange={e=>setRole(e.target.value)} className="input-field shadow-sm py-2.5 font-bold" required>
                         <option value="SOLICITANTE">Solicitante Base</option>
                         <option value="IMPORTACAO">Analista Importação</option>
                         <option value="GESTAO">Gestor Operacional</option>
                         <option value="ADMIN">Administrador DTI</option>
                       </select>
                     </div>
                     <div>
                       <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">
                          Senha {editingUser && <span className="font-normal italic normal-case text-[10px] ml-1">(opcional)</span>}
                       </label>
                       <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input-field shadow-sm py-2.5 font-mono text-sm" placeholder={editingUser ? '••••••••' : ''} />
                     </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-[var(--color-border)]">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary py-2.5 px-6 shadow-sm">Cancelar</button>
                     <button type="submit" className="btn-primary py-2.5 px-6 shadow-md">Salvar Registros</button>
                  </div>
               </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
