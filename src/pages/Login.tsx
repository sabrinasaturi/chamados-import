import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import api from '../lib/api';
import { motion } from 'motion/react';
import { Lock, Mail } from 'lucide-react';
import C2Logo from '../components/C2Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/login', { email, password });
      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/');
    } catch (err: any) {
      console.error("Login catch error:", err);
      if (err.response && err.response.data && err.response.data.error) {
         setError(err.response.data.error);
      } else {
         setError(err.message || 'Erro ao conectar com o servidor.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-4 relative overflow-hidden">
      {/* Background Decorative Pattern */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
         <svg className="absolute top-0 left-1/4 h-[800px] w-[800px] -translate-y-1/4 -translate-x-1/2 transform rounded-full" viewBox="0 0 100 100" preserveAspectRatio="none">
           <circle cx="50" cy="50" r="50" fill="var(--color-brand-wine)" />
         </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-xl border border-[var(--color-border)] p-8 sm:p-10 transition-colors">
          <div className="flex flex-col items-center justify-center mb-10">
            <C2Logo className="h-20 mb-2" />
            <p className="mt-4 text-sm font-medium text-[var(--color-ink-secondary)] text-center">
               Acesso Restrito • ImportFlow C2
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm font-medium relative">
                {error}
              </motion.div>
            )}
            
            <div className="space-y-2">
               <label className="text-xs font-bold text-[var(--color-ink-secondary)] tracking-widest uppercase">Email Corporativo</label>
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                     <Mail className="h-5 w-5 text-[var(--color-ink-secondary)]" />
                  </div>
                  <input 
                    type="text" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field pl-11 py-2.5 text-right" 
                    placeholder="E-mail ou Login Corporativo"
                    required 
                  />
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-xs font-bold text-[var(--color-ink-secondary)] tracking-widest uppercase">Senha de Acesso</label>
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                     <Lock className="h-5 w-5 text-[var(--color-ink-secondary)]" />
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pl-11 py-2.5 text-right" 
                    placeholder="Senha de Acesso"
                    required 
                  />
               </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3.5 mt-6 text-sm font-bold shadow-md hover:shadow-lg transition-all" disabled={isLoading}>
              {isLoading ? 'Autenticando...' : 'Acessar Sistema'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
