export default function Spinner({ size = 5 }) {
  return <div className={`w-${size} h-${size} border-2 border-[#1e2535] border-t-brand-500 rounded-full animate-spin`} />;
}
