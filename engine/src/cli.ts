import { mountainLodge } from './cases/mountain-lodge.js'
import { verify } from './verifier.js'

const c = mountainLodge
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

console.log(`\n  난이도  ${r.difficulty}`)
console.log(`  검증    ${r.ok ? '통과' : '실패'}`)
if (r.errors.length) { console.log('\n  오류'); r.errors.forEach((e) => console.log(`   x ${e}`)) }
if (r.warnings.length) { console.log('\n  경고'); r.warnings.forEach((x) => console.log(`   ! ${x}`)) }
console.log('')

// 검증 실패는 종료 코드로 알린다. after-work 가 이것을 커밋 게이트로 쓴다.
if (!r.ok) process.exit(1)
