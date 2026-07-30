/**
 * `package-lock.json` 의 `"peer": true` 표시를 제자리에 되살린다.
 *
 * ```
 * node scripts/lock-peer-restore.mjs
 * ```
 *
 * **왜 있나.** `npm install`·`npm uninstall` 이 npm 버전 차이 때문에 몇몇 패키지의
 * `"peer": true` 줄만 지운다. 의존성 변화가 아니라 **표기 차분**이다. 세 기계·새
 * 클론에서 재현했고(2026-07-28), 안 되돌리면 세션 내내 트리가 더러워 보여
 * **무엇이 내 변경인지 흐려진다.**
 *
 * 지금까지는 `git checkout -- package-lock.json` 으로 통째로 되돌렸다. 그런데
 * **진짜 의존성을 추가하는 세션에서는 그 방법을 못 쓴다** — 되돌리면 방금 넣은
 * 패키지가 같이 날아간다(2026-07-31에 실제로 막혔다). 그래서 **그 줄만** 되살린다.
 *
 * ⚠ **JSON 으로 파싱해서 다시 쓰면 안 된다.** 키가 객체 끝으로 밀려 **원래와 다른
 * 차분**이 된다. 줄 단위로 다룬다.
 *
 * ⚠ **블록 끝은 들여쓰기로 잡는다.** 패키지 블록 안에 `bin`·`dependencies` 같은
 * 중첩 객체가 있어서 첫 `},` 로 끊으면 `browserslist` 처럼 놓친다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const LOCK = 'package-lock.json'

/** 기준은 HEAD 의 락파일이다 — 거기 있던 표시를 되살리는 것이 전부다 */
const head = execFileSync('git', ['show', `HEAD:${LOCK}`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}).split('\n')
let cur = readFileSync(LOCK, 'utf8').split('\n')

/** HEAD 에서 peer 표시를 갖고 있던 패키지 전부 */
const lost = []
{
  const H = JSON.parse(head.join('\n')).packages ?? {}
  const N = JSON.parse(cur.join('\n')).packages ?? {}
  for (const k of Object.keys(H))
    if (H[k].peer === true && N[k] && N[k].peer !== true) lost.push(k.replace(/^node_modules\//, ''))
}

if (!lost.length) {
  console.log('✓ peer 표시가 지워진 것이 없다')
  process.exit(0)
}

const start = (L, p) => L.findIndex((l) => l.trim() === `"node_modules/${p}": {`)
const end = (L, s) => {
  for (let i = s + 1; i < L.length; i++) if (L[i] === '    },' || L[i] === '    }') return i
  return L.length
}

let restored = 0
for (const pkg of lost) {
  const hs = start(head, pkg)
  if (hs < 0) { console.log(`  ? ${pkg} — HEAD 에서 블록을 못 찾았다`); continue }
  const he = end(head, hs)

  let pi = -1
  for (let i = hs + 1; i < he; i++) if (head[i].trim() === '"peer": true,') { pi = i; break }
  if (pi < 0) { console.log(`  ? ${pkg} — HEAD 블록에 peer 줄이 없다`); continue }

  const cs = start(cur, pkg)
  if (cs < 0) { console.log(`  ? ${pkg} — 현재 파일에 블록이 없다`); continue }
  const ce = end(cur, cs)

  // 앞줄이 같은 자리를 찾아 그 뒤에 끼운다 — 위치까지 원래대로여야 차분이 0 이 된다
  let at = -1
  for (let i = cs + 1; i < ce; i++) if (cur[i] === head[pi - 1]) at = i
  if (at < 0) { console.log(`  ? ${pkg} — 앞줄 '${head[pi - 1].trim()}' 을 못 찾았다`); continue }

  cur.splice(at + 1, 0, head[pi])
  restored++
  console.log(`  ✓ ${pkg}`)
}

writeFileSync(LOCK, cur.join('\n'), 'utf8')

// 되살린 뒤에도 JSON 이 성한지 본다 — 줄 단위로 다뤘으니 이건 공짜가 아니다
try {
  const n = Object.keys(JSON.parse(readFileSync(LOCK, 'utf8')).packages ?? {}).length
  console.log(`\n되살린 줄 ${restored}/${lost.length} · JSON 정상 (${n} 패키지)`)
} catch (e) {
  console.error(`\n✗ 되살린 뒤 JSON 이 깨졌다 — git checkout -- ${LOCK} 로 되돌려라\n${e.message}`)
  process.exit(1)
}
