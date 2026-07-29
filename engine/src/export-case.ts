import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadCaseFile } from './load-case.js'
import { verify } from './verifier.js'

/**
 * 사건 YAML → 정적 JSON.
 *
 * `Case` 가 불변이라는 것이 이 프로젝트의 인프라 전략 전체를 결정한다
 * (`HANDOFF-TO-CODE.md` §1) — 사건 파일이 정적이므로 서버 없이 CDN 에 올려두면 되고
 * 협동 모드 전까지 서버가 거의 필요 없다. 이 스크립트가 그 첫 조각이다.
 *
 * **검증을 통과하지 못한 사건은 방출하지 않는다.** 앱이 논리적으로 성립하지 않는
 * 사건을 로드하는 일이 없어야 한다 — 빌드에서 막는 것이 런타임에 발견하는 것보다 싸다.
 *
 * tsx src/export-case.ts [입력.yaml] [출력.json]
 */

const input = process.argv[2] ?? 'cases/mountain-lodge.yaml'
const output = process.argv[3] ?? '../app/public/cases/mountain-lodge.json'

let c
try {
  c = loadCaseFile(input)
} catch (e) {
  console.error(`\n  ${(e as Error).message}\n`)
  process.exit(1)
}

const r = verify(c)
if (!r.ok) {
  console.error(`\n  ${input} — 검증 실패. 방출하지 않는다.`)
  r.errors.forEach((e) => console.error(`   x ${e}`))
  console.error('')
  process.exit(1)
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(c, null, 2), 'utf8')

const bytes = JSON.stringify(c).length
console.log(`  ${input} → ${output}  (${(bytes / 1024).toFixed(1)} KB · ${r.difficulty})`)
if (r.warnings.length) r.warnings.forEach((w) => console.log(`   ! ${w}`))
