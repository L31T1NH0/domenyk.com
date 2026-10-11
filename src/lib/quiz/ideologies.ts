import "server-only"
import type { Dimension } from "./types"
type Reference = { name: string; x: number; y: number; dimensions: Record<Dimension, number> }
// Protótipos editoriais, não definições universais nem probabilidades de identificação.
export const IDEOLOGIES: Reference[] = [
  {name:"Liberal clássico",x:7,y:-5,dimensions:{AE:8,CP:8,IG:-4,ES:-6,LC:7,TR:0,PU:0,DE:6,IN:8,AB:7,PR:8,RR:7}},
  {name:"Minarquismo",x:9,y:-7,dimensions:{AE:9,CP:9,IG:-8,ES:-9,LC:9,TR:0,PU:-2,DE:8,IN:7,AB:8,PR:9,RR:8}},
  {name:"Liberalismo social",x:2,y:-5,dimensions:{AE:4,CP:5,IG:5,ES:3,LC:8,TR:-5,PU:-3,DE:3,IN:8,AB:7,PR:5,RR:5}},
  {name:"Social-democracia",x:-4,y:-4,dimensions:{AE:-2,CP:1,IG:8,ES:7,LC:7,TR:-4,PU:-3,DE:2,IN:8,AB:4,PR:2,RR:5}},
  {name:"Socialismo democrático",x:-8,y:-4,dimensions:{AE:-6,CP:-6,IG:9,ES:8,LC:7,TR:-4,PU:-4,DE:3,IN:6,AB:3,PR:-7,RR:3}},
  {name:"Socialismo libertário",x:-8,y:-8,dimensions:{AE:-3,CP:-7,IG:9,ES:-5,LC:9,TR:-6,PU:-8,DE:9,IN:3,AB:6,PR:-8,RR:1}},
  {name:"Liberal-conservador",x:6,y:-1,dimensions:{AE:6,CP:7,IG:-4,ES:-4,LC:3,TR:8,PU:5,DE:5,IN:7,AB:3,PR:8,RR:6}},
  {name:"Conservador nacional",x:0,y:5,dimensions:{AE:1,CP:-1,IG:0,ES:5,LC:-4,TR:9,PU:8,DE:-3,IN:1,AB:-8,PR:5,RR:3}},
  {name:"Estatismo autoritário",x:-7,y:8,dimensions:{AE:-8,CP:-8,IG:6,ES:9,LC:-8,TR:2,PU:8,DE:-8,IN:-7,AB:-6,PR:-7,RR:-3}},
]

export function profileDistance(
  profile: typeof IDEOLOGIES[number],
  values: Partial<Record<Dimension | "x" | "y", number | null>>,
  reliability: Partial<Record<Dimension | "x" | "y", number>>,
) {
  let sum = 0, total = 0
  for (const key of Object.keys(values) as (Dimension | "x" | "y")[]) {
    const value = values[key], weight = reliability[key] ?? 0
    if (value == null || weight <= 0) continue
    const reference = key === "x" || key === "y" ? profile[key] : profile.dimensions[key]
    sum += weight * (value - reference) ** 2
    total += weight
  }
  return total ? Math.sqrt(sum / total) : Infinity
}
