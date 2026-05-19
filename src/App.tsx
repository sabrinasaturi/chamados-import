import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketsList from './pages/TicketsList';
import TicketDetail from './pages/TicketDetail';
import TicketCreate from './pages/TicketCreate';
import UsersManagement from './pages/UsersManagement';
import ChangePassword from './pages/ChangePassword';
import Parametrizations from './pages/Parametrizations';
import C2Logo from './components/C2Logo';

const ProtectedRoute = ({ children, requirePasswordReset = false }: { children: React.ReactNode, requirePasswordReset?: boolean }) => {
  const { user, loading } = useAuth();
  if (loading) return (
     <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
        <C2Logo className="h-16 mb-8 animate-pulse" />
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-brand-wine)]/30 border-t-[var(--color-brand-wine)] animate-spin"></div>
     </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.forcePasswordReset && !requirePasswordReset) {
    return <Navigate to="/alterar-senha" replace />;
  }
  if (!user.forcePasswordReset && requirePasswordReset) {
     return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/alterar-senha" element={<ProtectedRoute requirePasswordReset={true}><ChangePassword /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
               <Route index element={<Dashboard />} />
               <Route path="chamados" element={<TicketsList />} />
               <Route path="chamados/novo" element={<TicketCreate />} />
               <Route path="chamados/:id" element={<TicketDetail />} />
               <Route path="usuarios" element={<UsersManagement />} />
               <Route path="parametros" element={<Parametrizations />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
