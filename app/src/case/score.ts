import { DOMAIN_OF, type Case, type ScoreDomain } from '@engine/types'
import type { CaseProgress } from '../state/stores'

/**
 * 채점 — 원본 `buildResult()`(2217~2264행)의 계산 부분.
 *
 * **화면에서 뺐다.** 원본은 뷰모델 하나에 계산과 문구를 같이 담았는데, 그러면
 * 협동 모드에서 서버가 채점할 때 같은 계산이 두 벌 생긴다. 확보 단어를
 * `deriveTerms` 하나로 모은 것과 같은 이유다.
 *
 * 엔진이 아니라 앱에 있는 이유: 입력이 `CaseProgress` 다. 엔진은 사건 정의를
 * 알 뿐 **한 판의 진행을 모른다.** 서버 채점이 생기는 날 이 파일이 통째로
 * 엔진으로 간다 — 그때 옮길 수 있게 `Case` 와 답 말고는 아무것도 안 읽는다.
 *
 * ★ 채점은 여기서 처음 일어난다 ★ 게임은 최종 제출 전까지 정답에 대해
 * 완전히 침묵한다 (`HANDOFF-TO-CODE.md` §0.2). 이 함수를 보고서 화면에서
 * 부르면 그 침묵이 깨진다.
 */

/** 공란의 주소. 장 번호 + 그 장 안의 순번 */
export const blankKey = (chapterOrder: number, index: number) => `${chapterOrder}:${index}`

export type Correction = {
  /** 공란 라벨. 엔진의 `BlankLabel` 이 이미 한국어다 */
  label: string
  /** 내가 넣은 값. 안 넣었으면 `null` */
  mine: string | null
  right: string
}

export type Score = {
  /** 다섯 장을 다 완성했나. **정답 여부와 무관하다** */
  done: boolean
  /** 예산을 다 쓰고도 종결하지 못했나 */
  stuck: boolean
  correct: number
  total: number
  spent: number
  /** 범인 지목(`isAccusation`)이 맞았나. 결말 제목이 이 값으로 갈린다 */
  accused: boolean
  /** 물증·정황·심증 세 축. 지목 공란은 세지 않는다 (원본 2229행) */
  domains: { domain: ScoreDomain; correct: number; total: number }[]
  corrections: Correction[]
}

const DOMAINS: ScoreDomain[] = ['물증', '정황', '심증']

export function scoreCase(
  c: Case,
  progress: CaseProgress,
  /** 값 → 표시 이름. `sakura` 를 「문세라」로 읽는 건 화면의 어휘다 */
  labelOf: (value: string) => string,
): Score {
  const agg: Record<ScoreDomain, [number, number]> = { 물증: [0, 0], 정황: [0, 0], 심증: [0, 0] }
  const corrections: Correction[] = []
  let correct = 0
  let total = 0
  let accused = false

  for (const ch of c.chapters)
    ch.blanks.forEach((b, i) => {
      const mine = progress.answers[blankKey(ch.order, i)] || null
      const ok = mine === b.answer
      total++
      if (ok) correct++
      if (b.isAccusation) accused = ok
      // 지목은 세 축에서 뺀다 — 한 칸짜리 축이 생기면 막대가 0% 아니면 100% 다
      else {
        const d = DOMAIN_OF[b.label]
        agg[d][1]++
        if (ok) agg[d][0]++
      }
      if (!ok)
        corrections.push({
          label: b.label,
          mine: mine && labelOf(mine),
          right: labelOf(b.answer),
        })
    })

  const done = progress.solved.length === c.chapters.length
  return {
    done,
    stuck: !done && c.budget - progress.actionsUsed <= 0,
    correct,
    total,
    spent: progress.actionsUsed,
    accused,
    domains: DOMAINS.map((d) => ({ domain: d, correct: agg[d][0], total: agg[d][1] })),
    corrections,
  }
}
