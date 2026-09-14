export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-ink/15 bg-rice p-5">
      <p className="text-sm text-ink/55">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
