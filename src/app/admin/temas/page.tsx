import Link from "next/link"
import { getThemes } from "@/lib/db/themes"
import { AdminCommandHeader } from "../AdminCommandHeader"
import { DefaultThemeInitializer } from "./DefaultThemeInitializer"

export default async function AdminThemesPage() {
  const themes = await getThemes()

  return (
    <>
      <DefaultThemeInitializer />
      <AdminCommandHeader
        title="Temas"
        description="Coleções editoriais controladas. Só temas ativos podem aparecer no Google."
        actions={<Link href="/admin/temas/new" className="admin-button-primary">Novo tema</Link>}
      />
      <section className="admin-records" aria-label="Temas editoriais">
        <div className="admin-records-toolbar"><div><strong>Todos os temas</strong><small>{themes.length} coleções editoriais</small></div></div>
        <div className="admin-theme-cards">
          {themes.map((theme) => <Link key={theme._id.toString()} href={`/admin/temas/${theme._id.toString()}`} className="admin-theme-card"><div><strong>{theme.name}</strong><small>/temas/{theme.slug}</small></div><dl><div><dt>Estado</dt><dd><span className={`admin-record-status ${theme.active ? "is-live" : "is-muted"}`}>{theme.active ? "Ativo" : "Inativo"}</span></dd></div><div><dt>Textos</dt><dd>{theme.postIds.length}</dd></div></dl></Link>)}
        </div>
        <div className="admin-record-table-wrap">
          <table className="admin-record-table admin-theme-table"><thead><tr><th scope="col">Tema</th><th scope="col">Estado</th><th scope="col">Textos</th><th scope="col" aria-label="Ação" /></tr></thead><tbody>
            {themes.map((theme) => <tr key={theme._id.toString()}><td><Link href={`/admin/temas/${theme._id.toString()}`}><strong>{theme.name}</strong><small>/temas/{theme.slug}</small></Link></td><td><span className={`admin-record-status ${theme.active ? "is-live" : "is-muted"}`}>{theme.active ? "Ativo" : "Inativo"}</span></td><td className="admin-record-number">{theme.postIds.length}</td><td><Link href={`/admin/temas/${theme._id.toString()}`} className="admin-record-open">Editar</Link></td></tr>)}
          </tbody></table>
        </div>
      </section>
      <p className="admin-page-note">Os seis temas iniciais ficam inativos até você escolher e ordenar os textos de cada coleção.</p>
    </>
  )
}
