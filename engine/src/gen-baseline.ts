/**
 * 생성 산출물 기준선 — 리팩터가 흘렸는지 diff 로 증명한다.
 *
 * ```
 * npm run gen-baseline -w engine -- save    # 손대기 전에 얼린다
 * npm run gen-baseline -w engine -- check   # 손댄 뒤 대조한다. 다르면 exit 1
 * ```
 *
 * **왜 있나.** `MEMORY.md` 가 *「감시 없이 리팩터하면 리팩터가 흘린다」* 를 기록해뒀고
 * (「변환기 자체가 틀린다」의 전례), 평면도 작업 때도 회귀 0 을 diff 로 증명했다.
 * 그런데 **그때마다 재는 코드를 새로 썼다.** 2026-07-31에 `generateCase` 1,951줄을
 * `buildWorld` + `buildGameLayer` 로 가를 때 또 필요해서, 이번엔 커밋한다 —
 * *「커밋되지 않은 것은 다음 기계에서 존재하지 않는다」* (`voice-check` 때 배운 것).
 *
 * ★ **게이트에 안 건다** ★ 기준선 파일이 없는 기계에서는 실패가 아니라 무의미하다.
 * 리팩터하는 사람이 손으로 부른다. `world-check` 와 같은 취급이다.
 *
 * ⚠ 산출물이 2MB 를 넘어 **기준선 파일은 gitignore** 다. 도구만 커밋한다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { run } from './orchestrate.js'

/**
 * ⚠ `new URL(...).pathname` 을 쓰면 안 된다 — 저장소 경로에 **공백이 있어서**
 * (`…/Nobody Lies/…`) `%20` 이 안 풀린 채 `fs` 로 가고 ENOENT 가 난다.
 * 재현했다(2026-07-31). `fileURLToPath` 가 그 디코딩까지 한다.
 */
const FILE = fileURLToPath(new URL('../.gen-baseline.json', import.meta.url))

/** 키 순서에 안 좌우되는 직렬화 */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => [k, stable(o[k])]),
    )
  }
  return v
}

/**
 * 씨앗 × 장 수 × 사망칸. `prop-check` 이 무작위로 훑는 공간을 **고정 격자로** 잡는다 —
 * 기준선은 재현 가능해야 하므로 무작위를 쓰면 안 된다.
 */
const MATRIX: { seed: number; chapters?: number; deathCells?: number }[] = []
for (let seed = 1; seed <= 40; seed++) MATRIX.push({ seed })
for (const chapters of [2, 3, 4, 6, 7, 8]) for (const seed of [1, 7, 23]) MATRIX.push({ seed, chapters })
for (const deathCells of [2, 3]) for (const seed of [1, 7, 23]) MATRIX.push({ seed, deathCells })

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const m of MATRIX) {
    const key = `s${m.seed}_c${m.chapters ?? 'd'}_d${m.deathCells ?? 'd'}`
    const batch = run([m.seed], { chapters: m.chapters, deathCells: m.deathCells })
    out[key] = batch.passed.length
      ? stable(batch.passed[0]!.case)
      : { __rejected: [...batch.rejections.keys()] }
  }
  return out
}

const mode = process.argv[2]
if (mode !== 'save' && mode !== 'check') {
  console.error('사용법: gen-baseline.ts save | check')
  process.exit(2)
}

const now = snapshot()

if (mode === 'save') {
  writeFileSync(FILE, JSON.stringify(now, null, 1), 'utf8')
  console.log(`\n  기준선 저장 — ${Object.keys(now).length}건\n  ${FILE}\n`)
  process.exit(0)
}

if (!existsSync(FILE)) {
  console.error(`\n  ✗ 기준선이 없다. 손대기 **전에** 다음을 돌렸어야 한다:\n`)
  console.error(`      npm run gen-baseline -w engine -- save\n`)
  process.exit(1)
}

const base = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, unknown>
const keys = [...new Set([...Object.keys(base), ...Object.keys(now)])]
const diff = keys.filter((k) => JSON.stringify(base[k]) !== JSON.stringify(now[k]))

if (!diff.length) {
  console.log(`\n  ✓ 회귀 0 — ${keys.length}건이 기준선과 완전히 같다\n`)
  process.exit(0)
}

console.log(`\n  ✗ 달라진 것 ${diff.length}/${keys.length}건\n`)
for (const k of diff.slice(0, 8)) {
  const a = (base[k] ?? {}) as Record<string, unknown>
  const b = (now[k] ?? {}) as Record<string, unknown>
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]))
  console.log(`   ${k} — 다른 필드: ${fields.join(' · ') || '(전체)'}`)
}
if (diff.length > 8) console.log(`   … 그 밖 ${diff.length - 8}건`)
console.log('')
process.exit(1)
