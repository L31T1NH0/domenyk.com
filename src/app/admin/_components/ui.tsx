"use client"

import { useRef, useState, type ReactNode, type RefObject, type ComponentProps } from "react"
import { TextInput } from "@astryxdesign/core/TextInput"
import { AlertDialog } from "@astryxdesign/core/AlertDialog"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Collapsible } from "@astryxdesign/core/Collapsible"
import { Heading } from "@astryxdesign/core/Heading"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { Tab, TabList } from "@astryxdesign/core/TabList"

export { Button, Heading, HStack, VStack, Text }
export { TextArea as Area } from "@astryxdesign/core/TextArea"
export { Selector as Select } from "@astryxdesign/core/Selector"
export { CheckboxInput as Check } from "@astryxdesign/core/CheckboxInput"
export { Link } from "@astryxdesign/core/Link"
export { Grid } from "@astryxdesign/core/Grid"
export { Table } from "@astryxdesign/core/Table"
export { Divider } from "@astryxdesign/core/Divider"
export { Avatar } from "@astryxdesign/core/Avatar"
export { ProgressBar } from "@astryxdesign/core/ProgressBar"

export function Input({ maxLength, onChange, ...props }: ComponentProps<typeof TextInput> & { maxLength?: number }) {
  return <TextInput {...props} onChange={(value, event) => onChange?.(maxLength === undefined ? value : value.slice(0, maxLength), event)} />
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: ReactNode }) {
  return <VStack as="header" gap={4}>
    {back}
    <HStack hAlign="between" vAlign="start" wrap="wrap" gap={4}>
      <VStack gap={2} className="min-w-0 flex-1">
        <Heading level={1} textWrap="balance">{title}</Heading>
        {description && <Text as="p" color="secondary" textWrap="pretty">{description}</Text>}
      </VStack>
      {actions && <HStack wrap="wrap" gap={2}>{actions}</HStack>}
    </HStack>
  </VStack>
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <VStack as="section" gap={4} className="min-w-0">
    <HStack hAlign="between" wrap="wrap" gap={3}>
      <Heading level={2}>{title}</Heading>
      {actions}
    </HStack>
    {children}
  </VStack>
}

export function Disclosure({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <Collapsible defaultIsOpen={open} trigger={<Text type="label">{title}</Text>}>
    <VStack gap={4} paddingBlock={4}>{children}</VStack>
  </Collapsible>
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  if (error) return <Banner status="error" title={error} />
  if (message) return <p role="status"><Text color="secondary">{message}</Text></p>
  return null
}

export function Empty({ children }: { children: ReactNode }) {
  return <VStack paddingBlock={10} gap={3}><Text as="p" color="secondary">{children}</Text></VStack>
}

export function DeleteButton({ onDelete, title, description = "Esta ação é permanente.", label = "Excluir", disabled = false }: {
  onDelete: () => Promise<unknown>; title: string; description?: string; label?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function confirm() {
    if (busy) return
    setBusy(true)
    setError("")
    try { await onDelete(); setOpen(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir. Tente novamente.") }
    finally { setBusy(false) }
  }
  return <>
    <Button label={label} variant="ghost" size="sm" isDisabled={disabled} onClick={() => { setError(""); setOpen(true) }} />
    <AlertDialog isOpen={open} onOpenChange={value => { if (!busy) setOpen(value) }} title={title} description={error || description}
      actionLabel="Excluir" cancelLabel="Cancelar" isActionLoading={busy} onAction={() => void confirm()} />
  </>
}

export function FilePicker({ label, accept, onFile, busy = false, inputRef }: {
  label: string; accept: string; onFile: (file: File) => unknown; busy?: boolean; inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? localRef
  return <>
    <Button label={label} isLoading={busy} onClick={() => ref.current?.click()} />
    <input ref={ref} type="file" accept={accept} hidden disabled={busy} aria-label={label}
      onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void onFile(file); event.currentTarget.value = "" }} />
  </>
}

export function Tabs({ value, onChange, options, label }: {
  value: string; onChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }>; label: string;
}) {
  return <TabList value={value} onChange={onChange} aria-label={label}>
    {options.map(option => <Tab key={option.value} value={option.value} label={option.label} />)}
  </TabList>
}

export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return <VStack as="dl" gap={3}>
    {items.map(([label, value]) => <HStack as="section" key={label} hAlign="between" gap={4} vAlign="start">
      <dt><Text color="secondary">{label}</Text></dt><dd className="min-w-0 text-end break-words"><Text>{value}</Text></dd>
    </HStack>)}
  </VStack>
}

export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return <section role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 [&_table]:min-w-2xl [&_th]:whitespace-nowrap">
    {children}
  </section>
}
