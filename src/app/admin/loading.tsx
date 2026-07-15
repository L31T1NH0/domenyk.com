export default function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-label="Carregando administração">
      <header className="admin-loading-header" aria-hidden>
        <span className="admin-skeleton admin-skeleton-title" />
        <span className="admin-skeleton admin-skeleton-copy" />
      </header>
      <section className="admin-loading-metrics" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => <span key={index} className="admin-skeleton" />)}
      </section>
      <section className="admin-loading-panel" aria-hidden>
        <span className="admin-skeleton admin-skeleton-copy" />
        <span className="admin-skeleton admin-skeleton-row" />
        <span className="admin-skeleton admin-skeleton-row" />
        <span className="admin-skeleton admin-skeleton-row" />
      </section>
      <span className="sr-only">Carregando conteúdo do painel.</span>
    </div>
  )
}
