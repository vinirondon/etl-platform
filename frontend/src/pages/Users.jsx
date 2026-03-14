import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { Plus, Users as UsersIcon, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate, roleLabel, roleBadge } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

function UserForm({ user, onSave, onClose, currentUser }) {
  const [form, setForm] = useState(user || { name:'', email:'', password:'', role:'operator', status:'active' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const roles = currentUser.role === 'superadmin' ? ['superadmin','admin','operator','viewer'] : ['operator','viewer'];

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (user?.id) await usersAPI.update(user.id, { name: form.name, role: form.role, status: form.status });
      else await usersAPI.create(form);
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nome *</label>
          <input className="input" value={form.name} onChange={f('name')} required />
        </div>
        {!user && <div className="col-span-2">
          <label className="label">E-mail *</label>
          <input className="input" type="email" value={form.email} onChange={f('email')} required />
        </div>}
        {!user && <div className="col-span-2">
          <label className="label">Senha *</label>
          <input className="input" type="password" value={form.password} onChange={f('password')} required minLength={8} />
        </div>}
        <div>
          <label className="label">Perfil</label>
          <select className="select" value={form.role} onChange={f('role')}>
            {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={f('status')}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>
      {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size={4} /> : null}
          {user ? 'Salvar' : 'Criar Usuário'}
        </button>
      </div>
    </form>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const { user: currentUser, canDo } = useAuth();

  const load = () => usersAPI.list().then(r => setUsers(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Remover usuário "${name}"?`)) return;
    await usersAPI.delete(id);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Usuários" subtitle={`${users.length} usuário(s) cadastrado(s)`}
        action={canDo('superadmin','admin') && (
          <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} />Novo Usuário</button>
        )} />

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2535]">
              {['Usuário','Perfil','Status','Último Login','Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-[#1e2535]/50 hover:bg-[#1a2236] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-bold text-brand-400">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-xs text-[#8892a4]">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className={roleBadge(u.role)}><ShieldCheck size={10} />{roleLabel(u.role)}</span></td>
                <td className="px-4 py-3"><span className={u.status === 'active' ? 'badge-success' : 'badge-neutral'}>{u.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
                <td className="px-4 py-3 text-xs text-[#8892a4]">{u.last_login ? formatDate(u.last_login) : 'Nunca'}</td>
                <td className="px-4 py-3">
                  {u.id !== currentUser?.id && canDo('superadmin','admin') && (
                    <div className="flex items-center gap-1">
                      <button className="btn-secondary px-2 py-1.5" onClick={() => setModal({ type: 'edit', user: u })}><Pencil size={13} /></button>
                      {canDo('superadmin') && <button className="btn-danger px-2 py-1.5" onClick={() => handleDelete(u.id, u.name)}><Trash2 size={13} /></button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Novo Usuário">
        <UserForm currentUser={currentUser} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Editar Usuário">
        <UserForm user={modal?.user} currentUser={currentUser} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}
