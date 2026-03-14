import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Plug2, CalendarClock, ScrollText, Users, LogOut, Database, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies', icon: Building2, label: 'Empresas' },
  { to: '/integrations', icon: Plug2, label: 'Integrações' },
  { to: '/schedules', icon: CalendarClock, label: 'Agendamentos' },
  { to: '/logs', icon: ScrollText, label: 'Logs & Execuções' },
  { to: '/databases', icon: Database, label: 'Bancos de Dados' },
  { to: '/users', icon: Users, label: 'Usuários', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="w-60 min-h-screen bg-[#0d1018] border-r border-[#1e2535] flex flex-col fixed left-0 top-0 bottom-0 z-30">
      <div className="p-5 border-b border-[#1e2535]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Database size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">ETL Platform</div>
            <div className="text-xs text-[#8892a4]">Data Integration</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.filter(n => !n.adminOnly || ['superadmin','admin'].includes(user?.role)).map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${isActive ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25' : 'text-[#8892a4] hover:text-white hover:bg-[#1a2236]'}`}>
            <item.icon size={16} />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[#1e2535]">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs font-medium text-white truncate">{user?.name}</div>
          <div className="text-xs text-[#8892a4] truncate">{user?.email}</div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-[#8892a4] hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all">
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
