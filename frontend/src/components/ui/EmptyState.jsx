export default function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-[#1e2535] flex items-center justify-center mb-4">
        <Icon size={24} className="text-[#8892a4]" />
      </div>}
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-[#8892a4] text-sm mb-4 max-w-xs">{desc}</p>
      {action}
    </div>
  );
}
