import groups from '../data/nationality_groups.json'

// Um jogador só conta como estrangeiro se o seu país for diferente do
// país do clube E nenhum acordo de livre circulação (bloco europeu,
// comunidade lusófona) cobrir os dois países ao mesmo tempo.
const GROUPS: string[][] = [groups.FREE_MOVEMENT_EU, groups.LUSOFONIA]

export function isForeign(playerCountry: string, clubCountry: string): boolean {
  if (playerCountry === clubCountry) return false
  for (const group of GROUPS) {
    if (group.includes(playerCountry) && group.includes(clubCountry)) return false
  }
  return true
}

export function foreignCount(players: { nationality: string }[], clubCountry: string): number {
  return players.filter((p) => isForeign(p.nationality, clubCountry)).length
}

export const MAX_FOREIGNERS = 5
export const MAX_SQUAD = 24
export const MIN_SQUAD = 11
export const MIN_GK = 1
export const MIN_FIELD = 10
