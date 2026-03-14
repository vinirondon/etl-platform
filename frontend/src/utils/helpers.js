export function formatDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(d));
}
export function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;
}
export function formatCNPJ(v) {
  const digits = v?.replace(/\D/g,'') || '';
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
export function roleLabel(role) {
  const map = { superadmin: 'Super Admin', admin: 'Administrador', operator: 'Operador', viewer: 'Visualizador' };
  return map[role] || role;
}
export function roleBadge(role) {
  const map = { superadmin: 'badge-error', admin: 'badge-warning', operator: 'badge-info', viewer: 'badge-neutral' };
  return map[role] || 'badge-neutral';
}
