import React, { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, CircleDashed, AlertCircle, FileText, Calendar, ChevronDown } from 'lucide-react';
import { startOfDay, endOfDay, subDays, startOfMonth, format } from 'date-fns';

type DatePreset = 'today' | '7days' | '30days' | 'thisMonth' | 'custom';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();

  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const dateRange = useMemo(() => {
    const today = new Date();
    switch (datePreset) {
      case 'today':
        return { start: startOfDay(today).toISOString(), end: endOfDay(today).toISOString() };
      case '7days':
        return { start: startOfDay(subDays(today, 7)).toISOString(), end: endOfDay(today).toISOString() };
      case '30days':
        return { start: startOfDay(subDays(today, 30)).toISOString(), end: endOfDay(today).toISOString() };
      case 'thisMonth':
        return { start: startOfMonth(today).toISOString(), end: endOfDay(today).toISOString() };
      case 'custom':
        return { 
           start: customStart ? startOfDay(new Date(customStart)).toISOString() : undefined,
           end: customEnd ? endOfDay(new Date(customEnd)).toISOString() : undefined
        };
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    if (datePreset === 'custom' && (!customStart || !customEnd)) return; // Wait for both dates if custom
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (dateRange?.start) params.append('startDate', dateRange.start);
      if (dateRange?.end) params.append('endDate', dateRange.end);
      
      const res = await api.get(`/dashboard?${params.toString()}`);
      setStats(res.data);
    } catch (err) {
      console.error("error fetching stats", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderFilterButton = () => {
     const labels: Record<DatePreset, string> = {
        today: 'Hoje',
        '7days': 'Últimos 7 dias',
        '30days': 'Últimos 30 dias',
        thisMonth: 'Este mês',
        custom: 'Personalizado'
     };
     return labels[datePreset];
  };

  const bankData = useMemo(() => {
    if (!stats || !stats.byBank) return [];
    return Object.keys(stats.byBank).map(key => ({
      name: key,
      value: stats.byBank[key]
    }));
  }, [stats]);

  const priorityData = useMemo(() => {
    if (!stats || !stats.byPriority) return [];
    return Object.keys(stats.byPriority).map(key => ({
      name: key,
      value: stats.byPriority[key]
    }));
  }, [stats]);

  const COLORS = ['#64748b', '#f59e0b', '#ef4444'];
  
  const tooltipStyle = {
    backgroundColor: 'var(--color-bg-card)', 
    border: '1px solid var(--color-border)', 
    borderRadius: '12px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--color-ink-primary)',
    padding: '8px 12px'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink-primary)] mb-1">Visão Geral</h1>
          <p className="text-[var(--color-ink-secondary)] text-sm">Resumo operacional das propostas no período</p>
        </div>
        
        <div className="relative">
           <button 
             onClick={() => setShowFilterDropdown(!showFilterDropdown)}
             className="bg-[var(--color-bg-card)] border border-[var(--color-border)] px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-ink-primary)] flex items-center justify-between min-w-[200px] shadow-sm hover:shadow-md transition-all"
           >
              <div className="flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-[var(--color-ink-secondary)]" />
                 {renderFilterButton()}
              </div>
              <ChevronDown className="w-4 h-4 text-[var(--color-ink-secondary)] ml-2" />
           </button>
           
           <AnimatePresence>
              {showFilterDropdown && (
                 <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 p-2"
                 >
                    <div className="flex flex-col space-y-1">
                       <button onClick={() => { setDatePreset('today'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'today' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Hoje</button>
                       <button onClick={() => { setDatePreset('7days'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === '7days' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Últimos 7 dias</button>
                       <button onClick={() => { setDatePreset('30days'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === '30days' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Últimos 30 dias</button>
                       <button onClick={() => { setDatePreset('thisMonth'); setShowFilterDropdown(false); }} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'thisMonth' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Este mês</button>
                       <button onClick={() => setDatePreset('custom')} className={`text-left px-3 py-2 rounded-lg text-sm font-medium ${datePreset === 'custom' ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)]' : 'hover:bg-[var(--color-bg-secondary)]'}`}>Período Personalizado</button>
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
           <div className="animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-[var(--color-brand-wine)]/30 border-t-[var(--color-brand-wine)] animate-spin mb-4"></div>
              <p className="text-[var(--color-ink-secondary)] font-medium">Carregando indicadores corporativos...</p>
           </div>
        </div>
      ) : error || !stats ? (
         <div className="flex-1 flex items-center justify-center py-20">
           <div className="flex flex-col items-center p-14 text-center rounded-2xl bg-white border border-gray-100 shadow-sm gap-4">
              <AlertCircle className="w-12 h-12 text-red-500/80" />
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-gray-900">Falha ao carregar dashboard</h3>
                <p className="text-gray-500 max-w-sm">Houve um problema de conectividade ao montar as estatísticas.</p>
              </div>
              <button onClick={fetchStats} className="btn-secondary py-2 px-4 shadow-sm text-sm mt-2 border border-gray-300">
                 Tentar novamente
              </button>
           </div>
         </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 flex flex-col justify-between">
           <div className="flex items-center justify-between mb-4">
              <p className="text-[var(--color-ink-secondary)] text-xs uppercase font-bold tracking-widest">Abertos</p>
              <FileText className="w-5 h-5 text-[var(--color-brand-wine)]/60" />
           </div>
           <div className="mt-auto">
              <span className="text-5xl font-light tracking-tighter text-[var(--color-ink-primary)]">{stats.abertos}</span>
              <p className="text-[var(--color-brand-wine)] mt-1 text-xs font-semibold">Total em Fila</p>
           </div>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/50 group-hover:bg-amber-500 transition-colors"></div>
           <div className="flex items-center justify-between mb-4">
              <p className="text-[var(--color-ink-secondary)] text-xs uppercase font-bold tracking-widest">Em Andamento</p>
              <CircleDashed className="w-5 h-5 text-amber-500/60" />
           </div>
           <div className="mt-auto">
              <span className="text-5xl font-light tracking-tighter text-[var(--color-ink-primary)]">{stats.emAndamento}</span>
              <p className="text-amber-600 dark:text-amber-500 mt-1 text-xs font-semibold">Em Tratativa</p>
           </div>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500/50 group-hover:bg-red-500 transition-colors"></div>
           <div className="flex items-center justify-between mb-4">
              <p className="text-[var(--color-ink-secondary)] text-xs uppercase font-bold tracking-widest">Atrasados</p>
              <AlertCircle className="w-5 h-5 text-red-500/60" />
           </div>
           <div className="mt-auto">
              <span className="text-5xl font-light tracking-tighter text-red-500">{stats.atrasados}</span>
              <p className="text-red-500 mt-1 text-xs font-semibold">Alerta SLA</p>
           </div>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/50 group-hover:bg-emerald-500 transition-colors"></div>
           <div className="flex items-center justify-between mb-4">
              <p className="text-[var(--color-ink-secondary)] text-xs uppercase font-bold tracking-widest">Finalizados</p>
              <CheckCircle2 className="w-5 h-5 text-emerald-500/60" />
           </div>
           <div className="mt-auto">
              <span className="text-5xl font-light tracking-tighter text-[var(--color-ink-primary)]">{stats.finalizados}</span>
              <p className="text-emerald-600 dark:text-emerald-500 mt-1 text-xs font-semibold">Concluídos</p>
           </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
         <div className="glass-panel p-6 lg:col-span-5 flex flex-col h-96">
            <h2 className="text-sm font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-6">Volume por Banco</h2>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={bankData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                   <XAxis dataKey="name" stroke="var(--color-ink-secondary)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                   <YAxis stroke="var(--color-ink-secondary)" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                   <RechartsTooltip cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={tooltipStyle} itemStyle={{ color: 'var(--color-ink-primary)', fontWeight: 500 }} />
                   <Bar dataKey="value" fill="var(--color-brand-wine)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                 </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
         
         <div className="glass-panel p-6 lg:col-span-3 flex flex-col h-96">
            <h2 className="text-sm font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-6">Prioridades</h2>
            <div className="flex-1 w-full min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={priorityData}
                     cx="50%"
                     cy="50%"
                     innerRadius={70}
                     outerRadius={100}
                     paddingAngle={3}
                     dataKey="value"
                     stroke="none"
                   >
                     {priorityData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--color-ink-primary)', fontWeight: 500 }} />
                 </PieChart>
              </ResponsiveContainer>
              {/* Central text in the donut chart */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-[var(--color-ink-secondary)] font-medium uppercase tracking-widest">Total</span>
                <span className="text-2xl font-bold text-[var(--color-ink-primary)]">
                   {priorityData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
              </div>
            </div>
         </div>
      </div>
      </>
      )}
    </motion.div>
  );
}
