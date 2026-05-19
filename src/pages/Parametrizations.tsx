import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { Settings, Plus, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function Parametrizations() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'banks' | 'imports' | 'priorities' | 'statuses'>('banks');

  // We could create generic CRUD, but let's do it per tab for customization if needed
  
  if (user?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-400">Acesso Negado</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1400px] mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)] flex items-center gap-3">
             <Settings className="text-[var(--color-brand-wine)] w-6 h-6" /> Parametrizações Cadastrais
           </h1>
           <p className="text-sm text-[var(--color-ink-secondary)] mt-1">Configurações globais e automações do ImportFlow C2</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4 border-b border-[var(--color-border)] mb-2">
        {[ 
          { id: 'banks', label: 'Bancos / Pagadores' },
          { id: 'imports', label: 'Tipos de Importação' },
          { id: 'priorities', label: 'Prioridades / SLA' },
          { id: 'statuses', label: 'Config. Status' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-[var(--color-brand-wine)] text-[var(--color-brand-wine)] bg-[var(--color-brand-wine)]/5' 
                : 'border-transparent text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-[var(--color-bg-secondary)]'
            } rounded-t-lg`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'banks' && <BanksTab />}
        {activeTab === 'imports' && <ImportTypesTab />}
        {activeTab === 'priorities' && <PrioritiesTab />}
        {activeTab === 'statuses' && <StatusesTab />}
      </div>

    </motion.div>
  );
}

// --- SUB TABS COMPONENTS ---

function BanksTab() {
  const [data, setData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [observation, setObservation] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const res = await api.get('/admin/banks');
    setData(res.data);
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setCode(item.code);
      setObservation(item.observation);
      setActive(item.active);
    } else {
      setEditingItem(null);
      setName('');
      setCode('');
      setObservation('');
      setActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, code, observation, active };
    if (editingItem) {
      await api.put(`/admin/banks/${editingItem.id}`, payload);
    } else {
      await api.post('/admin/banks', payload);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir este banco?')) {
      await api.delete(`/admin/banks/${id}`);
      loadData();
    }
  };

  return (
    <div className="glass-panel flex-1 flex flex-col h-full shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-secondary)] rounded-t-2xl">
        <h2 className="font-bold text-sm tracking-wide text-[var(--color-ink-primary)]">Gestão de Bancos e Pagadores</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary py-2 px-4 shadow-sm text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Banco</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="data-table">
          <thead className="sticky top-0 bg-[var(--color-bg-secondary)] shadow-sm">
            <tr>
              <th>Banco / Pagador</th>
              <th>Código</th>
              <th>Status Operacional</th>
              <th>Criado em</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
               <tr key={item.id} className={`${!item.active ? 'opacity-60 bg-[var(--color-bg-secondary)]/30' : 'hover:bg-[var(--color-bg-secondary)]/50'} transition-colors group`}>
                <td className="font-bold text-[13px] text-[var(--color-ink-primary)]">{item.name}</td>
                <td className="font-mono text-xs font-bold text-[var(--color-ink-secondary)]">{item.code || '-'}</td>
                <td>
                  {item.active ? <span className="badge badge-success shadow-sm">Ativo</span> : <span className="badge badge-critical shadow-sm">Inativo</span>}
                </td>
                <td className="text-xs font-medium text-[var(--color-ink-secondary)]">{format(new Date(item.createdAt), 'dd/MM/yyyy')}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenModal(item)} className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand-wine)]/30 transition-all rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(item.id)} className="p-2 text-[var(--color-ink-secondary)] hover:text-red-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-red-500/30 transition-all rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <CrudModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Banco Institucional' : 'Novo Banco Institucional'} onSubmit={handleSubmit}>
         <div>
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Nome Institucional Banco</label>
           <input type="text" value={name} onChange={e=>setName(e.target.value)} className="input-field shadow-sm py-2.5" required />
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Código/Apelido Interno</label>
             <input type="text" value={code} onChange={e=>setCode(e.target.value)} className="input-field shadow-sm py-2.5 font-mono text-sm" />
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Disponibilidade</label>
             <select value={active ? 'true' : 'false'} onChange={e=>setActive(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
                <option value="true">Disponível no Cadastro</option>
                <option value="false">Oculto / Inativo</option>
             </select>
           </div>
         </div>
         <div className="mt-5">
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Observação (Opcional)</label>
           <input type="text" value={observation} onChange={e=>setObservation(e.target.value)} className="input-field shadow-sm py-2.5" />
         </div>
      </CrudModal>
    </div>
  );
}

function ImportTypesTab() {
  const [data, setData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#671E32');
  const [active, setActive] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const res = await api.get('/admin/import-types');
    setData(res.data);
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setDescription(item.description);
      setColor(item.color);
      setActive(item.active);
    } else {
      setEditingItem(null);
      setName('');
      setDescription('');
      setColor('#671E32'); // Brand Wine default
      setActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, description, color, active };
    if (editingItem) {
      await api.put(`/admin/import-types/${editingItem.id}`, payload);
    } else {
      await api.post('/admin/import-types', payload);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir este tipo?')) {
      await api.delete(`/admin/import-types/${id}`);
      loadData();
    }
  };

  return (
    <div className="glass-panel flex-1 flex flex-col h-full shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-secondary)] rounded-t-2xl">
        <h2 className="font-bold text-sm tracking-wide text-[var(--color-ink-primary)]">Tipos Operacionais de Importação</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary py-2 px-4 shadow-sm text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Tipo</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="data-table">
          <thead className="sticky top-0 bg-[var(--color-bg-secondary)] shadow-sm">
            <tr>
              <th className="w-12 text-center">Cor</th>
              <th>Nome da Operação</th>
              <th>Descrição Auxiliar</th>
              <th>Status Operacional</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className={`${!item.active ? 'opacity-60 bg-[var(--color-bg-secondary)]/30' : 'hover:bg-[var(--color-bg-secondary)]/50'} transition-colors group`}>
                <td className="text-center">
                  <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10 inline-block" style={{ backgroundColor: item.color }}></div>
                </td>
                <td className="font-bold text-[13px] text-[var(--color-ink-primary)]">{item.name}</td>
                <td className="text-xs font-medium text-[var(--color-ink-secondary)] max-w-sm truncate">{item.description}</td>
                <td>{item.active ? <span className="badge badge-success shadow-sm">Ativo</span> : <span className="badge badge-critical shadow-sm">Inativo</span>}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenModal(item)} className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand-wine)]/30 transition-all rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(item.id)} className="p-2 text-[var(--color-ink-secondary)] hover:text-red-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-red-500/30 transition-all rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <CrudModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Modalidade de Importação' : 'Nova Modalidade de Importação'} onSubmit={handleSubmit}>
         <div>
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Nome da Rotina</label>
           <input type="text" value={name} onChange={e=>setName(e.target.value)} className="input-field shadow-sm py-2.5" required />
         </div>
         <div className="mt-5">
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Descrição (Visível nos relatórios)</label>
           <input type="text" value={description} onChange={e=>setDescription(e.target.value)} className="input-field shadow-sm py-2.5" />
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Cor Identificação Visual</label>
             <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-11 w-full block mt-1 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] cursor-pointer shadow-sm p-1" />
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Disponibilidade</label>
             <select value={active ? 'true' : 'false'} onChange={e=>setActive(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
                <option value="true">Disponível</option>
                <option value="false">Oculto / Inativo</option>
             </select>
           </div>
         </div>
      </CrudModal>
    </div>
  );
}

function PrioritiesTab() {
  const [data, setData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [sla, setSla] = useState(0);
  const [slaUnit, setSlaUnit] = useState('horas');
  const [color, setColor] = useState('#64748b');
  const [active, setActive] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const res = await api.get('/admin/priorities');
    setData(res.data);
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setSla(item.sla);
      setSlaUnit(item.slaUnit);
      setColor(item.color);
      setActive(item.active);
    } else {
      setEditingItem(null);
      setName('');
      setSla(4);
      setSlaUnit('horas');
      setColor('#64748b');
      setActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, sla, slaUnit, color, active };
    if (editingItem) {
      await api.put(`/admin/priorities/${editingItem.id}`, payload);
    } else {
      await api.post('/admin/priorities', payload);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir esta prioridade?')) {
      await api.delete(`/admin/priorities/${id}`);
      loadData();
    }
  };

  return (
    <div className="glass-panel flex-1 flex flex-col h-full shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-secondary)] rounded-t-2xl">
        <h2 className="font-bold text-sm tracking-wide text-[var(--color-ink-primary)]">Prioridades e Matriz de SLA</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary py-2 px-4 shadow-sm text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Prioridade</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="data-table">
          <thead className="sticky top-0 bg-[var(--color-bg-secondary)] shadow-sm">
            <tr>
              <th className="w-12 text-center">Cor</th>
              <th>Nome da Prioridade</th>
              <th>Termo SLA Estimado</th>
              <th>Status Operacional</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className={`${!item.active ? 'opacity-60 bg-[var(--color-bg-secondary)]/30' : 'hover:bg-[var(--color-bg-secondary)]/50'} transition-colors group`}>
                <td className="text-center">
                  <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10 inline-block" style={{ backgroundColor: item.color }}></div>
                </td>
                <td className="font-bold text-[13px] text-[var(--color-ink-primary)]">{item.name}</td>
                <td className="font-mono text-xs font-bold text-[var(--color-ink-secondary)]">{item.sla === 0 ? 'Resolução Imediata' : `${item.sla} ${item.slaUnit}`}</td>
                <td>{item.active ? <span className="badge badge-success shadow-sm">Ativo</span> : <span className="badge badge-critical shadow-sm">Inativo</span>}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenModal(item)} className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand-wine)]/30 transition-all rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(item.id)} className="p-2 text-[var(--color-ink-secondary)] hover:text-red-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-red-500/30 transition-all rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <CrudModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Matriz Prioridade (SLA)' : 'Nova Matriz Prioridade (SLA)'} onSubmit={handleSubmit}>
         <div>
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Nome Nível Prioridade</label>
           <input type="text" value={name} onChange={e=>setName(e.target.value)} className="input-field shadow-sm py-2.5" required />
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Tempo SLA <span className="normal-case font-normal">(0 = imediato)</span></label>
             <input type="number" min="0" value={sla} onChange={e=>setSla(Number(e.target.value))} className="input-field shadow-sm py-2.5 font-mono text-sm" required />
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Unidade de Tempo Global</label>
             <select value={slaUnit} onChange={e=>setSlaUnit(e.target.value)} className="input-field shadow-sm py-2.5 font-bold" required>
                <option value="minutos">Escala Minutos</option>
                <option value="horas">Escala Horas</option>
                <option value="dias">Escala Dias Úteis</option>
                <option value="imediato">SLA Imediato</option>
             </select>
           </div>
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Esquema de Cor (Badge)</label>
             <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-11 w-full block mt-1 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] cursor-pointer shadow-sm p-1" />
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Disponibilidade</label>
             <select value={active ? 'true' : 'false'} onChange={e=>setActive(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
                <option value="true">Disponível</option>
                <option value="false">Oculto / Inativo</option>
             </select>
           </div>
         </div>
      </CrudModal>
    </div>
  );
}

function StatusesTab() {
  const [data, setData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [order, setOrder] = useState(1);
  const [color, setColor] = useState('#3b82f6');
  const [isFinal, setIsFinal] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const res = await api.get('/admin/statuses');
    setData(res.data);
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setOrder(item.order);
      setColor(item.color);
      setIsFinal(item.isFinal);
      setIsEditable(item.isEditable);
      setActive(item.active);
    } else {
      setEditingItem(null);
      setName('');
      setOrder(1);
      setColor('#671E32');
      setIsFinal(false);
      setIsEditable(true);
      setActive(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, order, color, isFinal, isEditable, active };
    if (editingItem) {
      await api.put(`/admin/statuses/${editingItem.id}`, payload);
    } else {
      await api.post('/admin/statuses', payload);
    }
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir este status?')) {
      await api.delete(`/admin/statuses/${id}`);
      loadData();
    }
  };

  return (
    <div className="glass-panel flex-1 flex flex-col h-full shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg-secondary)] rounded-t-2xl">
        <h2 className="font-bold text-sm tracking-wide text-[var(--color-ink-primary)]">Configuração de Status do Workflow</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary py-2 px-4 shadow-sm text-xs"><Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Status</button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="data-table">
          <thead className="sticky top-0 bg-[var(--color-bg-secondary)] shadow-sm">
            <tr>
              <th className="w-16 text-center">Ordem</th>
              <th className="w-12 text-center">Cor</th>
              <th>Nome da Etapa</th>
              <th className="text-center">Finalizador?</th>
              <th className="text-center">Permite Edição?</th>
              <th>Status Operacional</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className={`${!item.active ? 'opacity-60 bg-[var(--color-bg-secondary)]/30' : 'hover:bg-[var(--color-bg-secondary)]/50'} transition-colors group`}>
                <td className="font-mono text-[13px] font-bold text-center text-[var(--color-brand-wine)]">{item.order}</td>
                <td className="text-center">
                  <div className="w-6 h-6 rounded-lg shadow-sm border border-black/10 inline-block" style={{ backgroundColor: item.color }}></div>
                </td>
                <td className="font-bold text-[13px] text-[var(--color-ink-primary)]">{item.name}</td>
                <td className="text-center">
                  {item.isFinal ? 
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] px-2 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest"><CheckCircle2 className="w-3.5 h-3.5" /> Sim</span> 
                  : <span className="inline-flex items-center gap-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-ink-secondary)] font-bold text-[10px] px-2 py-1 rounded-md border border-[var(--color-border)] uppercase tracking-widest"><XCircle className="w-3.5 h-3.5" /> Não</span>}
                </td>
                <td className="text-center">
                  {item.isEditable ? 
                    <span className="inline-flex items-center gap-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-ink-primary)] font-bold text-[10px] px-2 py-1 rounded-md border border-[var(--color-border)] uppercase tracking-widest"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-brand-wine)]" /> Sim</span> 
                  : <span className="inline-flex items-center gap-1.5 bg-[var(--color-bg-secondary)] text-[var(--color-ink-secondary)] font-bold text-[10px] px-2 py-1 rounded-md border border-[var(--color-border)] uppercase tracking-widest"><XCircle className="w-3.5 h-3.5" /> Bloqueado</span>}
                </td>
                <td>{item.active ? <span className="badge badge-success shadow-sm">Ativo</span> : <span className="badge badge-critical shadow-sm">Inativo</span>}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenModal(item)} className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-brand-wine)]/30 transition-all rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button>
                     <button onClick={() => handleDelete(item.id)} className="p-2 text-[var(--color-ink-secondary)] hover:text-red-500 bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-red-500/30 transition-all rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <CrudModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Editar Etapa de Status' : 'Nova Etapa de Status'} onSubmit={handleSubmit}>
         <div>
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Nome Descritivo da Etapa</label>
           <input type="text" value={name} onChange={e=>setName(e.target.value)} className="input-field shadow-sm py-2.5" required />
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Ordem Sequencial no Fluxo</label>
             <input type="number" min="1" value={order} onChange={e=>setOrder(Number(e.target.value))} className="input-field shadow-sm py-2.5 font-mono text-center text-sm font-bold" required />
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Cor de Marcação Visual</label>
             <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-11 w-full block mt-1 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] cursor-pointer shadow-sm p-1" />
           </div>
         </div>
         <div className="grid grid-cols-2 gap-5 mt-5">
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Regra: Status Finalizador?</label>
             <select value={isFinal ? 'true' : 'false'} onChange={e=>setIsFinal(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
                <option value="true">Sim (Encerra Chamado)</option>
                <option value="false">Não (Em Aberto)</option>
             </select>
           </div>
           <div>
             <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Regra: Permite Edição de Anexos?</label>
             <select value={isEditable ? 'true' : 'false'} onChange={e=>setIsEditable(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
                <option value="true">Sim, Mutável</option>
                <option value="false">Não, Apenas Leitura</option>
             </select>
           </div>
         </div>
         <div className="mt-5">
           <label className="text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-1.5 block">Disponibilidade Operacional</label>
           <select value={active ? 'true' : 'false'} onChange={e=>setActive(e.target.value === 'true')} className="input-field shadow-sm py-2.5 font-bold">
              <option value="true">Ativo na Régua</option>
              <option value="false">Inativo / Arquivado</option>
           </select>
         </div>
      </CrudModal>
    </div>
  );
}


// --- GENERIC MODAL WRAPPER ---
function CrudModal({ isOpen, onClose, title, children, onSubmit }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, onSubmit: (e: React.FormEvent) => void }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl p-8">
           <h2 className="text-xl font-bold tracking-tight mb-8 text-[var(--color-ink-primary)] border-b border-[var(--color-border)] pb-4 flex items-center gap-3">
              <Settings className="w-5 h-5 text-[var(--color-brand-wine)]" /> {title}
           </h2>
           <form onSubmit={onSubmit}>
              {children}
              <div className="flex justify-end gap-3 pt-6 mt-8 border-t border-[var(--color-border)]">
                 <button type="button" onClick={onClose} className="btn-secondary py-2.5 px-6 shadow-sm">Cancelar Edição</button>
                 <button type="submit" className="btn-primary py-2.5 px-6 shadow-md">Salvar Regras da Entidade</button>
              </div>
           </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
