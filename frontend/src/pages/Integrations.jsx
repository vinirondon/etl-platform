import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { integrationsAPI, companiesAPI, executeAPI } from '../services/api';
import { Plus, Plug2, Play, Zap, Pencil, Trash2, Building2, Loader2, CheckCircle, XCircle, Filter } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';
import IntegrationForm from '../components/forms/IntegrationForm';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [running, setRunning] = useState({});
  const [runResult, setRunResult] = useState(null);
  const { canDo } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    const [i, c] = await Promise.all([
      integrationsAPI.list({ company_id: filterCompany || undefined, status: filterStatus || undefined }),
      companiesAPI.list()
    ]);
    setIntegrations(i.data);
    setCompanies(c.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterCompany, filterStatus]);

  const handleRun = async (id, name) => {
        setRunning(prev => ({ ...prev, [id]: true }));
        try {
            const res = await executeAPI.run(id);
            setRunResult({ name, ...res.data });
        } catch (err) {
            setRunResult({ name, error: err.response?.data?.error || 'Erro desconhecido', status: 'error' });
        } finally {
            setRunning(prev => ({ ...prev, [id]: false }));
        }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remover integração "${name}"?`)) return;
    await integrationsAPI.delete(id);
    load();
  };

  const filtered = integrations;

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Integrações" subtitle={`${integrations.length} integração(ões) configurada(s)`}
        action={canDo('superadmin','admin','operator') && (
          <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} />Nova Integração</button>
        )} />

      <div className="flex gap-3">
        <select className="select w-48" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">Todas empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
        </select>
        <select className="select w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={Plug2} title="Nenhuma integração" desc="Crie uma nova integração para conectar APIs externas." action={canDo('superadmin','admin','operator') && <button className="btn-primary" onClick={() => setModal('create')}><Plus size={16} />Nova Integração</button>} /></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(i => (
            <div key={i.id} className="card hover:border-[#2d3748] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1e2535] flex items-center justify-center flex-shrink-0">
                  <Plug2 size={18} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/integrations/${i.id}`)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{i.name}</span>
                    <StatusBadge status={i.status} />
                    {i.schedule_active ? <span className="badge-info">Agendado</span> : null}
                    <span className="badge-neutral font-mono text-xs">{i.method}</span>
                    <span className="badge-neutral text-xs">{i.response_format?.toUpperCase()}</span>
                  </div>
                  <div className="text-sm text-[#8892a4] flex items-center gap-1 mt-0.5"><Building2 size={12} />{i.company_name}</div>
                  <div className="text-xs text-[#8892a4] font-mono truncate mt-0.5">{i.base_url}{i.endpoint}</div>
                </div>
                <div className="text-right text-xs text-[#8892a4] hidden lg:block">
                  {i.last_run ? <div>Última: {formatDate(i.last_run)}</div> : <div>Nunca executado</div>}
                  {i.last_status && <StatusBadge status={i.last_status} />}
                </div>
                {canDo('superadmin','admin','operator') && (
                  <div className="flex items-center gap-1">
                    <button className="btn-primary px-2 py-1.5" title="Executar agora"
                      disabled={running[i.id]} onClick={() => handleRun(i.id, i.name)}>
                      {running[i.id] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    </button>
                    <button className="btn-secondary px-2 py-1.5" onClick={() => setModal({ type: 'edit', integration: i })}><Pencil size={14} /></button>
                    <button className="btn-danger px-2 py-1.5" onClick={() => handleDelete(i.id, i.name)}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nova Integração" size="xl">
        <IntegrationForm companies={companies} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Editar Integração" size="xl">
        <IntegrationForm companies={companies} integration={modal?.integration} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
      </Modal>
      <Modal open={!!runResult} onClose={() => setRunResult(null)} title="Resultado da Execução" size="sm">
        {runResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {runResult.status === 'success' ? <CheckCircle className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              <div>
                <div className="font-medium text-white">{runResult.name}</div>
                <StatusBadge status={runResult.status} />
              </div>
            </div>
            {runResult.status === 'success' ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="card"><div className="text-xl font-bold text-emerald-400">{runResult.recordsFetched || 0}</div><div className="text-xs text-[#8892a4]">Buscados</div></div>
                <div className="card"><div className="text-xl font-bold text-brand-400">{runResult.recordsInserted || 0}</div><div className="text-xs text-[#8892a4]">Inseridos</div></div>
                <div className="card"><div className="text-xl font-bold text-amber-400">{runResult.recordsUpdated || 0}</div><div className="text-xs text-[#8892a4]">Atualizados</div></div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">{runResult.errorMessage || runResult.error}</div>
            )}
            <button className="btn-primary w-full justify-center" onClick={() => setRunResult(null)}>Fechar</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
