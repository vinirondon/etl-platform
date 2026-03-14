export default function StatusBadge({ status }) {
  const map = {
    success: 'badge-success', active: 'badge-success', ativo: 'badge-success',
    error: 'badge-error', inactive: 'badge-neutral', inativo: 'badge-neutral',
    running: 'badge-info', warning: 'badge-warning', scheduled: 'badge-info',
    manual: 'badge-warning', pending: 'badge-neutral',
  };
  const labels = {
    success: 'Sucesso', error: 'Erro', active: 'Ativo', inactive: 'Inativo',
    running: 'Executando', scheduled: 'Agendado', manual: 'Manual',
    ativo: 'Ativo', inativo: 'Inativo', pending: 'Pendente'
  };
  const cls = map[status?.toLowerCase()] || 'badge-neutral';
  return <span className={cls}>{labels[status?.toLowerCase()] || status}</span>;
}
