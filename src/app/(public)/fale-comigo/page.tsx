import type { Metadata } from "next"
import { Correspondence } from "@/components/messages/Correspondence"

export const metadata: Metadata = { title: "Fale comigo", description: "Envie uma ideia, sugestão ou melhoria diretamente para Domenyk." }
export default function ContactPage() { return <Correspondence /> }
