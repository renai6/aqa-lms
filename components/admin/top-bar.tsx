export function TopBar() {
  return (
    <header className="h-12 bg-background border-b border-border sticky top-0 z-10 px-6 flex items-center justify-between shrink-0">
      {/* Left slot: reserved for breadcrumb context in future phases */}
      <div />
      {/* Right slot: reserved for global search / notifications */}
      <div />
    </header>
  )
}
