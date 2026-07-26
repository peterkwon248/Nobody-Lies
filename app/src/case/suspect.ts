import type { Action, Case, Fact, PersonId } from '@engine/types'
import type { CaseProgress } from '../state/stores'
import { ko } from './loadCase'

/**
 * 용의자 한 사람에 대해 **지금까지 드러난 것**.
 *
 * 카드(`Suspects`)와 상세 모달(`SuspectDetail`)이 같은 값을 본다. 원본은
 * `buildProfiles()`(1873행) 하나가 둘 다 먹였고, 그래야 한다 — 카드와 모달이
 * 각자 계산하면 「카드엔 단서 2개, 모달엔 3개」가 되고 아무도 못 잡는다.
 *
 * ★ 여기서 유죄를 판정하지 않는다 ★ 슬롯은 **조사로 확보한 사실의 내용**만
 * 담는다. 무료 사실(`revealedBy` 가 빈 것 = 진술에서 이미 읽은 것)을 넣으면
 * 조사 0회에 한 사람만 두 칸이 차서 그게 곧 범인 표시가 된다.
 */

export type Clue = {
  text: string
  /** 어느 조사에서 나왔나. 표시용 이름 */
  action: string
  /** 「출처 보기」가 뛰어갈 곳 */
  actionId: string
}

export type Slot = {
  label: string
  kind: Fact['kind']
  /** 못 얻었으면 `null` — 점선 + 「미확인」 */
  fact: Fact | null
  actionId: string | null
}

export type Narration = {
  actionId: string
  title: string
  body: string
  /** 조사 이름 */
  label: string
  /** 유형 색. **결과의 종류이지 유용도가 아니다** */
  color: string
}

export const SLOT_KINDS: { label: string; kind: Fact['kind'] }[] = [
  { label: '동기', kind: 'motive' },
  { label: '기회', kind: 'opportunity' },
  { label: '수단', kind: 'means' },
]

/** 조사 기록과 같은 색표 (`InvestigationLog`) */
const YIELD_COLOR: Record<string, string> = {
  solution: 'var(--g-confirm)',
  redherring: 'var(--status-progress)',
  exclusion: 'var(--accent)',
  empty: 'var(--fg-4)',
}

/** 수행한 조사만. 안 한 조사는 존재를 알려서도 안 된다 */
const performed = (c: Case, progress: CaseProgress): Action[] =>
  progress.investigations
    .map((iv) => c.actions.find((a) => a.id === iv.actionId))
    .filter((a): a is Action => !!a)

export function suspectView(
  c: Case,
  progress: CaseProgress,
  /** 확보한 사실. 엔진 `deriveFacts` 의 결과 */
  facts: Set<string>,
  pid: PersonId,
): { clues: Clue[]; slots: Slot[]; narrations: Narration[] } {
  const done = performed(c, progress)

  const clues: Clue[] = done
    .filter((a) => a.target?.kind === 'person' && a.target.id === pid)
    .flatMap((a) =>
      a.gives
        .map((id) => c.evidence.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => !!e)
        .map((e) => ({ text: e.description, action: a.label, actionId: a.id })),
    )

  const slots: Slot[] = SLOT_KINDS.map((s) => {
    const fact = c.facts.find(
      (x) => x.kind === s.kind && x.subject === pid
        && x.revealedBy.length > 0 && facts.has(x.id),
    ) ?? null
    // 이 사실을 연 조사. 물증 id 로 역참조한다 (`Fact.revealedBy` 는 물증이다)
    const from = fact
      ? done.find((a) => a.gives.some((e) => fact.revealedBy.includes(e)))
      : undefined
    return { ...s, fact, actionId: from?.id ?? null }
  })

  const narrations: Narration[] = done
    .filter((a) => a.target?.kind === 'person' && a.target.id === pid && a.result)
    .map((a) => ({
      actionId: a.id,
      title: ko(a.result?.title),
      body: ko(a.result?.body),
      label: a.label,
      color: YIELD_COLOR[a.yield] ?? YIELD_COLOR.empty,
    }))

  return { clues, slots, narrations }
}
