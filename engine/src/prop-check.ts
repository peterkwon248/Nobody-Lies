/**
 * 속성 검사 (property-based) — `npm run prop-check`
 *
 * **`gen-check` 와 무엇이 다른가.**
 * ```
 * gen-check   씨앗 1~40 · 옵션 기본값 고정        → 통과율만 센다
 * prop-check  씨앗 무작위 × 장 2~8 × 사망칸 1~3   → 옵션 공간을 밟는다
 *                                                 + YAML 왕복이 같은지도 본다
 * ```
 *
 * ★ **왜 fast-check 인가** ★ 실패했을 때 **최소 반례로 줄여준다**(shrinking).
 * 지금까지 이 저장소의 결함은 「어느 씨앗에서 터지는지」를 손으로 찾아야 했다.
 * 씨앗 847213 에서 터지면 fast-check 가 스스로 줄여 **「씨앗 3 · 장 2」** 같은
 * 최소 반례를 준다 — 재현이 곧 디버깅의 절반이다.
 *
 * §2 구현 우선순위를 지킨 자리다: 무작위 탐색·축소는 직접 구현(4번)할 것이 아니라
 * **검증된 오픈소스(2번)** 다. `fast-check` 는 MIT · 주간 1000만 내려받기 · dev 의존성이라
 * 앱 번들과 무관하다.
 *
 * ⚠ **경고는 실패로 세지 않는다.** `verify` 의 `ok` 는 오류만 본다 — 경고까지 물면
 * 산장조차 빨개지고, 그러면 검사가 거짓말이 된다.
 */
import fc from 'fast-check'
import { dump, load } from 'js-yaml'
import { run } from './orchestrate.js'
import { caseToRaw } from './to-yaml.js'
import { parseCase } from './schema.js'
import type { Case } from './types.js'

/** 키 순서에 좌우되지 않는 비교용 직렬화. `Generator.jsx` 의 왕복 대조와 같은 방식이다 */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, stable(o[k])]),
    )
  }
  return v
}

/** 생성 → YAML → 다시 읽기. `Generator.jsx:caseYaml` 과 같은 경로다 */
function roundTrip(c: Case): { same: boolean; err?: string } {
  try {
    const text = dump(caseToRaw(c), { lineWidth: 110, noRefs: true })
    const back = parseCase(load(text), `${c.id}.yaml`)
    return { same: JSON.stringify(stable(back)) === JSON.stringify(stable(c)) }
  } catch (e) {
    return { same: false, err: e instanceof Error ? e.message.split('\n').slice(0, 3).join(' / ') : String(e) }
  }
}

const runsArg = Number(process.argv[process.argv.indexOf('--runs') + 1])
const numRuns = Number.isFinite(runsArg) && runsArg > 0 ? runsArg : 50

const opts = fc.record({
  seed: fc.integer({ min: 1, max: 1_000_000 }),
  chapters: fc.integer({ min: 2, max: 8 }),
  deathCells: fc.integer({ min: 1, max: 3 }),
})

let checked = 0
const failures: string[] = []

try {
  fc.assert(
    fc.property(opts, ({ seed, chapters, deathCells }) => {
      checked++
      /**
       * ⚠ **`generateCase` 를 직접 부르면 안 된다** (2026-07-31에 여기서 한 번 틀렸다).
       * 예산은 생성기가 아니라 **실험자(`fit`)** 가 정한다 — 날것을 검증하면
       * *"최단 4회가 예산 3 초과"* 로 떨어지고, 그건 사건의 결함이 아니라
       * **내가 계약을 잘못 읽은 것**이다. 게이트가 쓰는 경로와 같은 것을 부른다.
       */
      const batch = run([seed], { chapters, deathCells })
      if (batch.passed.length !== 1) {
        failures.push(`통과분이 없다 — ${[...batch.rejections.keys()].slice(0, 2).join(' / ') || '사유 미기록'}`)
        return false
      }
      const c = batch.passed[0]!.case

      // 장 수가 요청대로 나왔나 (2~8 범위 안이면 그대로여야 한다)
      if (c.chapters.length !== chapters) {
        failures.push(`장 수가 어긋난다 — 요청 ${chapters} · 나온 것 ${c.chapters.length}`)
        return false
      }

      const rt = roundTrip(c)
      if (!rt.same) {
        failures.push(`YAML 왕복이 원본과 다르다${rt.err ? ` — ${rt.err}` : ''}`)
        return false
      }
      return true
    }),
    { numRuns, verbose: false },
  )
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log(`\n  ✗ 속성 검사 실패 (${checked}건 돌린 뒤)\n`)
  console.log(`  ${failures[failures.length - 1] ?? '(사유 없음)'}\n`)
  console.log('  ── fast-check 가 줄인 최소 반례 ──')
  console.log(
    msg
      .split('\n')
      .filter((l) => /Counterexample|shrunk|seed|Got error|path/i.test(l))
      .map((l) => `  ${l.trim()}`)
      .join('\n') || `  ${msg.split('\n').slice(0, 6).join('\n  ')}`,
  )
  process.exit(1)
}

console.log(
  `\n  속성 검사 ${numRuns}건 통과 — 씨앗 무작위 × 장 2~8 × 사망칸 1~3\n` +
    '    · 검증 오류 0    · 요청한 장 수대로 나온다    · YAML 왕복이 원본과 같다\n',
)
