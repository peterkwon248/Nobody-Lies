import type { Action, Case } from '@engine/types'

/**
 * 조사 카드가 쓰는 파생.
 *
 * 조사 기록(원본 572행)과 우측 패널의 기록(905행)이 **같은 카드**를 그린다.
 * 계산이 두 벌이 되면 한쪽만 고쳐지고 아무도 못 잡으므로 여기 한 벌만 둔다
 * (`docs/MEMORY.md` §파생 계층).
 */

/**
 * 조사 결과의 종류 — 색과 라벨. 원본 `tm`(2011행).
 *
 * ★ 이건 **결과의 종류**이지 유용도가 아니다 ★
 * 「단서」와 「무관」이 같은 크기·같은 자리에 온다. 레드 헤링이 흐리게 보이면
 * 그것이 곧 정답 표시다.
 *
 * 네 자리가 이것을 쓴다 — 조사 기록 · 결과 카드 · 우측 패널 · 용의자 상세.
 * 표가 갈라지면 같은 조사가 화면마다 다른 색이 된다.
 */
export const RESULT_KIND: Record<string, { label: string; color: string }> = {
  solution: { label: '단서', color: 'var(--g-confirm)' },
  redherring: { label: '무관', color: 'var(--status-progress)' },
  exclusion: { label: '배제', color: 'var(--accent)' },
  empty: { label: '없음', color: 'var(--fg-4)' },
}

export const kindOf = (a: Action) => RESULT_KIND[a.yield] ?? RESULT_KIND.empty

/**
 * 이 조사가 손에 쥐어주는 확보 단어. 원본 `TERM_MAP[action + ':' + key]`(2012행).
 *
 * 원본은 조사→단어 표를 따로 들고 있지만 엔진은 `gives`(물증) → `yieldsTerms`
 * 로 이어져 있다. **표를 새로 만들지 않는다** — 그것이 곧 두 번째 정본이 된다.
 */
export function termsOf(c: Case, a: Action): string[] {
  return a.gives.flatMap((id) => c.evidence.find((e) => e.id === id)?.yieldsTerms ?? [])
}
