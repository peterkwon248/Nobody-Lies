import type { Case } from '@engine/types'
import { ko } from './loadCase'
import { initialOf, personColor, relationOf } from './people'
import type { Board, PlayerAnnotations } from '../state/stores'

/**
 * 상황판에 올릴 수 있는 것 — 원본 `buildBoardSeed()`(2285~2295행).
 *
 * ★ 서랍은 확보한 것만 보여준다 ★ 아직 안 나온 물증이 목록에 있으면 그 목록이
 * 곧 「앞으로 뭐가 나올지」를 알려준다. 물증은 **확보 단어**에서만 온다.
 */

export type CardKind = 'person' | 'evidence' | 'quote' | 'memo'

export type Card = {
  id: string
  kind: CardKind
  label: string
  sub?: string
  /** 아바타 이니셜 · 물증 머리글자 */
  ini?: string
  color: string
  /** 진술·메모 카드의 본문 */
  quote?: string
}

/** 조각 크기 3단. 원본 `PB_cardW`/`PB_cardH`(dot 32 · chip 128×34 · full 200) */
export const cardW = (size: string) => (size === 'dot' ? 32 : size === 'chip' ? 128 : 200)
export const cardH = (size: string, kind: CardKind) =>
  size === 'dot' ? 32 : size === 'chip' ? 34 : (kind === 'quote' ? 96 : 64)

/** 원본 1707행 — 종류가 곧 색이다. **유용도가 아니다** */
export const KIND_COLOR: Record<CardKind, string> = {
  person: 'var(--fg-3)',
  evidence: 'var(--accent)',
  quote: 'var(--fg-3)',
  memo: '#F2C94C',
}

export const KIND_LABEL: Record<CardKind, string> = {
  person: '인물', evidence: '물증', quote: '진술', memo: '메모',
}

export function boardCards(
  c: Case,
  terms: Set<string>,
  notes: PlayerAnnotations['notes'],
  board: Board,
): Card[] {
  const cards: Card[] = []

  c.people.forEach((p, i) => {
    cards.push({
      id: `p_${p.id}`, kind: 'person', label: p.name, sub: relationOf(c, p),
      ini: initialOf(p.name), color: personColor(i),
    })
  })

  // 확보 단어만. 아직 안 나온 것을 서랍에 두면 그게 곧 남은 단서 목록이다
  for (const w of [...terms].sort())
    cards.push({ id: `e_${w}`, kind: 'evidence', label: w, color: 'var(--accent)' })

  c.people.forEach((p, i) => {
    const first = ko(p.statement?.paragraphs?.[0])
    if (!first) return
    cards.push({
      id: `q_${p.id}`, kind: 'quote', label: `${p.name} 진술`, color: personColor(i),
      ini: '“', quote: `“${first.length > 70 ? `${first.slice(0, 70)}…` : first}”`,
    })
  })

  // 메모장에 쓴 것. 원본 2295행도 진술 칸에 넣는다 — 인용문이 담긴 카드라서다
  notes.forEach((n, i) => {
    if (!n.content.trim()) return
    cards.push({
      id: `mm_${n.id}`, kind: 'quote', label: `메모 #${i + 1}`,
      color: 'var(--fg-3)', ini: '“', quote: n.content,
    })
  })

  // 판 위에서 직접 만든 메모. 서랍이 아니라 판이 고향이다
  for (const id of board.memoOrder)
    cards.push({
      id, kind: 'memo', label: (board.memoText[id] || '빈 메모').slice(0, 16),
      color: KIND_COLOR.memo, ini: '메',
    })

  return cards
}

/** `p_yena#2` 처럼 복제된 조각도 원본 카드를 찾을 수 있어야 한다 (원본 `PB_baseId`) */
export const baseId = (id: string) => id.split('#')[0]
