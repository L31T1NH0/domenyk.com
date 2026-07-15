export default function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-label="Carregando administração">
      <header className="admin-loading-header" aria-hidden>
        <span className="admin-skeleton admin-skeleton-title" />
        <span className="admin-skeleton admin-skeleton-copy" />
      </header>
      <section className="admin-loading-workspace" aria-hidden>
        <header><span className="admin-skeleton admin-skeleton-copy" /><span className="admin-skeleton admin-skeleton-control" /></header>
        <div>
          <span className="admin-skeleton admin-skeleton-row" />
          <span className="admin-skeleton admin-skeleton-row" />
          <span className="admin-skeleton admin-skeleton-row" />
          <span className="admin-skeleton admin-skeleton-row" />
        </div>
      </section>
      <span className="sr-only">Carregando conteúdo do painel.</span>
    </div>
  )
}
