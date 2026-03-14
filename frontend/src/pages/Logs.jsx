import { useState, useEffect } from 'react';
import { logsAPI, integrationsAPI, companiesAPI } from '../services/api';
import { ScrollText, ChevronDown, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatDuration } from '../utils/helpers';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: '', company_id: '', integration_id: '', limit: 50 });
  const [companies, setCompanies] = useState([]);
  const [integrations, setIntegrations] = useState([]);

  const load = async () => {
    setLoading(true);
    const [l, c, i] = await Promise.all([
      logsAPI.list(filters),
      companiesAPI.list(),
      integrationsAPI.list()
    ]);
    setLogs(l.data.logs);
    setTotal(l.data.total);
    setCompanies(c.data);
    setIntegrations(i.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters.status, filters.company_id, filters.integration_id, filters.limit]);

  const f = (k) => (e) => setFilters(p => ({ ...p, [k]: e.target.value }));

  const statusIcon = (s) => {
    if (s === 'success') return <CheckCircle size={14} className="text-emerald-400" />;
    if (s === 'error') return <AlertCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-brand-400" />;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Logs de Execução" subtitle={`${total} execuções registradas no total`}
        action={<button onClick={load} className="btn-secondary"><RefreshCw size={14} />Atualizar</button>} />

      <div className="flex flex-wrap gap-3">
        <select className="select w-44" value={filters.status} onChange={f('status')}>
          <option value="">Todos status</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
          <option value="running">Executando</option>
        </select>
        <select className="select w-48" value={filters.company_id} onChange={f('company_id')}>
          <option value="">Todas empresas</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
        </select>
        <select className="select w-48" value={filters.integration_id} onChange={f('integration_id')}>
          <option value="">Todas integrações</option>
          {integrations.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className="select w-32" value={filters.limit} onChange={f('limit')}>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Integração</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Empresa</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Início</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Duração</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Registros</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-[#8892a4] font-medium">Tipo</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10"><Spinner size={6} /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-[#8892a4]">Nenhum log encontrado</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-[#1e2535]/50 hover:bg-[#1a2236] cursor-pointer transition-colors" onClick={() => setSelected(log)}>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{statusIcon(log.status)}<StatusBadge status={log.status} /></div></td>
                    <td className="px-4 py-3 font-medium text-white">{log.integration_name}</td>
                    <td className="px-4 py-3 text-[#8892a4]">{log.company_name}</td>
                    <td className="px-4 py-3 text-[#8892a4] text-xs">{formatDate(log.started_at)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-[#8892a4]">{formatDuration(log.duration_ms)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono">
                      <span className="text-emerald-400">{log.records_inserted}</span>
                      <span className="text-[#8892a4]">/</span>
                      <span className="text-amber-400">{log.records_updated}</span>
                    </td>
                    <td className="px-4 py-3"><span className="badge-neutral">{log.trigger_type}</span></td>
                    <td className="px-4 py-3"><ChevronDown size={14} className="text-[#8892a4]" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes da Execução" size="lg">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Status', <StatusBadge status={selected.status} />],
                ['Tipo', <span className="badge-neutral">{selected.trigger_type}</span>],
                ['Início', formatDate(selected.started_at)],
                ['Término', formatDate(selected.finished_at)],
                ['Duração', formatDuration(selected.duration_ms)],
                ['HTTP Status', selected.response_status || '—'],
                ['Buscados', selected.records_fetched],
                ['Inseridos', selected.records_inserted],
                ['Atualizados', selected.records_updated],
                ['Pulados', selected.records_skipped],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#0f1117] rounded-lg p-3 border border-[#1e2535]">
                  <div className="text-xs text-[#8892a4] mb-1">{k}</div>
                  <div className="font-medium text-white">{v}</div>
                </div>
              ))}
            </div>
            {selected.error_message && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="text-xs text-red-400 font-medium mb-1">Mensagem de Erro</div>
                <div className="text-red-300 text-xs font-mono">{selected.error_message}</div>
              </div>
            )}
            {selected.raw_response && (
              <div>
                <div className="text-xs text-[#8892a4] mb-1">Resposta da API (preview)</div>
                <pre className="bg-[#0f1117] border border-[#1e2535] rounded-lg p-3 text-xs font-mono text-[#8892a4] overflow-auto max-h-48">{selected.raw_response}</pre>
              </div>
            )}
            <div className="text-xs text-[#8892a4]">
              <span className="font-mono">Batch ID: {selected.batch_id}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
