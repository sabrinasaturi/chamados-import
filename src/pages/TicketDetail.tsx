import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { format } from 'date-fns';
import { Clock, MessageSquare, ArrowLeft, User, Trash2, File as FileIcon, Download, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTicket(), fetchStatuses(), fetchAttachments()]);
    setLoading(false);
  }

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStatuses = async () => {
     try {
       const res = await api.get('/params/all');
       setStatuses(res.data.statuses);
     } catch (e) {
       console.error(e);     
     }
  };

  const fetchAttachments = async () => {
     try {
       const res = await api.get(`/tickets/${id}/attachments`);
       setAttachments(res.data);
     } catch (e) {
       console.error(e);
     }
  };

  const downloadAttachment = async (attId: number) => {
    try {
       const res = await api.get(`/attachments/${attId}/download`);
       const { data, name, type } = res.data;
       const link = document.createElement('a');
       link.href = data;
       link.download = name;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    } catch (e) {
       console.error(e);
       alert('Erro ao fazer download do anexo.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.put(`/tickets/${id}`, { status: newStatus });
      fetchTicket();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssign = async () => {
    try {
      await api.put(`/tickets/${id}`, { assigneeId: user?.id });
      fetchTicket();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.put(`/tickets/${id}`, { comment: newComment });
      setNewComment('');
      fetchTicket();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason.trim()) return;
    try {
      await api.delete(`/tickets/${id}`, { data: { reason: deleteReason } });
      setIsDeleteModalOpen(false);
      navigate('/chamados');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !ticket) return (
     <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-10 h-10 rounded-full border-4 border-[var(--color-brand-wine)]/30 border-t-[var(--color-brand-wine)] animate-spin mb-4"></div>
          <p className="text-sm font-medium text-[var(--color-ink-secondary)]">Carregando detalhes do chamado...</p>
        </div>
     </div>
  );

  const canEdit = user?.role === 'IMPORTACAO' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors border border-transparent hover:border-[var(--color-border)] shadow-sm self-start sm:self-center bg-[var(--color-bg-card)]">
           <ArrowLeft className="w-5 h-5 text-[var(--color-ink-secondary)]" />
        </button>
        <div>
           <div className="text-xs font-bold text-[var(--color-brand-wine)] font-mono tracking-widest uppercase mb-1">{ticket.ticketNumber}</div>
           <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink-primary)]">
             {ticket.bank} <span className="text-[var(--color-ink-secondary)] font-normal mx-1">/</span> {ticket.importType}
           </h1>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-3 w-full sm:w-auto">
           {canEdit && ticket.status !== 'Finalizado' && (
             <select 
                value={ticket.status} 
                onChange={(e) => handleStatusChange(e.target.value)}
                className="input-field w-auto font-semibold py-2 shadow-sm"
             >
                {statuses.length > 0 ? statuses.map(s => (
                   <option key={s.id} value={s.name}>{s.name}</option>
                )) : (
                   <>
                     <option value="Aberto">Aberto</option>
                     <option value="Em andamento">Em andamento</option>
                     <option value="Aguardando retorno banco">Aguardando retorno banco</option>
                     <option value="Finalizado">Finalizado</option>
                   </>
                )}
             </select>
           )}
           {canEdit && !ticket.assigneeId && ticket.status !== 'Finalizado' && ticket.status !== 'Excluído' && (
             <button onClick={handleAssign} className="btn-primary py-2 shadow-md">Assumir Chamado</button>
           )}
           {isAdmin && ticket.status !== 'Excluído' && (
             <button onClick={() => setIsDeleteModalOpen(true)} className="btn-secondary text-red-500 py-2 border-red-500/20 hover:bg-red-500/10 shadow-sm" title="Excluir Chamado">
               <Trash2 className="w-4 h-4 mr-2" /> Excluir
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Main content */}
         <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 sm:p-8 space-y-8">
               <div>
                  <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">Propostas Vinculadas</h3>
                  <div className="flex flex-wrap gap-2">
                     {ticket.proposals.map((p:string, i:number) => (
                        <span key={i} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg text-sm font-mono font-medium shadow-sm text-[var(--color-ink-primary)]">{p}</span>
                     ))}
                  </div>
               </div>
               
               <div>
                  <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">Observações Iniciais</h3>
                  <div className="bg-[var(--color-bg-secondary)] p-5 rounded-xl border border-[var(--color-border)] text-sm leading-relaxed whitespace-pre-wrap font-medium text-[var(--color-ink-primary)]">
                     {ticket.observation || <span className="italic text-[var(--color-ink-secondary)]">Nenhuma observação informada pelo solicitante.</span>}
                  </div>
               </div>

               {attachments.length > 0 && (
                 <div>
                    <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3 flex items-center gap-2">
                       <FileIcon className="w-3.5 h-3.5" /> Arquivos Anexados
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {attachments.map((att:any) => (
                          <div key={att.id} className="flex items-center justify-between p-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                             <div className="flex items-center gap-3.5 overflow-hidden">
                                <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)] font-bold text-[10px] uppercase flex items-center justify-center shrink-0 border border-[var(--color-brand-wine)]/20">
                                   {att.extension}
                                </div>
                                <div className="min-w-0">
                                   <p className="text-sm font-semibold truncate text-[var(--color-ink-primary)]" title={att.originalName}>{att.originalName}</p>
                                   <p className="text-[11px] text-[var(--color-ink-secondary)] font-mono font-medium mt-0.5">{formatSize(att.size)} • {att.user?.name}</p>
                                </div>
                             </div>
                             <button 
                               onClick={() => downloadAttachment(att.id)}
                               className="p-2 ml-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] rounded-lg text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] hover:border-[var(--color-brand-wine)]/50 transition-all shrink-0 shadow-sm" 
                               title="Download Anexo"
                             >
                                <Download className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>

            {/* Comments */}
            {canEdit && (
            <div className="glass-panel p-6 sm:p-8">
               <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Histórico de Interações Formais
               </h3>
               
               <div className="space-y-5 mb-8">
                  {ticket.commentsDetails?.length === 0 ? (
                     <div className="text-center bg-[var(--color-bg-secondary)] border border-dashed border-[var(--color-border)] rounded-xl py-8">
                        <MessageSquare className="w-6 h-6 text-[var(--color-ink-secondary)]/50 mx-auto mb-2" />
                        <span className="text-[var(--color-ink-secondary)] text-sm font-medium">Nenhum comentário registrado ainda.</span>
                     </div>
                  ) : (
                    ticket.commentsDetails?.map((c:any, i:number) => (
                       <div key={i} className="flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-sm shrink-0 flex items-center justify-center font-bold text-sm text-[var(--color-ink-primary)] mt-1">
                             {c.user?.name.substring(0,2).toUpperCase()}
                          </div>
                          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-2xl rounded-tl-sm flex-1 shadow-sm">
                             <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-[var(--color-ink-primary)]">{c.user?.name}</span>
                                <span className="text-[11px] font-medium text-[var(--color-ink-secondary)] bg-[var(--color-bg-card)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">{format(new Date(c.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                             </div>
                             <p className="text-sm leading-relaxed text-[var(--color-ink-primary)]">{c.text}</p>
                          </div>
                       </div>
                    ))
                  )}
               </div>

               {canEdit && (
                  <form onSubmit={handleAddComment} className="flex gap-3">
                     <input 
                       type="text" 
                       value={newComment}
                       onChange={e => setNewComment(e.target.value)}
                       placeholder="Escreva um comentário administrativo..." 
                       className="input-field flex-1 py-3 text-sm shadow-sm"
                     />
                     <button type="submit" className="btn-primary py-3 px-6 shadow-md shrink-0">Registrar</button>
                  </form>
               )}
            </div>
            )}
         </div>

         {/* Sidebar details */}
         <div className="space-y-6">
            <div className="glass-panel p-6 space-y-5">
               <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2 border-b border-[var(--color-border)] pb-3">Detalhes do Chamado</h3>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                     <div className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5">Status Atual</div>
                     <div className="font-bold text-sm text-[var(--color-ink-primary)] bg-[var(--color-bg-secondary)] px-3 py-2 rounded-lg border border-[var(--color-border)] shadow-sm flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-brand-wine)] mr-2 shrink-0"></div>
                        {ticket.status}
                     </div>
                  </div>
                  
                  <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                     <div className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5">Prioridade</div>
                     <div className="font-medium text-sm">
                        {ticket.priority === 'Urgente' && <span className="badge badge-urgent text-xs px-3 py-1 shadow-sm">{ticket.priority}</span>}
                        {ticket.priority === 'Crítico' && <span className="badge badge-critical text-xs px-3 py-1 shadow-sm">{ticket.priority}</span>}
                        {ticket.priority === 'Normal' && <span className="badge badge-normal text-xs px-3 py-1 shadow-sm">{ticket.priority}</span>}
                     </div>
                  </div>
               </div>

               <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                  <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Prazo SLA Máximo</div>
                  <div className="font-bold text-sm flex items-center text-red-600 dark:text-red-400 mt-1">
                     <AlertCircle className="w-4 h-4 mr-2" />
                     {format(new Date(ticket.slaDeadline), 'dd/MM/yyyy HH:mm')}
                  </div>
               </div>

               <div className="border-t border-[var(--color-border)] pt-5 space-y-4">
                  <div>
                     <div className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5">Solicitante da Loja</div>
                     <div className="font-medium text-sm flex items-center gap-3 bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center shadow-sm">
                           <User className="w-4 h-4 text-[var(--color-ink-secondary)]" />
                        </div>
                        <span className="text-[var(--color-ink-primary)]">{ticket.requester?.name}</span>
                     </div>
                  </div>
                  <div>
                     <div className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5">Analista Reponsável</div>
                     <div className="font-medium text-sm flex items-center gap-3 bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center shadow-sm">
                           <User className="w-4 h-4 text-[var(--color-ink-secondary)]" />
                        </div>
                        <span className={ticket.assignee ? "text-[var(--color-ink-primary)] font-bold" : "text-[var(--color-ink-secondary)] italic"}>
                           {ticket.assignee?.name || 'Não atribuído'}
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="glass-panel p-6 max-h-[500px] overflow-y-auto">
               <h3 className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-6 flex items-center gap-2 sticky top-0 bg-[var(--color-bg-card)] z-10 pb-2">
                  <Calendar className="w-3.5 h-3.5" /> Auditoria Timeline
               </h3>
               <div className="space-y-5 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-px before:bg-gradient-to-b before:from-[var(--color-brand-wine)]/30 before:via-[var(--color-border)] before:to-transparent pt-2">
                  {ticket.historyDetails?.map((h:any, i:number) => (
                     <div key={i} className="relative flex items-start gap-4 group is-active">
                         <div className="flex items-center justify-center w-4 h-4 mt-0.5 rounded-full border-2 border-[var(--color-brand-wine)] bg-[var(--color-bg-card)] shadow shrink-0 z-10"></div>
                         <div className="flex-1 bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border)] shadow-sm">
                            <div className="text-[10px] font-bold text-[var(--color-ink-secondary)] mb-1 font-mono">{format(new Date(h.timestamp), 'dd/MM/yyyy HH:mm')}</div>
                            <div className="text-sm font-semibold text-[var(--color-ink-primary)] leading-tight">{h.action}</div>
                            <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] mt-1.5 flex items-center gap-1">
                               <User className="w-3 h-3" /> {h.user?.name}
                            </div>
                         </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-card)] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl p-8"
            >
               <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-5 border border-red-500/20">
                  <Trash2 className="w-6 h-6 text-red-500" />
               </div>
               <h2 className="text-xl font-bold mb-2 text-[var(--color-ink-primary)]">
                 Excluir Chamado
               </h2>
               <p className="text-sm text-[var(--color-ink-secondary)] mb-6 leading-relaxed">
                  Tem certeza que deseja excluir o chamado <strong className="text-[var(--color-brand-wine)] font-mono">{ticket.ticketNumber}</strong>? Esta ação o removerá das filas, mas ele permanecerá na auditoria administrativa.
               </p>
               <form onSubmit={handleDeleteTicket} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2 block">Motivo da Exclusão <span className="text-red-500">*</span></label>
                    <textarea 
                       value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} 
                       className="input-field mt-1 h-24 border-red-500/30 focus:border-red-500 shadow-sm" 
                       placeholder="Justificativa administrativa detalhada..." required 
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                     <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="btn-secondary px-6">Cancelar</button>
                     <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700 shadow-md px-6">Confirmar Exclusão</button>
                  </div>
               </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
