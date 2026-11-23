"use client"
import { Button, Feedback, HStack, PageHeader, VStack } from "./_components/ui"
export default function AdminError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <VStack gap={6}>
    <PageHeader title="Esta área não carregou" />
    <Feedback error="Não foi possível carregar os dados. Tente novamente." />
    <HStack wrap="wrap" gap={2}><Button label="Tentar novamente" variant="primary" onClick={unstable_retry} /><Button label="Voltar ao início" href="/admin" /></HStack>
  </VStack>
}
