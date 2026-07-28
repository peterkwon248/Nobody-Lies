#!/usr/bin/env node
/**
 * 이식 대조기 — 프로토타입과 앱의 **분기·반복 집합**을 맞춰본다.
 *
 * ## 무엇이 바뀌었나 (2026-07-26)
 *
 * 예전 판은 원본에서 분기를 뽑아 **장부**(`docs/port-ledger.json`)와 대조했다.
 * 앱을 손으로 옮기던 시절엔 이름이 달라져서(`l.clues` ↔ `cluesAt`) 기계가
 * 판정할 수 없었고, 옮겼는지는 사람이 장부에 적어야 했다.
 *
 * **앱이 DC React export 로 바뀌면서 그 전제가 사라졌다.** 기계 변환은 이름을
 * 그대로 쓰므로 두 집합을 직접 비교할 수 있다 — 장부도, 사람의 판정도 없다.
 * 전환 시점에 308 대 308 로 완전히 일치했다.
 *
 * ## 그래서 이게 잡아주는 것
 *
 *   · **재export 가 분기를 빠뜨렸다** — 앱에만 없다
 *   · **재export 가 옛 마스터에서 왔다** — 프로토타입에 없는 분기가 앱에 있다
 *   · **프로토타입 파일만 갱신되고 앱이 안 따라왔다** (또는 그 반대)
 *
 * ## 못 잡는 것 — 이게 중요하다
 *
 * **갈래가 있느냐까지만 본다.** 같은 조건에서 뜨는지, 화면이 원본처럼 보이는지는
 * 재지 못한다. 2026-07-26 에 보고서 장 머리글이 정확히 그렇게 빠져나갔다 —
 * 두 갈래가 다 있는데 조건이 뒤바뀌어 있었다. **초록불은 「덜 옮기지 않았다」는
 * 뜻이지 「맞게 옮겼다」는 뜻이 아니다.**
 *
 * 사용:
 *   node scripts/port-check.mjs           대조. 어긋나면 exit 1
 *   node scripts/port-check.mjs --list    양쪽 목록 출력
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROTO = join(ROOT, 'prototype', '추리게임.dc.html')
const APP = join(ROOT, 'app', 'src', 'App.jsx')

/** 원본 템플릿의 분기(`sc-if`)와 반복(`sc-for`) */
function fromPrototype(src) {
  const out = new Set()
  for (const m of src.matchAll(/sc-if value="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  for (const m of src.matchAll(/sc-for list="\{\{\s*([\w.]+)\s*\}\}"/g)) out.add(m[1])
  return out
}

/**
 * 변환된 JSX 의 같은 자리.
 *
 * `sc-if`  → `{(V.x)?(<>…</>):null}`
 * `sc-for` → `arr(V.x).map((it,$index)=>…)`
 *
 * `V.` 접두사는 `renderVals()` 가 돌려준 객체를 가리키는 것뿐이라 떼고 비교한다.
 */
function fromApp(src) {
  const out = new Set()
  for (const m of src.matchAll(/\{\((?:V\.)?([A-Za-z_][\w.]*)\)\?/g)) out.add(m[1])
  for (const m of src.matchAll(/arr\((?:V\.)?([A-Za-z_][\w.]*)\)\.map/g)) out.add(m[1])
  return out
}

/**
 * 앱 전용 — 프로토타입에 없어도 되는 분기.
 *
 * 2026-07-27에 `App.jsx` 가 정본이 되고 export 가 동결됐다. 그 뒤로 새로 짓는
 * 기능은 프로토타입에 없다 — 그건 어긋남이 아니다. **여기 적힌 것만** 예외로 두고
 * 나머지 `extra` 는 계속 실패로 본다(옛 마스터에서 온 export 를 잡는 장치가 그것이다).
 *
 * ★ 여기 적는 것은 「프로토타입에 없는 새 기능이다」라는 선언이다. ★
 *   이식된 화면을 고치다 생긴 어긋남을 여기 적어 넘기면 **대조기가 죽는다.**
 *   적을 때 무엇을 새로 지었는지 한 줄로 남긴다.
 *
 * 렌더를 메서드로 추출할 때는 **인자 이름을 `V` 로 유지한다** — 위 정규식이
 * `V.` 접두사를 떼고 이름만 보므로, `renderPlan(F)` 로 바꾸면 `floor.hasNarr` 가
 * `F.hasNarr` 로 보이면서 있던 갈래가 사라진 것처럼 잡힌다.
 *
 * ⚠ **이 대조기는 주석과 코드를 가리지 않는다.** 파일 전체를 정규식으로 훑는다.
 *   `App.jsx` 주석에 위 두 패턴을 예시로 적었다가 이름 하나가 늘어 대조가 깨졌다
 *   (2026-07-27). 패턴을 문서에 적을 일이 있으면 **말로 쓴다.**
 */
const APP_ONLY = new Set([
  // 새 기능을 지을 때 **그 커밋에서** 여기 이름을 더한다 — 미리 적어두면
  // 아래 `staleAllow` 가 잡는다(그게 이 목록이 안 썩는 이유다)

  // 상황판이 탭 여럿이 됐다 (2026-07-27) — 탭마다 바닥 도면 하나(평면도·도식·
  // 관계도)를 깔고 그 위에 서랍의 카드를 올린다. 도면은 현장·관계도 화면과 **같은
  // 메서드**를 부르므로 공개 게이트가 그대로 따라온다
  'pb.boards', 'b.backdropMark', 'b.showDel',
  'pb.backdrop.show', 'pb.backdrop.needsTimes', 'pb.backdrop.isPlan', 'pb.backdrop.isGrid', 'pb.backdrop.isGraph',

  // 홈 목록에서 만든 사건을 지운다 (2026-07-29) — 캠페인 생성기가 생기기 전에는
  // 지울 것이 없었다. `canDel` 은 만든 사건 행에만 달리고(앱 제공 사건은 안 달린다),
  // `confirmDel` 은 그 행이 「지울까?」를 묻는 동안의 갈래다
  'c.canDel', 'c.confirmDel',
])

const P = fromPrototype(readFileSync(PROTO, 'utf8'))
const A = fromApp(readFileSync(APP, 'utf8'))

const missing = [...P].filter((x) => !A.has(x)).sort()   // 앱이 빠뜨렸다
const newFeat = [...A].filter((x) => !P.has(x) && APP_ONLY.has(x)).sort()      // 새로 지은 것
const extra = [...A].filter((x) => !P.has(x) && !APP_ONLY.has(x)).sort()       // 설명 안 되는 것
// 적어뒀는데 실제로 없는 이름 — 기능을 지웠거나 이름을 바꿨다. 목록이 썩는 것을 막는다
const staleAllow = [...APP_ONLY].filter((x) => !A.has(x)).sort()

if (process.argv.includes('--list')) {
  console.log(`\n프로토타입 (${P.size})\n  ${[...P].sort().join(' ')}`)
  console.log(`\n앱 (${A.size})\n  ${[...A].sort().join(' ')}`)
  process.exit(0)
}

const say = (title, arr, hint) => {
  if (!arr.length) return
  console.log(`\n${title} (${arr.length})\n  ${hint}`)
  for (const x of arr) console.log(`    ${x}`)
}

say('❗ 앱에 없다', missing, '재export 가 빠뜨렸거나, 프로토타입만 갱신됐다')
say('❗ 프로토타입에 없다', extra, '앱이 옛 마스터에서 왔거나, 앱만 갱신됐다')
say('❗ 앱 전용 목록이 낡았다', staleAllow, 'APP_ONLY 에 적혀 있는데 앱에 없다 — 지웠거나 이름이 바뀌었다')
say('· 앱 전용 (프로토타입에 없는 새 기능)', newFeat, 'APP_ONLY 에 선언됨 — 어긋남으로 세지 않는다')

const ok = !missing.length && !extra.length && !staleAllow.length
console.log(
  `\n${ok ? '✓' : '✗'} 프로토타입 ${P.size} · 앱 ${A.size} · `
  + `공통 ${[...P].filter((x) => A.has(x)).length} · 앱 전용 ${newFeat.length} · `
  + `어긋남 ${missing.length + extra.length + staleAllow.length}`,
)
if (ok) console.log('  (갈래가 있느냐까지만 본다 — 같은 조건에서 뜨는지는 눈으로 본다)')
process.exit(ok ? 0 : 1)
