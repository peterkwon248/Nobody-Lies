/**
 * ─────────────────────────────────────────────────────────────
 *  plan-check — **도면이 얼마나 다양한가를 센다** (2026-07-31 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * `npm run plan-check`  ·  `npm run plan-check -- 300`
 *
 * ★ 왜 있나 ★ 사용자가 *"현장 평면도가 다 비슷비슷하다"* 고 했을 때 답한 근거가
 * **20건을 손으로 재서 나온 숫자**였다(「건물 크기 19종 · 현장 크기 20종」).
 * 그 숫자는 문서에만 남고 **다시 잴 방법이 없었다.** 도면 다양성은 앞으로
 * ②현장 자리·③방 개수에서 계속 손댈 자리라 **재는 쪽을 코드로 만든다.**
 *
 * ⚠ **게이트에 걸지 않는다.** 기준치가 없어서 「몇 종이면 통과」를 말할 수 없고,
 * 그런 검사는 초록이어도 뜻이 없다 — `world-check`·`voice-check` 와 같은 자리다.
 *
 * ⚠ **예산은 실험자가 정한다.** `generateCase` 만 부르면 전건이 예산 오류로
 * 떨어진다(처음 그렇게 짰다가 「200/200 실패」를 봤다). 게이트의 `--generate` 와
 * 같은 길인 `orchestrate.run` 으로 간다.
 */
import { run } from './orchestrate.js'

type R = { x: number; y: number; w: number; h: number }

const N = Number(process.argv[2] ?? 200)
const batch = run(Array.from({ length: N }, (_, i) => i + 1))

const envSizes = new Set<string>()
const sceneSizes = new Set<string>()
const roomCounts = new Map<number, number>()
let withVoid = 0
let notch = 0
let courtyard = 0
/**
 * ★ 현장이 어디 앉는가 ★ (2026-07-31 — ②현장 자리 다양화를 위한 계측)
 *
 * `generate.ts` §현장이 어느 칸인가 는 **가장 큰 칸**을 쓴다(밀실이면 바깥벽에 덜
 * 닿은 칸 우선). 근거는 07-29의 *"도면을 열자마자 어디가 사건의 중심인지 보여야
 * 한다"* 다. **그 규칙이 자리를 얼마나 굳히는지**를 여기서 센다 — 크기 순위와
 * 봉투 안 3×3 위치.
 */
const sceneRank = new Map<number, number>()
const scenePos = new Map<string, number>()
const sceneExt = new Map<number, number>()
/**
 * ★ 가장 좁은 방 ★ (③방 개수를 늘리기 전에 반드시 보는 값)
 *
 * 방 이름은 좌상단에 **가로로** 그려진다. 07-29에 딸린 방 규칙을 「긴 쪽을
 * 가른다」로 썼더니 100건 최소 폭이 228 → **114** 로 떨어져 **이름이 한 글자씩
 * 세로로 깨졌다.** 딸린 방을 늘리면 그 자리로 다시 간다 — 그래서 여기서 센다.
 *
 * ⚠ **바닥은 `MIN_W`(150)가 아니라 130 이다** (2026-07-31 실측으로 확인).
 * `bar` 타일링의 기본 배분이 `[190, 150, 130, 130]` 이고 `jitter` 의 바닥은
 * `Math.min(min, 기본배분 최소)` 라 **150을 요구해도 130으로 내려앉는다.**
 * 그래서 지금도 300건 중 296건에 150 미만 방이 있다 — 결함이 아니라 **실제 계약이
 * 130** 이라는 뜻이다. 여기가 더 내려가는지를 본다.
 */
const FLOOR_W = 130
let minW = Number.POSITIVE_INFINITY
let minH = Number.POSITIVE_INFINITY
let minWAt = ''
let underFloor = 0

for (const { case: c } of batch.passed) {
  const fp = c.floorPlan
  if (!fp) continue
  const main = fp.buildings[0]
  if (!main) continue
  const rs = fp.rooms.filter((r) => (r.building ?? main.id) === main.id)
  envSizes.add(`${main.w}x${main.h}`)
  roomCounts.set(rs.length, (roomCounts.get(rs.length) ?? 0) + 1)
  for (const r of rs) {
    if (r.w < minW) { minW = r.w; minWAt = `${c.id}·${r.label}` }
    if (r.h < minH) minH = r.h
    if (r.w < FLOOR_W) underFloor++
  }
  const scene = fp.rooms.find((r) => r.scene)
  if (scene) {
    sceneSizes.add(`${scene.w}x${scene.h}`)
    // 크기 순위 — 1이면 「언제나 가장 큰 칸」이 그대로 성립한다는 뜻이다
    const rank = 1 + rs.filter((r: R) => r.w * r.h > scene.w * scene.h).length
    sceneRank.set(rank, (sceneRank.get(rank) ?? 0) + 1)
    // 봉투 안 3×3 — 자리가 몇 칸에 몰리나
    const col = Math.min(2, Math.floor(((scene.x + scene.w / 2 - main.x) / main.w) * 3))
    const row = Math.min(2, Math.floor(((scene.y + scene.h / 2 - main.y) / main.h) * 3))
    const key = `${['왼', '가운데', '오른'][col]}·${['위', '중', '아래'][row]}`
    scenePos.set(key, (scenePos.get(key) ?? 0) + 1)
    // 봉투 바깥벽에 몇 면이 닿나 — 밀실 트릭이 「덜 닿은 칸」을 선호한다
    const near = (a: number, b: number) => Math.abs(a - b) < 0.6
    const ext = [near(scene.x, main.x), near(scene.x + scene.w, main.x + main.w),
      near(scene.y, main.y), near(scene.y + scene.h, main.y + main.h)].filter(Boolean).length
    sceneExt.set(ext, (sceneExt.get(ext) ?? 0) + 1)
  }

  // 빈 자리 — 겹침이 0인 상태에서 면적 합이 봉투와 다르면 빈틈이다 (검증기 §9-3i ⓒ 와 같은 셈)
  const sum = rs.reduce((a: number, r: R) => a + r.w * r.h, 0)
  if (Math.abs(sum - main.w * main.h) <= 1) continue
  withVoid++
  /**
   * 봉투 변에 닿으면 **노치**(ㄱ자), 안쪽에 갇혔으면 **중정**.
   * 빈 자리를 격자로 훑는다 — 방이 직사각형뿐이라 이 정도면 갈린다.
   */
  const inRoom = (x: number, y: number) => rs.some((r: R) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)
  const STEP = 6
  let touchesEdge = false
  for (let x = main.x + 2; x < main.x + main.w - 2 && !touchesEdge; x += STEP)
    for (let y = main.y + 2; y < main.y + main.h - 2 && !touchesEdge; y += STEP) {
      if (inRoom(x, y)) continue
      if (x - main.x < STEP * 2 || main.x + main.w - x < STEP * 2 ||
          y - main.y < STEP * 2 || main.y + main.h - y < STEP * 2) touchesEdge = true
    }
  if (touchesEdge) notch++
  else courtyard++
}

const pass = batch.passed.length
const pct = (n: number) => (pass ? Math.round((n / pass) * 100) : 0)
const counts = [...roomCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}칸 ${v}`).join(' · ')
const tally = (m: Map<string | number, number>, unit = '') =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${unit} ${v} (${pct(v)}%)`).join(' · ')

console.log(`
  생성 ${batch.tried}건 · 통과 ${pass}건

  실루엣
    봉투 크기      ${envSizes.size}종
    현장 크기      ${sceneSizes.size}종
    방 수          ${counts}
    가장 좁은 방    폭 ${minW} · 높이 ${minH}   (실제 바닥 폭 ${FLOOR_W} · MIN_H 62)
                   바닥 미만 ${underFloor}개  ${underFloor ? `← ★ 이름이 세로로 깨진다 · 최악 ${minWAt}` : '← 없다. 바닥을 지킨다'}

  현장 자리 (②의 계측)
    크기 순위      ${tally(sceneRank as Map<string | number, number>, '위')}
    3×3 위치       ${tally(scenePos as Map<string | number, number>)}
    바깥벽 접면     ${tally(sceneExt as Map<string | number, number>, '면')}

  빈 자리 (2026-07-31 신설 — 렌더러가 그릴 수 있게 된 뒤로)
    있음           ${withVoid}건 (${pct(withVoid)}%)
      ├ 모서리 노치  ${notch}
      └ 중정        ${courtyard}
`)
