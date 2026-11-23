// Placeholder used by feature stubs until the owning agent replaces them. DELETE usage when real component lands.
export function Stub({ name }: { name: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center text-muted">
      <strong className="text-fg">{name}</strong> is under construction.
    </div>
  )
}
