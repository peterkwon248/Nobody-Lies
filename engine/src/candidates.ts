/**
 * ─────────────────────────────────────────────────────────────
 *  후보 감사 — 테스터에게 내보낼 «생성 사건»을 고른다 (2026-08-06 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 있나
 *
 * 테스터 전찬웅이 커밋된 사건 넷을 전부 풀었다. **답을 아는 사람은 그 사건에
 * 대해 재사용이 안 된다** — 「고쳐졌나」는 판정할 수 있어도 「풀리나」는 못 잰다.
 * 새 사건이 필요하고, 생성기는 **바로 그 용도**로 지어졌다(`MANIFESTO §사건이
 * 생기는 길은 셋이다` — ②는 유저용이고 이것이 그 첫 실사용이다).
 *
 * ## 무엇을 재나
 *
 * ```
 * 배제 축 1  트릭      테스터가 이미 본 트릭이면 「처음부터」가 아니다
 * 배제 축 2  동기 맛    소문·분배금·채무·반감을 또 만나면 세계가 같아 보인다
 * 고르는 축  난이도     오라클(하한) · 탐욕(상한) · 예산 · 여유
 *            갈래      1막이 어떤 비트 조합으로 나오나 (희귀 갈래가 값지다)
 * ```
 *
 * ⛳ **궁합표를 하드코딩하지 않는다.** 「이 팔레트엔 이 트릭」 같은 목록은 낡고,
 * 낡은 목록은 낡은 줄 모른다. 대신 **후보를 넓게 뽑고 검증기가 거르게** 둔다 —
 * 이 저장소가 `PORT-AUDIT` 표·`NEXT-ACTION` 4단계 표에서 반복해 데인 부류다.
 *
 * ## ⛔ 이 도구는 고르지 않는다
 *
 * 표를 인쇄할 뿐이고 **선택은 사람이 한다**. 자동으로 고르면 그 기준이 또 하나의
 * 낡을 목록이 된다.
 */
import { readFileSync } from 'node:fs'
import { run } from './orchestrate.js'
import { buildEpilogue } from './epilogue.js'
import type { Case } from './types.js'

const ko = (x: unknown): string =>
  typeof x === 'string' ? x : ((x as { ko?: string } | undefined)?.ko ?? '')

/** 테스터가 이미 본 트릭 — 커밋된 사건 넷의 `trick.types` 합집합 */
const SEEN_TRICKS = new Set(['staged_suicide', 'locked_room', 'alibi_fabrication'])
/** 테스터가 이미 본 동기 — 커밋된 사건 넷의 `f_motive.content` */
const SEEN_MOTIVES = ['퍼진 소문', '분배금', '채무', '쌓인 반감']

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const n = Number(arg('-n') ?? 25)
const paletteArg = arg('--palettes') ?? 'default,templates/palette-museum.json,templates/palette-example.json,templates/palette-residency.json'
const paletteNames = paletteArg.split(',').map((s) => s.trim()).filter(Boolean)

type Row = {
  palette: string
  seed: number
  id: string
  title: string
  tricks: string[]
  motive: string
  difficulty: string
  oracle: number
  greedy: number
  typical: number
  budget: number
  kinds: string[]
  exit: 'none' | 'noslot' | 'slot'
  illusions: number
}

const rows: Row[] = []
const rejectTotals = new Map<string, number>()

for (const p of paletteNames) {
  const palette = p === 'default' ? undefined : JSON.parse(readFileSync(p, 'utf8'))
  const seeds = Array.from({ length: n }, (_, i) => i + 1)
  const batch = run(seeds, { palette })
  for (const [k, v] of batch.rejections) rejectTotals.set(k, (rejectTotals.get(k) ?? 0) + v)

  for (const j of batch.passed) {
    const c = j.case as Case
    const r = j.result
    const ep = buildEpilogue(c)
    const motiveFact = (c.facts ?? []).find((f) => f.kind === 'motive' && f.subject === c.culprit)
    rows.push({
      palette: p === 'default' ? '(기본)' : p.replace(/^templates\/palette-|\.json$/g, ''),
      seed: j.seed,
      id: c.id,
      title: ko(c.title),
      tricks: [...(c.trick?.types ?? [])],
      motive: ko(motiveFact?.content),
      difficulty: r.difficulty,
      oracle: r.minActions,
      greedy: r.band[1],
      typical: r.typicalActions,
      budget: c.budget,
      kinds: [...new Set(ep.act1.lines.map((l) => l.kind))],
      /**
       * 퇴장. **세 갈래로 가른다** — 첫 판에서 「exit.method 있는데 slot 없음」이라
       * 인쇄했는데 **퇴장이 아예 없는 사건까지 같이 세고 있었다.** 합계는 같아도
       * 뜻이 전혀 다르다(없는 것 vs 반쪽인 것). 이 저장소의 오계수 부류다.
       */
      exit: (!c.trick?.exit ? 'none' : c.trick.exit.slot ? 'slot' : 'noslot') as Row['exit'],
      illusions: (c.trick?.illusions ?? []).length,
    })
  }
}

const seenTrick = (r: Row) => r.tricks.some((t) => SEEN_TRICKS.has(t))
const seenMotive = (r: Row) => SEEN_MOTIVES.some((m) => r.motive.includes(m))
const fresh = rows.filter((r) => !seenTrick(r) && !seenMotive(r))

const w = (s: string, k: number) => (s.length >= k ? s : s + ' '.repeat(k - s.length))

console.log(`\n  후보 감사 — 팔레트 ${paletteNames.length} × 씨앗 ${n} = 시도 ${paletteNames.length * n}`)
console.log(`  통과 ${rows.length} · 트릭 겹침 배제 ${rows.filter(seenTrick).length}` +
  ` · 동기 겹침 배제 ${rows.filter((r) => !seenTrick(r) && seenMotive(r)).length}` +
  ` · **남은 후보 ${fresh.length}**\n`)

console.log('  기각 사유 (생성기를 고칠 곳)')
const rej = [...rejectTotals.entries()].sort((a, b) => b[1] - a[1])
if (!rej.length) console.log('    없음')
for (const [k, v] of rej.slice(0, 8)) console.log(`    ${String(v).padStart(4)}  ${k}`)

console.log('\n  트릭 분포 (통과분 전체)')
const byTrick = new Map<string, number>()
for (const r of rows) for (const t of r.tricks) byTrick.set(t, (byTrick.get(t) ?? 0) + 1)
for (const [t, v] of [...byTrick.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`    ${w(t, 22)}${String(v).padStart(3)}${SEEN_TRICKS.has(t) ? '   ← 기지수' : ''}`)

/**
 * ★ **난이도 4열이 전 후보 동일하면 그것은 고르는 축이 아니다** ★
 * 먼저 분포를 인쇄하고, 분포가 하나뿐이면 표에서 접는다. 64줄에 같은 숫자를
 * 반복해 찍으면 **읽는 사람이 「골랐다」고 착각한다.**
 */
const profile = (r: Row) => `${r.oracle}/${r.typical}/${r.greedy}/${r.budget}`
const profiles = new Map<string, number>()
for (const r of rows) profiles.set(profile(r), (profiles.get(profile(r)) ?? 0) + 1)
console.log('\n  난이도 프로필 (오라클/기대/탐욕/예산) — 통과분 전체')
for (const [p, v] of [...profiles.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`    ${w(p, 16)}${String(v).padStart(4)}건`)

/** 후보를 **묶어서** 보인다 — 같은 (팔레트 · 트릭 · 동기)면 세계 어휘만 다르다 */
const groups = new Map<string, Row[]>()
for (const r of fresh) {
  const k = `${r.palette}|${r.tricks.join('+')}|${r.motive}`
  groups.set(k, [...(groups.get(k) ?? []), r])
}
console.log(`\n  남은 후보 ${fresh.length}건 → ${groups.size}묶음 (같은 팔레트·트릭·동기는 세계 어휘만 다르다)`)
console.log(`    ${w('묶음', 6)}${w('팔레트', 11)}${w('트릭', 20)}${w('동기', 15)}${w('건', 4)}${w('씨앗', 16)}갈래`)
console.log(`    ${'─'.repeat(104)}`)
let gi = 0
for (const [, rs] of groups) {
  const r = rs[0]!
  gi += 1
  const rare = r.kinds.filter((k) => k === 'sceneMoved' || k === 'murderMoved' || k === 'stagedBy')
  console.log(`    ${w(`#${gi}`, 6)}${w(r.palette, 11)}${w(r.tricks.join('+'), 20)}${w(r.motive, 15)}` +
    `${w(String(rs.length), 4)}${w(rs.map((x) => x.seed).slice(0, 4).join(','), 16)}${rare.join(' ') || '-'}`)
}

/**
 * ⚠ **구조 결손 집계** — 고르기와 별개로, 통과분 전체에서 「있어야 하는데 빈」 자리를
 * 센다. 여기 수가 크면 고를 문제가 아니라 **생성기를 고칠 문제**다.
 *
 * ⛳ **합계로 세지 않는다.** 「퇴장 없음」과 「퇴장은 있는데 시각이 없음」은 합치면
 * 같은 수인데 처방이 정반대다. 이 저장소가 오계수로 네 번 데인 자리다.
 */
console.log('\n  구조 결손 (통과분 전체)')
const exitN = (k: Row['exit']) => rows.filter((r) => r.exit === k).length
console.log(`    퇴장이 아예 없다                  ${exitN('none')} / ${rows.length}`)
console.log(`    퇴장은 있는데 exit.slot 이 없다     ${exitN('noslot')} / ${rows.length}`)
console.log(`    퇴장에 시각이 있다                 ${exitN('slot')} / ${rows.length}`)
console.log(`    인상 0개                         ${rows.filter((r) => r.illusions === 0).length} / ${rows.length}`)
console.log(`    1막에 stagedBy 없음               ${rows.filter((r) => !r.kinds.includes('stagedBy')).length} / ${rows.length}`)
console.log('')
