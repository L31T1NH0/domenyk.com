import Link from "next/link"
import { ensureDefaultThemes, getThemes } from "@/lib/db/themes"

export default async function AdminThemesPage() {
  await ensureDefaultThemes()
  const themes = await getThemes()

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1>Temas</h1>
          <p>Coleções editoriais controladas. Só temas ativos podem aparecer no Google.</p>
        </div>
        <Link href="/admin/temas/new" className="admin-button-primary">Novo tema</Link>
      </header>
      <section className="admin-list" aria-label="Temas editoriais">
        <header className="admin-list-header">
          <span>Tema</span><span>Estado</span><span>Textos</span><span aria-hidden />
        </header>
        {themes.map((theme) => (
          <Link key={theme._id.toString()} href={`/admin/temas/${theme._id.toString()}`} className="admin-list-row admin-theme-row">
            <span className="admin-list-primary"><strong>{theme.name}</strong><small>/temas/{theme.slug}</small></span>
            <span><span className={`admin-status ${theme.active ? "is-positive" : "is-muted"}`}>{theme.active ? "Ativo" : "Inativo"}</span></span>
            <span className="admin-list-number">{theme.postIds.length}</span>
            <span className="admin-list-action">Editar</span>
          </Link>
        ))}
      </section>
      <p className="admin-page-note">Os seis temas iniciais ficam inativos até você escolher e ordenar os textos de cada coleção.</p>
    </>
  )
}
