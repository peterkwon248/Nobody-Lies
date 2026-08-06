/**
 * ─────────────────────────────────────────────────────────────
 *  파생 필드 방출 — 사건이 나가는 **모든** 문이 여기를 지난다 (2026-08-06)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 한 곳인가
 *
 * 사건이 앱으로 나가는 문이 **둘**이다:
 *
 * ```
 * export-case.ts   저작 사건 (engine/cases/*.yaml → app/public/cases/*.json)
 * cli.ts --emit    생성 사건 (--generate N --emit <dir>)
 * ```
 *
 * ⛔ **첫 판에서 `export-case` 만 고쳤고 `--emit` 을 잊었다.** 그래서 생성 사건은
 * `_proof`·`_epilogue` 가 없어 해설 화면이 통째로 비었을 것이다. 이 저장소가
 * **하루에 세 번** 밟은 §one-value-two-places 다. `cand-check §3` 이 같은 날 잡았고,
 * 잡히자마자 **값을 한 곳으로 모았다** — 다음 문이 생겨도 이 함수를 부르면 된다.
 *
 * ## `_` 접두 규약
 *
 * 「앱이 표시용으로 받는 것이지 사건이 아니다」. `caseYaml` 왕복 대조가 `_` 키를
 * 걷어내므로 내보내기가 안 깨진다. **저작 필드가 아니므로 §다섯 곳 한 벌의 대상이
 * 아니다** — 매 방출마다 다시 계산되고, 빠지면 `cand-check §3` 이 운다.
 */
import type { Case } from './types.js'
import { proveBlanks } from './proof.js'
import { buildEpilogue } from './epilogue.js'

/**
 * 증명 사슬 중 **화면이 읽는 것만** 남긴다.
 *
 * `candidates` 배열은 앱이 안 쓰는데 사건당 수 KB 다. 실측으로 `_proof` 는
 * 2.0~4.5KB 에 든다(전체 20~38KB 대비).
 */
function trimProof(c: Case) {
  return proveBlanks(c).map((p) => ({
    chapter: p.chapter,
    label: p.label,
    answerLabel: p.answerLabel,
    unique: p.unique,
    cost: p.cost,
    steps: p.steps.map((s) => ({
      observation: s.observation,
      cost: s.cost,
      rule: s.rule,
      eliminates: s.eliminates,
      remaining: s.remaining,
    })),
  }))
}

/**
 * `verify()` 결과 중 **이 함수가 쓰는 두 칸만** 받는다.
 * `VerifyResult` 는 `verifier.ts` 가 내보내지 않는 지역 타입이라 구조로 적는다 —
 * 내보내려고 그 파일을 건드리는 것보다 요구를 좁히는 쪽이 싸다.
 */
type Judgement = { difficulty: string; minActions: number }

export function emitDerived(c: Case, r: Judgement) {
  return {
    ...c,
    _difficulty: r.difficulty,
    _oracle: r.minActions,
    _proof: trimProof(c),
    _epilogue: buildEpilogue(c),
  }
}
