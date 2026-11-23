"use client"
import { ProgressBar, VStack } from "./_components/ui"
export default function AdminLoading() {
  return <VStack paddingBlock={10}><ProgressBar label="Carregando seu espaço" isIndeterminate /></VStack>
}
