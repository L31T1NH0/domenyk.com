"use client"

import { Avatar, HStack, Input, PageHeader, Table, TableRegion, Text, VStack } from "../_components/ui"
import { useMemo, useState } from "react"

type Person = { id: string; name: string; email: string; image: string; role: string; comments: number; joined: string }
export function PeopleWorkspace({ people }: { people: Person[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => people.filter(person => `${person.name} ${person.email} ${person.id}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [people, query])
  return <VStack gap={6}>
    <PageHeader title="Pessoas" description={`${people.length} contas fazem parte desta comunidade.`} />
    <Input label="Buscar nome ou e-mail" type="search" value={query} onChange={setQuery} hasClear />
    <TableRegion label="Pessoas cadastradas"><Table data={filtered} idKey="id" columns={[
      { key: "name", header: "Pessoa", renderCell: person => <HStack gap={3}><Avatar name={person.name} src={person.image} size="sm" /><VStack gap={1}><Text weight="medium">{person.name}</Text><Text type="supporting">{person.email}</Text><Text type="supporting" maxLines={1}>{person.id}</Text></VStack></HStack> },
      { key: "role", header: "Papel" }, { key: "comments", header: "Comentários", align: "end" }, { key: "joined", header: "Cadastro" },
    ]} emptyState={<Text>Nenhuma pessoa encontrada.</Text>} /></TableRegion>
  </VStack>
}
