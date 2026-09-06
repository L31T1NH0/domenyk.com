"use client"

import { useId, useState, type FormEvent } from "react"
import type { AdminWritingEntry } from "@/lib/db/writing-progress"

const fieldClass = "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm text-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-100"
const buttonClass = "min-h-10 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-white/5"

function WritingForm({ entry, onSaved }: {
  entry?: AdminWritingEntry
  onSaved: (entry: AdminWritingEntry) => void
}) {
  const id = useId()
  const [title, setTitle] = useState(entry?.title ?? "")
  const [progress, setProgress] = useState(String(entry?.progress ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const dirty = entry ? title.trim() !== entry.title || Number(progress) !== entry.progress : true

  async function save(completed = entry?.completed ?? false) {
    if (busy) return
    const percentage = Number(progress)
    if (!title.trim() || title.trim().length > 180 || progress.trim() === "" || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      setError("Informe um título e uma porcentagem inteira entre 0 e 100.")
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(entry ? `/api/admin/writing/${entry.id}` : "/api/admin/writing", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), progress: percentage, completed }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível salvar. Tente novamente.")
      if (entry) {
        onSaved({ ...entry, title: title.trim(), progress: percentage, completed })
        setTitle(title.trim())
        setNotice(completed ? "Concluído. O texto saiu da home." : "Salvo. O progresso aparece na home.")
      } else {
        onSaved(data as AdminWritingEntry)
        setTitle("")
        setProgress("0")
        setNotice("Texto adicionado à home.")
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save()
  }

  return (
    <form onSubmit={submit} aria-label={entry ? `Editar ${entry.title}` : "Adicionar texto"} aria-busy={busy} className="flex min-w-0 flex-col gap-3">
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div className="min-w-0">
          <label htmlFor={`${id}-title`} className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Título</label>
          <input id={`${id}-title`} required maxLength={180} value={title} onChange={(event) => { setTitle(event.target.value); setNotice("") }} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${id}-progress`} className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Progresso (%)</label>
          <input id={`${id}-progress`} type="number" required min={0} max={100} step={1} value={progress} onChange={(event) => { setProgress(event.target.value); setNotice("") }} className={`${fieldClass} tabular-nums`} />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !dirty} className={buttonClass}>{busy ? "Salvando…" : entry ? "Salvar alterações" : "Adicionar texto"}</button>
        {entry && <button type="button" disabled={busy} onClick={() => void save(!entry.completed)} className={buttonClass}>
          {entry.completed ? "Retomar escrita" : "Marcar como concluído"}
        </button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-neutral-600 dark:text-neutral-400">{notice}</p>}
    </form>
  )
}

export function WritingManager({ initialEntries }: { initialEntries: AdminWritingEntry[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const active = entries.filter((entry) => !entry.completed)
  const completed = entries.filter((entry) => entry.completed)

  function handleSaved(entry: AdminWritingEntry) {
    setEntries((current) => current.some((item) => item.id === entry.id)
      ? current.map((item) => item.id === entry.id ? entry : item)
      : [entry, ...current])
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section aria-labelledby="writing-new-title" className="flex flex-col gap-4">
        <h2 id="writing-new-title" className="text-base font-semibold">Adicionar texto</h2>
        <WritingForm onSaved={handleSaved} />
        <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-400">O título e a porcentagem aparecem junto de Arquivos e Categorias. Chegar a 100% mantém o texto na lista até você marcar como concluído.</p>
      </section>
      <section aria-labelledby="writing-active-title" className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 id="writing-active-title" className="mb-4 text-base font-semibold">Em andamento</h2>
        {active.length === 0 ? <p className="text-sm text-neutral-600 dark:text-neutral-400">Nenhum texto em andamento. Adicione o primeiro acima.</p> : (
          <ul className="flex flex-col gap-6">{active.map((entry) => <li key={entry.id} className="border-b border-neutral-200 pb-6 dark:border-neutral-800"><WritingForm entry={entry} onSaved={handleSaved} /></li>)}</ul>
        )}
      </section>
      {completed.length > 0 && <section aria-labelledby="writing-completed-title">
        <h2 id="writing-completed-title" className="mb-4 text-base font-semibold">Concluídos</h2>
        <ul className="flex flex-col gap-6">{completed.map((entry) => <li key={entry.id} className="border-b border-neutral-200 pb-6 dark:border-neutral-800"><WritingForm entry={entry} onSaved={handleSaved} /></li>)}</ul>
      </section>}
    </div>
  )
}
