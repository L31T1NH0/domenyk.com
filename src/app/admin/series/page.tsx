import Link from "next/link"
import { getSeries } from "@/lib/db/series"
import { AdminCommandHeader } from "../AdminCommandHeader"

export default async function AdminSeriesPage() {
  const series = await getSeries()
  return (
    <>
      <AdminCommandHeader
        title="Séries"
        description="Obras contínuas publicadas capítulo por capítulo."
        actions={<Link href="/admin/series/new" className="admin-button-primary">Nova série</Link>}
      />
      <section className="admin-records" aria-label="Séries editoriais">
        <div className="admin-records-toolbar"><div><strong>Todas as séries</strong><small>{series.length} {series.length === 1 ? "obra em andamento" : "obras em andamento"}</small></div></div>
        <div className="admin-theme-cards">
          {series.map((item) => <Link key={item._id.toString()} href={`/admin/series/${item._id.toString()}`} className="admin-theme-card"><div><strong>{item.title}</strong><small>/series/{item.slug}</small></div><dl><div><dt>Estado</dt><dd><span className={`admin-record-status ${item.published ? "is-live" : "is-muted"}`}>{item.published ? "Pública" : "Rascunho"}</span></dd></div><div><dt>Capítulos</dt><dd>{item.postIds.length}</dd></div></dl></Link>)}
        </div>
        <div className="admin-record-table-wrap">
          <table className="admin-record-table admin-theme-table"><thead><tr><th scope="col">Série</th><th scope="col">Estado</th><th scope="col">Capítulos</th><th scope="col" aria-label="Ação" /></tr></thead><tbody>
            {series.map((item) => <tr key={item._id.toString()}><td><Link href={`/admin/series/${item._id.toString()}`}><strong>{item.title}</strong><small>/series/{item.slug}</small></Link></td><td><span className={`admin-record-status ${item.published ? "is-live" : "is-muted"}`}>{item.published ? "Pública" : "Rascunho"}</span></td><td className="admin-record-number">{item.postIds.length}</td><td><Link href={`/admin/series/${item._id.toString()}`} className="admin-record-open">Editar</Link></td></tr>)}
          </tbody></table>
        </div>
        {series.length === 0 && <p className="admin-empty">Nenhuma série criada ainda.</p>}
      </section>
    </>
  )
}
