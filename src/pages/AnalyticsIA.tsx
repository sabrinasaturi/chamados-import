import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { BrainCircuit, Loader2, AlertTriangle, Lightbulb, Filter, Calendar, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

type DatePreset = 'today' | '7days' | '30days' | 'thisMonth' | 'custom' | 'all';

export default function AnalyticsIA() {
  const { user } = useAuth();
  const [data, setData] = useState<{ summary: string, insights: string[], bottlenecks: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [filterBank, setFilterBank] = useState('');
  const [filterImportType, setFilterImportType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [options, setOptions] = useState({ banks: [], importTypes: [], statuses: [], priorities: [], users: [] });

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'GESTAO') return;
    Promise.all([
       api.get('/params/all'), api.get('/users')
    ]).then(([paramsRes, u]) => {
       setOptions({ 
           banks: paramsRes.data.banks || [], 
           importTypes: paramsRes.data.importTypes || [], 
           statuses: paramsRes.data.statuses || [], 
           priorities: paramsRes.data.priorities || [], 
           users: u.data.filter((x:any)=>x.active) 
       });
    }).catch(console.error);
  }, [user]);

  const dateRange = useMemo(() => {
    const today = new Date();
    switch (datePreset) {
      case 'today': return { start: startOfDay(today).toISOString(), end: endOfDay(today).toISOString() };
      case '7days': return { start: startOfDay(subDays(today, 7)).toISOString(), end: endOfDay(today).toISOString() };
      case '30days': return { start: startOfDay(subDays(today, 30)).toISOString(), end: endOfDay(today).toISOString() };
      case 'thisMonth': return { start: startOfMonth(today).toISOString(), end: endOfDay(today).toISOString() };
      case 'custom': {
        if (!customStart && !customEnd) return undefined;
        const s = customStart ? startOfDay(new Date(customStart + 'T00:00:00')).toISOString() : undefined;
        const e = customEnd ? endOfDay(new Date(customEnd + 'T00:00:00')).toISOString() : undefined;
        return { start: s, end: e };
      }
      case 'all': return null;
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'GESTAO') return;
    if (datePreset === 'custom' && (!customStart || !customEnd)) return;
    loadInsights();
  }, [dateRange, filterBank, filterImportType, filterStatus, filterPriority, filterAssignee]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);
      if (filterBank) params.append('bank', filterBank);
      if (filterImportType) params.append('importType', filterImportType);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterAssignee) params.append('assignee', filterAssignee);

      const res = await api.get(`/analytics/insights?${params.toString()}`);
      setData(res.data);
    } catch (e: any) {
      console.error("[ANALYTICS] Falha:", e?.message || e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'GESTAO') {
    return <div className="p-8 text-center text-red-500">Acesso Negado</div>;
  }

  const renderFilterButton = () => {
     const labels: Record<DatePreset, string> = { today: 'Hoje', '7days': 'Últimos 7 dias', '30days': 'Últimos 30 dias', thisMonth: 'Este mês', custom: 'Personalizado', all: 'Todo o Período' };
     return labels[datePreset];
  };

  const hasActiveFilters = !!(filterBank || filterImportType || filterStatus || filterPriority || filterAssignee);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)] flex items-center gap-3">
             <BrainCircuit className="text-[var(--color-brand-wine)] w-7 h-7" /> Gestão Inteligente
           </h1>
           <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
             Geração automática de inteligência analítica baseada no contexto filtrado.
           </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
             <button onClick={() => setShowFiltersPanel(!showFiltersPanel)} className={`border px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-between shadow-sm hover:shadow-md transition-all gap-2 ${hasActiveFilters ? 'bg-[var(--color-brand-wine)] text-white border-[var(--color-brand-wine)]' : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-ink-primary)]'}`}>
                <Filter className="w-4 h-4" />
                Contexto {hasActiveFilters && '(Ativos)'}
                <ChevronDown className="w-4 h-4 ml-1 opacity-80" />
             </button>
             <AnimatePresence>
                {showFiltersPanel && (
                   <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 p-4 space-y-4">
                       <div className="grid grid-cols-1 gap-3">
                          <div>
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Banco</label>
                             <select value={filterBank} onChange={e => setFilterBank(e.target.value)} className="input-field text-sm py-2 px-2 w-full bg-[var(--color-bg-secondary)]">
                                <option value="">Todos</option>
                                {options.banks.map((b:any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Tipo de Importação</label>
                             <select value={filterImportType} onChange={e => setFilterImportType(e.target.value)} className="input-field text-sm py-2 px-2 w-full bg-[var(--color-bg-secondary)]">
                                <option value="">Todos</option>
                                {options.importTypes.map((t:any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Status</label>
                             <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field text-sm py-2 px-2 w-full bg-[var(--color-bg-secondary)]">
                                <option value="">Todos</option>
                                {options.statuses.map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Prioridade</label>
                             <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input-field text-sm py-2 px-2 w-full bg-[var(--color-bg-secondary)]">
                                <option value="">Todas</option>
                                {options.priorities.map((p:any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Responsável</label>
                             <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="input-field text-sm py-2 px-2 w-full bg-[var(--color-bg-secondary)]">
                                <option value="">Todos</option>
                                {options.users.map((u:any) => <option key={u.id} value={u.name}>{u.name}</option>)}
                             </select>
                          </div>
                       </div>
                       { hasActiveFilters && (
                         <button onClick={() => { setFilterBank(''); setFilterImportType(''); setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setShowFiltersPanel(false); }} className="w-full text-xs text-red-500 font-semibold py-2 hover:bg-red-50 rounded mt-2">
                           Limpar Contexto
                         </button>
                       )}
                   </motion.div>
                )}
             </AnimatePresence>
          </div>

          <div className="relative">
             <button 
               onClick={() => setShowFilterDropdown(!showFilterDropdown)}
               className="bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-ink-primary)] flex items-center justify-between min-w-[210px] shadow-sm hover:shadow-md transition-all"
             >
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-[var(--color-ink-secondary)]" />
                   {renderFilterButton()}
                </div>
                <ChevronDown className="w-4 h-4 text-[var(--color-ink-secondary)] ml-2" />
             </button>
             <AnimatePresence>
                {showFilterDropdown && (
                   <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 p-2">
                      <div className="flex flex-col space-y-1">
                         <button onClick={() => { setDatePreset('all'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'all' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Todo o Período</button>
                         <button onClick={() => { setDatePreset('today'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'today' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Hoje</button>
                         <button onClick={() => { setDatePreset('7days'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === '7days' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Últimos 7 dias</button>
                         <button onClick={() => { setDatePreset('30days'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === '30days' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Últimos 30 dias</button>
                         <button onClick={() => { setDatePreset('thisMonth'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'thisMonth' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Este mês</button>
                         <button onClick={() => setDatePreset('custom')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'custom' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Personalizado</button>
                      </div>
                      {datePreset === 'custom' && (
                         <div className="mt-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] space-y-3">
                            <div>
                               <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Início</label>
                               <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field text-xs py-1.5 px-2 w-full" />
                            </div>
                            <div>
                               <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-secondary)] mb-1 block">Fim</label>
                               <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field text-xs py-1.5 px-2 w-full" />
                            </div>
                         </div>
                      )}
                   </motion.div>
                )}
             </AnimatePresence>
          </div>
          <button onClick={loadInsights} disabled={loading} className="btn-secondary py-2 px-4 shadow-sm text-sm disabled:opacity-50">
             {loading ? 'Analisando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
             <Loader2 className="w-10 h-10 animate-spin text-[var(--color-brand-wine)]" />
             <p className="font-bold text-[var(--color-ink-secondary)] animate-pulse">A Inteligência Artificial está analisando as métricas e montando o relatório...</p>
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center p-14 text-center rounded-2xl bg-white border border-gray-100 shadow-sm gap-4">
             <AlertTriangle className="w-12 h-12 text-red-500/80" />
             <div className="space-y-1">
               <h3 className="font-bold text-lg text-gray-900">Erro na Integração da IA</h3>
               <p className="text-gray-500 max-w-sm">Houve uma instabilidade ao conectar com o modelo preditivo e montar as métricas da operação.</p>
             </div>
             <button onClick={loadInsights} className="btn-secondary py-2 px-4 shadow-sm text-sm mt-2">
                Tentar novamente
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
             
             {/* Resumo */}
             <div className="glass-panel p-6 lg:p-8 col-span-1 lg:col-span-2 shadow-md bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-brand-wine)]/5">
                <h3 className="text-sm font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest flex items-center gap-2 mb-4">
                  <BrainCircuit className="w-4 h-4 text-[var(--color-brand-wine)]" /> Health check global
                </h3>
                <p className="text-lg lg:text-xl font-medium text-[var(--color-ink-primary)] leading-relaxed">
                  {data.summary}
                </p>
             </div>

             {/* Insights */}
             <div className="glass-panel p-6 lg:p-8 flex flex-col gap-4 border-t-4 border-t-emerald-500/80">
                <h3 className="text-sm font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-2">
                  <Lightbulb className="w-4 h-4 text-emerald-500" /> Insights & Oportunidades
                </h3>
                {(data.insights || []).length === 0 ? (
                  <p className="text-sm italic text-[var(--color-ink-secondary)]">Sem insights operacionais (volumetria baixa)</p>
                ) : (
                  <ul className="space-y-4">
                    {(data.insights || []).map((insight, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[var(--color-ink-primary)] leading-relaxed">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 shrink-0 flex items-center justify-center mt-0.5">
                           <CheckIcon className="w-3 h-3 text-emerald-600" />
                        </div>
                        {insight}
                      </li>
                    ))}
                  </ul>
                )}
             </div>

             {/* Gargalos */}
             <div className="glass-panel p-6 lg:p-8 flex flex-col gap-4 border-t-4 border-t-red-500/80">
                <h3 className="text-sm font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Gargalos & Alertas
                </h3>
                {(data.bottlenecks || []).length === 0 ? (
                  <p className="text-sm italic text-[var(--color-ink-secondary)]">Sem gargalos detectados na avaliação atual</p>
                ) : (
                  <ul className="space-y-4">
                    {(data.bottlenecks || []).map((b, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[var(--color-ink-primary)] leading-relaxed">
                        <div className="w-5 h-5 rounded-full bg-red-500/20 shrink-0 flex items-center justify-center mt-0.5">
                           <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                        </div>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
             </div>

          </div>
        )}
      </div>
    </motion.div>
  );
}

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);
