import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, X, File as FileIcon, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function TicketCreate() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState('');
  const [bank, setBank] = useState('');
  const [importType, setImportType] = useState('');
  const [priority, setPriority] = useState('');
  const [observation, setObservation] = useState('');
  
  const [attachments, setAttachments] = useState<{name: string, type: string, size: number, data: string}[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{name: string, size: number, progress: number}[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [banks, setBanks] = useState<any[]>([]);
  const [importTypes, setImportTypes] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadParams = async () => {
      try {
        const res = await api.get('/params/all');
        setBanks(res.data.banks);
        setImportTypes(res.data.importTypes);
        setPriorities(res.data.priorities);
        
        // Setup initial default values dynamically
        if(res.data.banks.length > 0) setBank(res.data.banks[0].name);
        if(res.data.importTypes.length > 0) setImportType(res.data.importTypes[0].name);
        if(res.data.priorities.length > 0) {
           const normalPrior = res.data.priorities.find((p:any) => p.name === 'Normal') || res.data.priorities[0];
           setPriority(normalPrior.name);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadParams();
  }, []);

  const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'pdf', 'txt', 'png', 'jpg', 'jpeg'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    setUploadError('');
    
    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    
    for (const file of newFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setUploadError((prev) => prev ? prev + `\nO formato .${ext} não é permitido.` : `O formato .${ext} não é permitido.`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        setUploadError((prev) => prev ? prev + `\nO arquivo ${file.name} excede o limite de 10MB.` : `O arquivo ${file.name} excede o limite de 10MB.`);
        continue;
      }

      validFiles.push(file);
    }

    // Add to uploading queue
    const newUploading = validFiles.map(f => ({ name: f.name, size: f.size, progress: 0 }));
    setUploadingFiles(prev => [...prev, ...newUploading]);

    for (let i = 0; i < validFiles.length; i++) {
       const file = validFiles[i];
       
       // Simulate progress
       for (let p = 10; p <= 100; p += 20) {
          await new Promise(r => setTimeout(r, 100)); // wait 100ms
          setUploadingFiles(prev => {
             const copy = [...prev];
             const idx = copy.findIndex(uf => uf.name === file.name && uf.size === file.size && uf.progress < 100);
             if (idx !== -1) copy[idx].progress = p;
             return copy;
          });
       }

       // Convert to base64
       const reader = new FileReader();
       const base64Data = await new Promise<string>((resolve) => {
         reader.onload = (e) => resolve(e.target?.result as string);
         reader.readAsDataURL(file);
       });

       setAttachments(prev => [...prev, {
         name: file.name,
         type: file.type,
         size: file.size,
         data: base64Data
       }]);

       // Remove from uploading queue
       setUploadingFiles(prev => prev.filter(uf => uf.name !== file.name || uf.size !== file.size));
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/tickets', {
        proposals,
        bank,
        importType,
        priority,
        observation,
        attachments
      });
      navigate(`/chamados/${res.data.id}`);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b border-[var(--color-border)] pb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors border border-transparent hover:border-[var(--color-border)] shadow-sm bg-[var(--color-bg-card)]">
           <ArrowLeft className="w-5 h-5 text-[var(--color-ink-secondary)]" />
        </button>
        <div>
           <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink-primary)]">Nova Solicitação de Importação</h1>
           <p className="text-sm text-[var(--color-ink-secondary)] mt-1">Preencha os dados abaixo para iniciar um novo chamado operacional.</p>
        </div>
      </div>
      
      <div className="glass-panel p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
           <div>
              <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">
                 Número(s) da(s) Proposta(s) <span className="text-red-500">*</span>
              </label>
              <textarea 
                value={proposals}
                onChange={e => setProposals(e.target.value)}
                placeholder="Insira as propostas separadas por vírgula ou quebra de linha"
                className="input-field h-28 shadow-inner resize-y font-mono text-sm leading-relaxed"
                required
              />
              <p className="text-xs font-medium text-[var(--color-ink-secondary)] mt-2 italic">Ex: 1234567, 7654321</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[var(--color-bg-secondary)] p-6 rounded-2xl border border-[var(--color-border)]">
              <div>
                 <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">
                    Instituição Financeira (Banco) <span className="text-red-500">*</span>
                 </label>
                 <select value={bank} onChange={e => setBank(e.target.value)} className="input-field py-2.5 font-medium shadow-sm">
                    {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                 </select>
              </div>
              
              <div>
                 <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">
                    Tipo de Importação Demandada <span className="text-red-500">*</span>
                 </label>
                 <select value={importType} onChange={e => setImportType(e.target.value)} className="input-field py-2.5 font-medium shadow-sm">
                    {importTypes.map(it => <option key={it.id} value={it.name}>{it.name}</option>)}
                 </select>
              </div>
           </div>

           <div>
              <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">
                 Prioridade de Atendimento <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-4">
                 {priorities.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 cursor-pointer border ${priority === p.name ? 'border-[var(--color-brand-wine)] bg-[var(--color-brand-wine)]/5' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'} px-4 py-3 rounded-xl transition-all shadow-sm hover:shadow-md block flex-1 sm:flex-none justify-center`}>
                       <input 
                         type="radio" 
                         name="priority" 
                         value={p.name} 
                         checked={priority === p.name}
                         onChange={e => setPriority(e.target.value)}
                         className="text-[var(--color-brand-wine)] focus:ring-[var(--color-brand-wine)] bg-[var(--color-bg-card)] border-[var(--color-border)] w-4 h-4"
                       />
                       <span className={`text-sm ${priority === p.name ? 'font-bold text-[var(--color-brand-wine)]' : 'font-medium text-[var(--color-ink-primary)]'}`}>{p.name}</span>
                    </label>
                 ))}
              </div>
           </div>

           <div>
              <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-3">
                 Observação Operacional <span className="text-[var(--color-ink-secondary)]/50 font-normal ml-1">(Opcional)</span>
              </label>
              <textarea 
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Detalhes adicionais, orientações específicas ou histórico breve..."
                className="input-field h-28 shadow-inner"
              />
           </div>

           <div className="pt-6 border-t border-[var(--color-border)]">
              <label className="block text-[11px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest mb-4">
                 Documentação em Anexo <span className="text-[var(--color-ink-secondary)]/50 font-normal ml-1">(Opcional)</span>
              </label>
              <div 
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${isDragging ? 'border-[var(--color-brand-wine)] bg-[var(--color-brand-wine)]/5 scale-[1.01]' : 'border-[var(--color-border)] hover:border-[var(--color-brand-wine)]/40 hover:bg-[var(--color-bg-secondary)]'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-[var(--color-brand-wine)]/20' : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]'}`}>
                   <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-[var(--color-brand-wine)]' : 'text-[var(--color-ink-secondary)]'}`} />
                </div>
                <p className="font-bold text-base text-[var(--color-ink-primary)] mb-2">Arraste arquivos aqui ou clique para selecionar</p>
                <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                  Formatos aceitos: CSV, XLSX, XLS, PDF, TXT, PNG, JPG, JPEG (Máx 10MB por arquivo)
                </p>
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls,.pdf,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e.target.files)} 
                />
              </div>
              
              {uploadError && (
                 <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-xs mt-3 bg-red-500/10 p-2.5 rounded border border-red-500/20 font-bold inline-block whitespace-pre-wrap">
                    {uploadError}
                 </motion.div>
              )}

              {uploadingFiles.length > 0 && (
                 <div className="mt-6 space-y-3">
                   <h4 className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest pl-1">Carregando Arquivos</h4>
                   <AnimatePresence>
                     {uploadingFiles.map((file, idx) => (
                       <motion.div 
                         initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                         animate={{ opacity: 1, y: 0, scale: 1 }} 
                         exit={{ opacity: 0, scale: 0.95 }}
                         key={`upload-${idx}`}
                         className="flex flex-col p-3.5 bg-[var(--color-bg-card)] border border-[var(--color-brand-wine)]/40 rounded-xl shadow-sm"
                       >
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)] font-bold text-[10px] uppercase flex items-center justify-center border border-[var(--color-brand-wine)]/20 shrink-0">
                                  {file.name.split('.').pop()?.substring(0,3)}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-[var(--color-ink-primary)] truncate max-w-[200px] sm:max-w-md">{file.name}</p>
                                 <p className="text-[11px] text-[var(--color-ink-secondary)] font-mono font-medium">{formatSize(file.size)}</p>
                               </div>
                             </div>
                             <span className="text-xs font-bold text-[var(--color-brand-wine)]">{file.progress}%</span>
                          </div>
                          <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-1.5 overflow-hidden">
                             <motion.div 
                                className="bg-[var(--color-brand-wine)] h-1.5 rounded-full" 
                                initial={{ width: 0 }}
                                animate={{ width: `${file.progress}%` }}
                                transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                             />
                          </div>
                       </motion.div>
                     ))}
                   </AnimatePresence>
                 </div>
              )}
              
              {attachments.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest pl-1">Arquivos Prontos para Envio ({attachments.length})</h4>
                  <AnimatePresence>
                    {attachments.map((att, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={idx} 
                        className="flex items-center justify-between p-3.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-sm hover:shadow-md transition-shadow group"
                      >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)] font-bold text-[10px] uppercase flex items-center justify-center border border-[var(--color-brand-wine)]/20 shrink-0">
                               {att.name.split('.').pop()?.substring(0,3)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--color-ink-primary)] truncate max-w-[200px] sm:max-w-md">{att.name}</p>
                              <p className="text-[11px] text-[var(--color-ink-secondary)] font-mono font-medium">{formatSize(att.size)}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeAttachment(idx)} className="p-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-red-500/10 hover:border-red-500/30 rounded-lg text-[var(--color-ink-secondary)] hover:text-red-500 transition-all shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
           </div>

           <div className="pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary py-3 px-6 shadow-sm order-2 sm:order-1 w-full sm:w-auto" disabled={isSubmitting}>Cancelar Criação</button>
              <button type="submit" className="btn-primary py-3 px-8 shadow-md order-1 sm:order-2 w-full sm:w-auto text-sm" disabled={isSubmitting}>
                 {isSubmitting ? (
                    <span className="flex items-center justify-center">
                       <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2"></div>
                       Processando...
                    </span>
                 ) : (
                    <span className="flex items-center justify-center">
                       <CheckCircle2 className="w-4 h-4 mr-2" /> Abrir Chamado Agora
                    </span>
                 )}
              </button>
           </div>
        </form>
      </div>
    </motion.div>
  );
}
