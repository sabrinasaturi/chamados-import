import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Clock, Plus, Search, LayoutGrid, List, FileQuestion, Filter, X, Download } from 'lucide-react';
import { format, isPast, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function TicketsList() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  
  const [view, setView] = useState<'kanban' | 'table'>('table');
  const [search, setSearch] = useState('');
  
  // Advanced Filters
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterBank, setFilterBank] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTickets, resParams, resUsers] = await Promise.all([
         api.get('/tickets'),
         api.get('/params/all'),
         api.get('/users').catch(() => ({ data: [] }))
      ]);
      setTickets(resTickets.data);
      setStatuses(resParams.data.statuses);
      setBanks(resParams.data.banks);
      setPriorities(resParams.data.priorities);
      setUsers(resUsers.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    const headers = ['ID', 'Propostas', 'Banco', 'Tipo', 'Prioridade', 'Status', 'Solicitante', 'Responsável', 'Data Criação', 'Prazo SLA', 'Conclusão'];
    const csvContent = [
      headers.join(','),
      ...filteredTickets.map(t => [
        t.ticketNumber,
        `"${t.proposals.join(',')}"`,
        `"${t.bank}"`,
        `"${t.importType}"`,
        `"${t.priority}"`,
        `"${t.status}"`,
        `"${t.requester.name}"`,
        `"${t.assignee?.name || ''}"`,
        `"${format(new Date(t.createdAt), 'dd/MM/yyyy HH:mm')}"`,
        `"${format(new Date(t.slaDeadline), 'dd/MM/yyyy HH:mm')}"`,
        `"${t.finishedAt ? format(new Date(t.finishedAt), 'dd/MM/yyyy HH:mm') : ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `C2_Chamados_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPriorityBadge = (p: string) => {
    if (p === 'Urgente') return <span className="badge badge-urgent">{p}</span>;
    if (p === 'Crítico') return <span className="badge badge-critical">{p}</span>;
    return <span className="badge badge-normal">{p}</span>;
  };

  const getSlaBadge = (deadline: string) => {
    return (
       <div className="flex items-center text-[11px] font-mono font-bold text-[var(--color-ink-primary)]">
         <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--color-ink-secondary)]" />
         {format(new Date(deadline), 'dd/MM/yyyy HH:mm')}
       </div>
    );
  };

  const getSlaStatusBadge = (ticket: any) => {
     const isFinished = statuses.find(s => s.name === ticket.status)?.isFinal;
     const referenceDate = isFinished && ticket.finishedAt ? new Date(ticket.finishedAt) : new Date();
     const deadlineDate = new Date(ticket.slaDeadline);
     
     const isLate = isPast(deadlineDate) && (!isFinished || isBefore(deadlineDate, referenceDate));
     
     // calculate warning when less than 1 hour remains
     const isWarning = !isFinished && !isLate && (deadlineDate.getTime() - referenceDate.getTime() < 3600000);
     
     if (isLate) return <span className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 border px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest cursor-default" title="SLA Estourado">Em Atraso</span>;
     if (isWarning) return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 border px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest cursor-default" title="Próximo ao Vencimento">Atenção</span>;
     
     return <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 border px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest cursor-default" title="Dentro do Prazo">No Prazo</span>;
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = search ? (
        t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
        t.bank.toLowerCase().includes(search.toLowerCase()) ||
        t.proposals.some((p: string) => p.includes(search))
      ) : true;
      
      const matchPriority = filterPriority.length ? filterPriority.includes(t.priority) : true;
      const matchBank = filterBank.length ? filterBank.includes(t.bank) : true;
      const matchStatus = filterStatus.length ? filterStatus.includes(t.status) : true;
      const matchAssignee = filterAssignee.length ? filterAssignee.includes(t.assigneeId?.toString() || 'unassigned') : true;

      return matchSearch && matchPriority && matchBank && matchStatus && matchAssignee;
    });
  }, [tickets, search, filterPriority, filterBank, filterStatus, filterAssignee]);

  const clearFilters = () => {
    setFilterPriority([]);
    setFilterBank([]);
    setFilterStatus([]);
    setFilterAssignee([]);
    setSearch('');
  };

  const hasActiveFilters = filterPriority.length > 0 || filterBank.length > 0 || filterStatus.length > 0 || filterAssignee.length > 0 || search;

  const toggleFilter = (stateSetter: any, currentState: any[], value: string) => {
    if (currentState.includes(value)) {
      stateSetter(currentState.filter((v: string) => v !== value));
    } else {
      stateSetter([...currentState, value]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)]">Fila Operacional</h1>
            <p className="text-sm text-[var(--color-ink-secondary)]">Gerencie os chamados de importação</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-secondary)]" />
                <input 
                  type="text"
                  placeholder="Buscar número, proposta..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-9 py-2.5 text-sm w-full shadow-sm"
                />
             </div>
             
             <div className="flex items-center gap-2">
                 <button
                   onClick={() => setShowFilters(!showFilters)}
                   className={`p-2.5 rounded-lg border flex items-center gap-2 text-sm font-semibold transition-all shadow-sm ${showFilters || hasActiveFilters ? 'bg-[var(--color-brand-wine)]/10 border-[var(--color-brand-wine)]/30 text-[var(--color-brand-wine)]' : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]'}`}
                 >
                   <Filter className="w-4 h-4" />
                   <span className="hidden sm:inline">Filtros {hasActiveFilters && <span className="ml-1 bg-[var(--color-brand-wine)] text-white text-[10px] px-1.5 py-0.5 rounded-full">{filterPriority.length + filterBank.length + filterStatus.length + filterAssignee.length}</span>}</span>
                 </button>

                 <button
                   onClick={exportToCsv}
                   className="p-2.5 rounded-lg border bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] flex items-center gap-2 text-sm font-semibold transition-all shadow-sm"
                   title="Exportar base filtrada (CSV)"
                 >
                   <Download className="w-4 h-4" />
                 </button>
             </div>

             <div className="flex bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-1 shadow-inner">
                <button 
                  onClick={() => setView('table')} 
                  className={`p-2 rounded-md transition-all ${view === 'table' ? 'bg-[var(--color-bg-card)] text-[var(--color-ink-primary)] shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]'}`}
                  title="Modo Tabela"
                >
                   <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setView('kanban')} 
                  className={`p-2 rounded-md transition-all ${view === 'kanban' ? 'bg-[var(--color-bg-card)] text-[var(--color-ink-primary)] shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)]'}`}
                  title="Modo Kanban"
                >
                   <LayoutGrid className="w-4 h-4" />
                </button>
             </div>
             
             <Link to="/chamados/novo" className="btn-primary py-2.5 px-4 hidden sm:flex shrink-0 shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> Novo Chamado
             </Link>
          </div>
       </div>

       <AnimatePresence>
         {showFilters && (
           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 rounded-2xl shadow-sm mb-2">
                 <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-3">
                   <h3 className="font-bold text-[13px] text-[var(--color-ink-primary)] uppercase tracking-widest flex items-center gap-2"><Filter className="w-4 h-4 text-[var(--color-brand-wine)]" /> Filtros Avançados</h3>
                   {hasActiveFilters && (
                     <button onClick={clearFilters} className="text-[11px] font-bold text-[var(--color-ink-secondary)] hover:text-red-500 uppercase tracking-widest flex items-center gap-1 transition-colors">
                       <X className="w-3.5 h-3.5" /> Limpar Tudo
                     </button>
                   )}
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2.5">Prioridade</label>
                      <div className="flex flex-col gap-2">
                        {priorities.map(p => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={filterPriority.includes(p.name)} onChange={() => toggleFilter(setFilterPriority, filterPriority, p.name)} className="rounded border-[var(--color-border)] text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-primary)] w-4 h-4 transition-all cursor-pointer" />
                             <span className="text-[13px] font-medium text-[var(--color-ink-primary)] group-hover:text-[var(--color-brand-wine)] transition-colors">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2.5">Instituição Financeira</label>
                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                        {banks.map(b => (
                          <label key={b.id} className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={filterBank.includes(b.name)} onChange={() => toggleFilter(setFilterBank, filterBank, b.name)} className="rounded border-[var(--color-border)] text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-primary)] w-4 h-4 transition-all cursor-pointer" />
                             <span className="text-[13px] font-medium text-[var(--color-ink-primary)] group-hover:text-[var(--color-brand-wine)] transition-colors truncate">{b.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2.5">Status Sistêmico</label>
                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                        {statuses.map(s => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={filterStatus.includes(s.name)} onChange={() => toggleFilter(setFilterStatus, filterStatus, s.name)} className="rounded border-[var(--color-border)] text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-primary)] w-4 h-4 transition-all cursor-pointer" />
                             <span className="text-[13px] font-medium text-[var(--color-ink-primary)] group-hover:text-[var(--color-brand-wine)] transition-colors truncate">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-2.5">Responsável Atribuído</label>
                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input type="checkbox" checked={filterAssignee.includes('unassigned')} onChange={() => toggleFilter(setFilterAssignee, filterAssignee, 'unassigned')} className="rounded border-[var(--color-border)] text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-primary)] w-4 h-4 transition-all cursor-pointer" />
                           <span className="text-[13px] font-medium italic text-[var(--color-ink-secondary)]">Sem atribuição</span>
                        </label>
                        {users.filter(u => u.role !== 'SOLICITANTE').map(u => (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={filterAssignee.includes(u.id.toString())} onChange={() => toggleFilter(setFilterAssignee, filterAssignee, u.id.toString())} className="rounded border-[var(--color-border)] text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-primary)] w-4 h-4 transition-all cursor-pointer" />
                             <span className="text-[13px] font-medium text-[var(--color-ink-primary)] group-hover:text-[var(--color-brand-wine)] transition-colors truncate">{u.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                 </div>
              </div>
           </motion.div>
         )}
       </AnimatePresence>

       {loading ? (
         <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border-4 border-[var(--color-brand-wine)]/30 border-t-[var(--color-brand-wine)] animate-spin mb-4"></div>
              <p className="text-sm font-medium text-[var(--color-ink-secondary)]">Carregando fila...</p>
            </div>
         </div>
       ) : view === 'table' ? (
         <div className="glass-panel overflow-hidden flex-1 flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
               <table className="data-table">
                  <thead className="sticky top-0 bg-[var(--color-bg-secondary)] z-10 shadow-sm">
                     <tr>
                        <th>ID Chamado</th>
                        <th>Prioridade</th>
                        <th>Banco / Tipo</th>
                        <th>Propostas</th>
                        <th>SLA Vencimento</th>
                        <th className="w-24">Status SLA</th>
                        <th>Fase Atual</th>
                        <th>Responsável</th>
                     </tr>
                  </thead>
                  <tbody>
                     <AnimatePresence>
                       {filteredTickets.map(t => (
                          <motion.tr 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            key={t.id}
                            className={`group transition-colors ${filterStatus.includes(t.status) ? 'bg-[var(--color-brand-wine)]/5 hover:bg-[var(--color-brand-wine)]/10' : 'hover:bg-[var(--color-bg-secondary)]/50'}`}
                          >
                             <td>
                                <Link to={`/chamados/${t.id}`} className="text-[var(--color-brand-wine)] hover:text-[var(--color-brand-wine-hover)] font-mono font-medium tracking-tight">
                                   {t.ticketNumber}
                                </Link>
                             </td>
                             <td>{getPriorityBadge(t.priority)}</td>
                             <td>
                                <div className="font-semibold text-[var(--color-ink-primary)]">{t.bank}</div>
                                <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] mt-0.5">{t.importType}</div>
                             </td>
                             <td>
                                <div className="flex gap-1.5 flex-wrap">
                                   {t.proposals.slice(0, 2).map((p:string, i:number) => (
                                      <span key={i} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-2 py-0.5 rounded-md text-[11px] font-mono shadow-sm group-hover:bg-[var(--color-bg-card)] transition-colors">{p}</span>
                                   ))}
                                   {t.proposals.length > 2 && <span className="text-[11px] font-bold text-[var(--color-ink-secondary)] self-center ml-1">+{t.proposals.length - 2}</span>}
                                </div>
                             </td>
                             <td>{getSlaBadge(t.slaDeadline)}</td>
                             <td>{getSlaStatusBadge(t)}</td>
                             <td><span className="font-bold text-[12px]">{t.status}</span></td>
                             <td>
                                {t.assignee ? (
                                   <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)] border border-[var(--color-brand-wine)]/20 text-[9px] font-bold flex items-center justify-center shrink-0">
                                         {t.assignee.name.substring(0,2).toUpperCase()}
                                      </div>
                                      <span className="text-[13px] font-medium text-[var(--color-ink-primary)]">{t.assignee.name.split(' ')[0]}</span>
                                   </div>
                                ) : (
                                   <span className="text-[11px] text-[var(--color-ink-secondary)] font-medium italic">Não atribuído</span>
                                )}
                             </td>
                          </motion.tr>
                       ))}
                     </AnimatePresence>
                     {filteredTickets.length === 0 && (
                        <tr>
                           <td colSpan={8}>
                             <div className="flex flex-col items-center justify-center py-20 text-center">
                               <FileQuestion className="w-12 h-12 text-[var(--color-border)] mb-4" />
                               <p className="text-lg font-bold text-[var(--color-ink-primary)]">Fila Vazia</p>
                               <p className="text-sm font-medium text-[var(--color-ink-secondary)] mt-1">Nenhum chamado satisfaz os filtros atuais.</p>
                               {hasActiveFilters && (
                                 <button onClick={clearFilters} className="mt-4 text-[12px] font-bold text-[var(--color-brand-wine)] uppercase tracking-widest hover:underline flex items-center gap-1 mx-auto"><X className="w-4 h-4"/> Limpar Filtros</button>
                               )}
                             </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
       ) : (
         <div className="flex gap-4 flex-1 items-stretch min-h-0 overflow-x-auto pb-4 snap-x">
            {(statuses.length > 0 ? statuses.map(s => s.name) : ['Aberto', 'Em andamento', 'Aguardando retorno banco', 'Finalizado']).map(status => {
               const colTickets = filteredTickets.filter(t => t.status === status);
               return (
                  <div 
                     key={status} 
                     className="w-80 flex-shrink-0 flex flex-col snap-start"
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={async (e) => {
                       e.preventDefault();
                       const ticketId = e.dataTransfer.getData('ticketId');
                       if (ticketId) {
                         try {
                           await api.put(`/tickets/${ticketId}`, { status });
                           fetchData();
                         } catch (err) {}
                       }
                     }}
                  >
                     <div className="flex items-center justify-between mb-3 px-2">
                        <h3 className="font-bold text-[11px] uppercase tracking-widest text-[var(--color-ink-secondary)]">{status}</h3>
                        <span className="bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-ink-primary)] shadow-sm text-[10px] font-bold py-0.5 px-2 rounded-full">
                           {colTickets.length}
                        </span>
                     </div>
                     <div className="flex-1 bg-[var(--color-bg-secondary)] p-3 rounded-2xl border border-[var(--color-border)] overflow-y-auto space-y-3 min-h-[400px]">
                        <AnimatePresence>
                          {colTickets.map(t => (
                             <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={t.id} 
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('ticketId', t.id);
                                }}
                                className="cursor-grab active:cursor-grabbing"
                             >
                                <Link to={`/chamados/${t.id}`} draggable={false} className="block bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4 rounded-xl shadow-sm hover:shadow-md hover:border-[var(--color-brand-wine)]/50 transition-all">
                                   <div className="flex justify-between items-start mb-3">
                                      <span className="font-mono text-xs font-semibold text-[var(--color-brand-wine)]">{t.ticketNumber}</span>
                                      {getPriorityBadge(t.priority)}
                                   </div>
                                   <div className="font-bold text-sm tracking-tight text-[var(--color-ink-primary)] mb-1 outline-none">{t.bank}</div>
                                   <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] italic mb-3">{t.importType}</div>
                                   <div className="flex gap-1.5 flex-wrap mb-4">
                                      {t.proposals.slice(0, 3).map((p:string, i:number) => (
                                         <span key={i} className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--color-ink-secondary)]">{p}</span>
                                      ))}
                                   </div>
                                   <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--color-border)]">
                                      {getSlaStatusBadge(t)}
                                      {t.assignee && (
                                         <div className="w-6 h-6 rounded-md bg-[var(--color-brand-wine)]/10 border border-[var(--color-brand-wine)]/20 text-[var(--color-brand-wine)] text-[9px] font-bold flex items-center justify-center shrink-0" title={t.assignee.name}>
                                            {t.assignee.name.substring(0,2).toUpperCase()}
                                         </div>
                                      )}
                                   </div>
                                </Link>
                             </motion.div>
                          ))}
                        </AnimatePresence>
                        {colTickets.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)]/50 opacity-50">
                             <FileQuestion className="w-8 h-8 mb-2 text-[var(--color-ink-secondary)] opacity-50" />
                             <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)]">Vazia</span>
                          </div>
                        )}
                     </div>
                  </div>
               );
            })}
         </div>
       )}
    </motion.div>
  );
}
