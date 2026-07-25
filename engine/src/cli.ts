import { loadCaseFile } from './schema.js'
import { verify } from './verifier.js'
import { claimGrid, tellsTruth, trueLocationAt } from './deriver.js'

// tsx src/cli.ts [--case <경로>]      사건 하나 검증
// tsx src/cli.ts --generate <N>      N건 생성 → 검증 → 요약
const genFlag = process.argv.indexOf('--generate')
if (genFlag >= 0) {
  const { run, report } = await import('./orchestrate.js')
  const n = Number(process.argv[genFlag + 1] ?? 50)
  const seeds = Array.from({ length: n }, (_, i) => i + 1)
  console.log('')
  console.log(report(run(seeds)))
  console.log('')
  process.exit(0)
}

const flag = process.argv.indexOf('--case')
const casePath = flag >= 0 ? process.argv[flag + 1] : 'cases/mountain-lodge.yaml'

let c
try {
  c = loadCaseFile(casePath)
} catch (e) {
  console.error(`\n  ${(e as Error).message}\n`)
  process.exit(1)
}
const r = verify(c)
const name = (id: string) => c.people.find((p) => p.id === id)?.name ?? id
const mk = (b: boolean) => (b ? 'O' : '-')
const w = (s: string, n: number) => {
  const len = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
  return s + ' '.repeat(Math.max(0, n - len))
}

console.log(`\n  ${c.title}  [${c.scale}]  예산 ${c.budget}  ·  ${c.chapters.length}장 ${r.totalBlanks}공란\n`)

console.log('  유죄 조건')
console.log('  ' + '-'.repeat(50))
console.log('  ' + w('인물', 20) + '동기   기회   수단   판정')
for (const g of r.guiltTable)
  console.log(`  ${w(name(g.person), 20)}${mk(g.motive)}      ${mk(g.opportunity)}      ${mk(g.means)}      ${g.guilty ? '유죄' : ''}`)

// 진술 격자 — presence 에서 도출된다. 범인만 진실과 다르게 말한다(★ = 거짓)
console.log('\n  진술 격자  (도출: 무고=진실 / 범인=거짓말)')
console.log('  ' + '-'.repeat(50))
{
  const locLabel = (id: string) => c.locations.find((l) => l.id === id)?.label ?? id
  console.log('  ' + w('인물', 24) + c.slots.map((s) => w(s.label, 12)).join(''))
  for (const p of c.people) {
    const grid = claimGrid(p)
    const cells = c.slots.map((s) => {
      const said = grid.find((g) => g.slot === s.id)?.location
      if (!said) return w('·', 12)
      const truth = trueLocationAt(p, s.id)
      const lie = !tellsTruth(p) && truth !== undefined && truth !== said
      return w(locLabel(said) + (lie ? ' ★' : ''), 12)
    })
    console.log(`  ${w(name(p.id) + (tellsTruth(p) ? '' : ' (범인)'), 24)}${cells.join('')}`)
  }
}

console.log('\n  장 구성')
console.log('  ' + '-'.repeat(50))
for (const s of c.chapters)
  console.log(`  ${s.order}장  ${w(s.title, 14)}공란 ${s.blanks.length}${s.reveals ? '   → 확인 시 공개 있음' : ''}`)

console.log('\n  경로')
console.log('  ' + '-'.repeat(50))
console.log(`  최단 (오라클)  ${r.minActions}회`)
console.log(`  기대           ${r.typicalActions}회   (밴드 ${r.band[0]}~${r.band[1]})`)
console.log('\n  단서 추종 진행')
r.typicalPath.forEach((p) => console.log(`    ${p.startsWith('—') ? p : '· ' + p}`))

console.log('\n  채점 부문')
console.log('  ' + '-'.repeat(50))
r.domains.forEach((d) => console.log(`  ${w(d.domain, 8)}공란 ${d.count}`))
console.log(`\n  조사 대상 ${c.actions.length}개 / 예산 ${c.budget} = ${r.actionRatio.toFixed(1)}배`)
console.log(`  공개 정보 ${c.reveals.length}건 · decoy 비율 ${(r.decoyRatio * 100).toFixed(0)}%`)

console.log('\n  핵심 단서 획득 경로')
r.keyFactRoutes.forEach((k) => console.log(`   ${k.routes >= 2 ? 'O' : 'x'} ${w(k.fact, 24)}${k.routes}개`))

const mCost = r.mandatoryActions.reduce((n, a) => n + a.cost, 0)
console.log(`\n  필수 조사  ${r.mandatoryActions.length}건 · 비용 ${mCost} / 예산 ${c.budget}`)
console.log('  ' + '-'.repeat(50))
if (!r.mandatoryActions.length) console.log('   없음 — 모든 답이 두 경로 이상')
r.mandatoryActions.forEach((a) => console.log(`   · ${w(a.label, 30)}${a.cost}`))

// 난이도는 기대 회차 하나로 판정한다. 그 모델이 거칠어 오라클 하한과 탐욕 상한을
// 나란히 찍는다 — 둘의 부호가 다르면 라벨을 믿지 말 것
console.log(`\n  난이도  ${r.difficulty}   (기대 ${r.typicalActions}회 기준)`)
console.log(
  `          오라클 ${r.minActions}회 → 여유 ${c.budget - r.minActions}` +
    ` · 탐욕 ${r.band[1]}회 → 여유 ${c.budget - r.band[1]}`,
)
console.log(`  검증    ${r.ok ? '통과' : '실패'}`)
if (r.errors.length) { console.log('\n  오류'); r.errors.forEach((e) => console.log(`   x ${e}`)) }
if (r.warnings.length) { console.log('\n  경고'); r.warnings.forEach((x) => console.log(`   ! ${x}`)) }
console.log('')

// 검증 실패는 종료 코드로 알린다. after-work 가 이것을 커밋 게이트로 쓴다.
if (!r.ok) process.exit(1)
