import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { motion } from 'motion/react';
import { Lock, ShieldCheck, Key } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const validatePassword = (pass: string) => {
    const rx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return rx.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('A nova senha não atende aos requisitos de segurança.');
      return;
    }

    try {
      await api.post('/users/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setTimeout(() => {
        // reload to update auth context or simply navigate to root and reload
        window.location.href = '/';
      }, 1500);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao alterar a senha.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md glass-panel p-8"
      >
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
             <Key className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-center">Alteração Obrigatória de Senha</h1>
          <p className="mt-2 text-xs text-[var(--color-ink-secondary)] text-center">
             Por motivos de segurança, no primeiro acesso (ou após redefinição), você precisa cadastrar uma nova senha.
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs font-medium">
            {error}
          </div>
        )}
        
        {success ? (
           <div className="text-center p-6 space-y-4">
              <ShieldCheck className="w-12 h-12 text-[var(--color-status-success)] mx-auto" />
              <div className="text-[var(--color-status-success)] font-semibold">Senha alterada com sucesso!</div>
              <div className="text-xs text-[var(--color-ink-secondary)]">Redirecionando para o sistema...</div>
           </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-ink-secondary)] uppercase">Senha Atual / Provisória</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-secondary)]" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-[var(--color-ink-secondary)] uppercase">Nova Senha</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-secondary)]" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field pl-10"
                    required
                  />
                </div>
                <div className="mt-2 space-y-1">
                   <p className="text-[10px] text-[var(--color-ink-secondary)] font-medium uppercase tracking-wider mb-2">Requisitos de Segurança:</p>
                   <p className={`text-[10px] ${newPassword.length >= 8 ? 'text-[var(--color-status-success)]' : 'text-[var(--color-ink-secondary)]'}`}>• Mínimo de 8 caracteres</p>
                   <p className={`text-[10px] ${/[A-Z]/.test(newPassword) ? 'text-[var(--color-status-success)]' : 'text-[var(--color-ink-secondary)]'}`}>• Uma letra maiúscula</p>
                   <p className={`text-[10px] ${/[a-z]/.test(newPassword) ? 'text-[var(--color-status-success)]' : 'text-[var(--color-ink-secondary)]'}`}>• Uma letra minúscula</p>
                   <p className={`text-[10px] ${/\d/.test(newPassword) ? 'text-[var(--color-status-success)]' : 'text-[var(--color-ink-secondary)]'}`}>• Um número</p>
                   <p className={`text-[10px] ${/[@$!%*?&]/.test(newPassword) ? 'text-[var(--color-status-success)]' : 'text-[var(--color-ink-secondary)]'}`}>• Um caractere especial (@$!%*?&)</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--color-ink-secondary)] uppercase">Confirmar Nova Senha</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-secondary)]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5">
              Alterar Senha e Acessar Sistema
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
