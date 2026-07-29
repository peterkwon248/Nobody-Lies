import { loadCaseFile } from './load-case.js'
import { verify } from './verifier.js'
import { claimGrid, tellsTruth, trueLocationAt } from './deriver.js'
import type { RunOptions } from './orchestrate.js'

// tsx src/cli.ts [--case <경로>]                사건 하나 검증
// tsx src/cli.ts --generate <N>                N건 생성 → 검증 → 요약
//                [--palette <p.json>]          LLM이 채운 세계 팔레트
//                [--want normal,hard]          목표 난이도 (선호 순서)
//                [--emit <디렉터리>]            통과분을 <id>.json 으로 방출
//                [--emit <디렉터리> --yaml]     저작 가능한 <id>.yaml 로 방출 (왕복 대조)
//                [--min-pass <퍼센트>]          통과율 미달이면 exit 1 (게이트용)
const genFlag = process.argv.indexOf('--generate')
if (genFlag >= 0) {
  const { run, report } = await import('./orchestrate.js')
  const arg = (name: string) => {
    const i = process.argv.indexOf(name)
    return i >= 0 ? process.argv[i + 1] : undefined
  }

  // 팔레트는 **어휘만** 담는다. 논리는 코드가 만든다 — generate.ts §Palette 참조
  let palette
  const palettePath = arg('--palette')
  if (palettePath) {
    const { readFileSync } = await import('node:fs')
    try {
      palette = JSON.parse(readFileSync(palettePath, 'utf8'))
    } catch (e) {
      console.error(`\n  팔레트를 읽을 수 없다: ${palettePath}\n  ${(e as Error).message}\n`)
      process.exit(1)
    }
  }

  const want = arg('--want')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) as RunOptions['want']

  const chaptersArg = Number(arg('--chapters') ?? NaN)
  const chapters = Number.isNaN(chaptersArg) ? undefined : chaptersArg

  const n = Number(process.argv[genFlag + 1] ?? 50)
  const seeds = Array.from({ length: n }, (_, i) => i + 1)
  console.log('')
  if (palettePath) console.log(`  팔레트  ${palettePath}\n`)
  const batch = run(seeds, { palette, want, chapters })
  console.log(report(batch))
  console.log('')

  /**
   * 통과분 방출. **검증을 통과하지 못한 사건은 방출하지 않는다** —
   * `run()` 이 통과분만 돌려주므로 `export-case.ts` 와 같은 규약이다.
   *
   * 앱이 `/cases/<id>.json` 을 읽으므로 파일명이 곧 `?case=` 값이다.
   */
  const emitDir = arg('--emit')
  if (emitDir) {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    mkdirSync(emitDir, { recursive: true })
    const asYaml = process.argv.includes('--yaml')

    if (!asYaml) {
      for (const p of batch.passed) {
        writeFileSync(`${emitDir}/${p.case.id}.json`, JSON.stringify(p.case, null, 2), 'utf8')
      }
      console.log(`  ${batch.passed.length}건 방출 → ${emitDir}/<id>.json`)
      // 해시가 정본이다 — 쿼리도 아직 읽지만, 파일로 연 앱에서는 해시만 산다
      console.log(`  앱에서 열기: /#case=${batch.passed[0]?.case.id ?? '<id>'}\n`)
    } else {
      /**
       * 저작 가능한 YAML 로 방출한다. **산문을 입히는 순간 생성물이 아니라
       * 저작물**이라 사람이 고치고 git 이 추적하는 형태여야 한다.
       *
       * ★ 왕복으로 검증한다 ★ 쓴 파일을 다시 읽어 원본 `Case` 와 대조한다.
       * 키 순서는 다를 수 있으므로 재귀로 정렬해 비교한다. 한 건이라도
       * 어긋나면 방출을 실패로 본다 — **조용히 다른 사건이 되는 것**이 이
       * 저장소에서 가장 비싼 결함이었다(2026-07-24 엔진↔프로토타입 14곳).
       */
      const { dump, load } = await import('js-yaml')
      const { caseToRaw } = await import('./to-yaml.js')
      const { parseCase } = await import('./schema.js')

      const stable = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(stable)
        if (v && typeof v === 'object') {
          return Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, stable(x)]),
          )
        }
        return v
      }

      const broken: string[] = []
      for (const p of batch.passed) {
        const text = dump(caseToRaw(p.case), { lineWidth: 110, noRefs: true })
        const path = `${emitDir}/${p.case.id}.yaml`
        writeFileSync(path, text, 'utf8')
        try {
          const back = parseCase(load(text), path)
          if (JSON.stringify(stable(back)) !== JSON.stringify(stable(p.case))) broken.push(p.case.id)
        } catch (e) {
          broken.push(`${p.case.id}\n${(e as Error).message.split('\n').slice(1).join('\n')}`)
        }
      }

      console.log(`  ${batch.passed.length}건 방출 → ${emitDir}/<id>.yaml`)
      if (broken.length) {
        console.error(`\n  ✗ 왕복 대조 실패 ${broken.length}건 — 쓴 것과 읽은 것이 다르다`)
        broken.forEach((b) => console.error(`   x ${b}`))
        console.error('')
        process.exit(1)
      }
      console.log('  ✓ 왕복 대조 — 다시 읽은 사건이 원본과 같다')
      console.log(`  이어서: PROSE-BRIEF.md 로 산문을 받아 채운 뒤 engine/cases/ 로 옮긴다\n`)
    }
  }

  /**
   * `--min-pass` 가 없으면 항상 0으로 끝난다(탐색용).
   *
   * ★ 빌드 게이트는 이 플래그로 건다 ★ 2026-07-28 에 §9-8e 가 생기면서
   * 생성기가 통과율 0% 로 죽었는데 **게이트가 계속 초록이었다** — `--generate`
   * 가 게이트에 없었고, 있었더라도 종료 코드가 늘 0이라 못 막았다.
   * 검증기에 검사를 더하면 사건 파일만이 아니라 생성기도 같이 무너진다.
   */
  const minPass = Number(arg('--min-pass') ?? NaN)
  if (!Number.isNaN(minPass)) {
    const rate = (batch.passed.length / batch.tried) * 100
    if (rate < minPass) {
      console.error(`  통과율 ${rate.toFixed(0)}% < 요구 ${minPass}% — 생성기가 깨졌다\n`)
      process.exit(1)
    }
  }
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
