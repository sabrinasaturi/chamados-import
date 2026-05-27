import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { Activity, LayoutDashboard, ListTodo, PlusCircle, LogOut, Search, Bell, Users, Settings, Moon, Sun, ChevronLeft, ChevronRight, Menu, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import C2Logo from './C2Logo';

function SidebarMenuItem({ 
  item, 
  isActive, 
  isSidebarOpen 
}: { 
  item: any; 
  isActive: boolean; 
  isSidebarOpen: boolean; 
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      title={!isSidebarOpen ? item.name : undefined}
      className={`flex items-center ${isSidebarOpen ? 'px-3' : 'justify-center'} py-2.5 rounded-lg text-sm font-medium transition-all ${
        isActive 
          ? 'bg-[var(--color-brand-wine)]/10 text-[var(--color-brand-wine)] shadow-[inset_3px_0_0_0_var(--color-brand-wine)]' 
          : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-ink-primary)]'
      }`}
    >
      <Icon className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
      {isSidebarOpen && <span>{item.name}</span>}
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'GESTAO', 'SOLICITANTE'] },
    { name: 'Análise Inteligente', path: '/ia', icon: BrainCircuit, roles: ['ADMIN', 'GESTAO'] },
    { name: 'Fila Operacional', path: '/chamados', icon: ListTodo, roles: ['ADMIN', 'IMPORTACAO', 'GESTAO', 'SOLICITANTE'] },
    { name: 'Criar Chamado', path: '/chamados/novo', icon: PlusCircle, roles: ['ADMIN', 'SOLICITANTE'] },
    { name: 'Usuários', path: '/usuarios', icon: Users, roles: ['ADMIN'] },
    { name: 'Parametrizações', path: '/parametros', icon: Settings, roles: ['ADMIN'] },
  ];

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="relative z-20 flex flex-col bg-[var(--color-bg-card)] border-r border-[var(--color-border)] transition-colors"
      >
        <div 
          className="flex items-center justify-between px-6 border-b border-[var(--color-border)]"
        >
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col justify-center overflow-hidden">
                <C2Logo className="object-contain" />
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center w-full">
                 <span className="font-black text-2xl tracking-tighter text-[var(--color-ink-primary)]">
                   C<span className="text-[var(--color-brand-wine)] text-sm align-middle relative -top-[2px]">●</span>2
                 </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden">
          {isSidebarOpen && (
            <div 
              className="mb-3 text-[10px] font-bold text-[var(--color-ink-secondary)] uppercase tracking-widest px-2"
            >
              Menu Principal
            </div>
          )}
          <nav className="space-y-1.5">
            {navItems.filter(item => item.roles.includes(user?.role || '')).map((item, index) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <SidebarMenuItem 
                  key={item.path} 
                  item={item} 
                  isActive={isActive} 
                  isSidebarOpen={isSidebarOpen} 
                />
              );
            })}
          </nav>
        </div>
        
        <div className={`p-4 border-t border-[var(--color-border)] flex ${isSidebarOpen ? 'flex-col gap-4' : 'flex-col items-center gap-4'}`}>
          <div className="flex items-center" title={!isSidebarOpen ? user?.name : undefined}>
            <div className="w-9 h-9 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center font-bold text-xs shrink-0 border border-[var(--color-border)] shadow-sm">
              {user?.name.substring(0,2).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                 <p className="text-sm font-semibold truncate text-[var(--color-ink-primary)]">{user?.name}</p>
                 <p className="text-[11px] text-[var(--color-ink-secondary)] font-medium truncate">{user?.role}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout} 
            title={!isSidebarOpen ? "Sair" : undefined}
            className={`flex items-center text-sm font-medium text-[var(--color-ink-secondary)] hover:text-red-500 transition-colors ${isSidebarOpen ? 'w-full px-2' : 'justify-center'}`}
          >
            <LogOut className={`w-5 h-5 ${isSidebarOpen ? 'mr-3' : ''}`} /> 
            {isSidebarOpen && "Sair do Sistema"}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--color-bg-primary)]">
        <header className="h-20 border-b border-[var(--color-border)] flex items-center justify-between px-6 lg:px-8 bg-[var(--color-bg-card)]/80 backdrop-blur-md z-10 sticky top-0 transition-colors">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                title="Alternar Menu"
              >
                 <Menu className="w-5 h-5" />
              </button>
              
              <div className="hidden sm:flex items-center bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full px-4 py-2 w-96 transition-all focus-within:ring-2 focus-within:ring-[var(--color-brand-wine)]/20 focus-within:border-[var(--color-brand-wine)]/50">
                 <Search className="w-4 h-4 text-[var(--color-ink-secondary)] shrink-0" />
                 <input 
                   type="text" 
                   placeholder="Buscar chamado, proposta ou banco..." 
                   className="bg-transparent border-none text-sm w-full focus:ring-0 outline-none text-[var(--color-ink-primary)] ml-3 placeholder:text-[var(--color-ink-secondary)]/70" 
                 />
              </div>
           </div>
           
           <div className="flex items-center gap-5 sm:gap-6">
              <div className="hidden xs:flex flex-col items-end">
                 <span className="text-[10px] text-[var(--color-ink-secondary)] font-bold uppercase tracking-widest">SLA Médio</span>
                 <span className="text-sm font-mono font-semibold text-[var(--color-status-success)]">01:24:12</span>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)] hidden sm:block"></div>
              
              <button 
                onClick={toggleTheme}
                className="p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
                title={`Mudar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              <div className="relative cursor-pointer p-2 text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors">
                 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--color-bg-card)]"></span>
                 <Bell className="w-5 h-5" />
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 transition-colors">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
