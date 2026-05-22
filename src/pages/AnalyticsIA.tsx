import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { BrainCircuit, Loader2, AlertTriangle, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';

export default function AnalyticsIA() {
  const { user } = useAuth();
  const [data, setData] = useState<{ summary: string, insights: string[], bottlenecks: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (user?.role !== 'ADMIN' && user?.role !== 'GESTAO') {
    return <div className="p-8 text-center text-red-500">Acesso Negado</div>;
  }

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get('/analytics/insights');
      setData(res.data);
    } catch (e: any) {
      console.error("[ANALYTICS] Falha:", e?.message || e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)] flex items-center gap-3">
             <BrainCircuit className="text-[var(--color-brand-wine)] w-7 h-7" /> Gestão Inteligente
           </h1>
           <p className="text-sm text-[var(--color-ink-secondary)] mt-1">
             Geração automática de inteligência analítica. Estes insights são formados baseados nos chamados e volumetrias do sistema.
           </p>
        </div>
        <button onClick={loadInsights} disabled={loading} className="btn-secondary py-2 px-4 shadow-sm text-sm disabled:opacity-50">
           {loading ? 'Consultando IA...' : 'Atualizar Dados'}
        </button>
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
