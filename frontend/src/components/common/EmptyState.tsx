export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-ink/25 bg-rice/60 p-8 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-2 text-sm text-ink/65">{description}</p>
    </div>
  );
}
