/**
 * ─────────────────────────────────────────────────────────────
 *  서술 잠금 — `npm run prose-lock`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-02 신설 · `matrix.ts` §상용화 게이트의 ⓐ 벽 중 **생성 경로 몫**)
 *
 * ## 왜 있나
 *
 * 상용화 게이트의 마지막 5칸(보고서 × 모순 · 장 전환 서사 ×2 · 장 인터루드 ×2)은
 * **결정론적 검사로 못 닫는다.** 재서 확인했다 — 이 채널들은 시각·장소를 **전부
 * 공란으로만** 말하고 글자에는 안 쓴다:
 *
 * ```
 * 보고서 서술문 글자가 이름표를 말하나   0 / 1037
 * 장 인터루드                          0 /  218
 * 장 전환 서사                         1 /  176
 * ```
 *
 * **대조할 닻이 없다.** 남는 모순 벡터는 *"그날 아침 도착했다"* 같은 **자연어 사건
 * 주장**뿐이고 그건 의미 이해라 `MANIFESTO §6` 이 LLM 몫으로 갈라둔 자리다(⑤검열관).
 *
 * ## 그런데 **생성 경로는 검열관 없이 닫힌다**
 *
 * 생성기가 쥔 서술 문장은 **유한하고 작다.** 씨앗 50건에서 이미 포화하고 400건까지
 * 늘지 않는다(실측). 그러니 **목록을 잠그고 늘면 사람이 본다**로 충분하다 —
 * `port-check` 의 `staleAllow` · `world-check` 와 같은 모양이다.
 *
 * ```
 * 씨앗  50 → 21종      200 → 21종      400 → 21종
 * ```
 *
 * ## ⚠ 인물 이름은 정규화한다 — 안 그러면 팔레트가 잠금을 깬다
 *
 * 정규화 전에는 27종이었는데 그중 **여덟이 이름만 다른 같은 문장**이었다
 * (`{이름}이 한마디를 보탰다`). 팔레트가 이름을 바꾸면 **서식은 그대로인데 잠금이
 * 깨진다** — 검사가 엉뚱한 것을 지키는 꼴이다. 그래서 **문장 틀**을 잠근다.
 *
 * ## 이 검사가 지키는 명제
 *
 * > **생성기가 쥔 서술 문장이 늘거나 바뀌면 사람이 한 번 읽는다.**
 *
 * 아래 21종은 **전부 접속구이거나 세계 주장을 안 하는 문장**임을 2026-08-02에
 * 눈으로 확인했다. 07-30에 걷어낸 *"그날 아침 [인물]이 가장 먼저 도착했다"* 부류가
 * 다시 들어오면 **여기서 걸린다.**
 *
 * ⛳ **자동으로 갱신하지 않는다.** 새 문장이 정당하면 사람이 이 목록에 손으로 넣는다 —
 * 그 한 번의 읽기가 이 검사의 전부다. 자동 갱신하면 검사가 장식이 된다.
 */
import { generateCase } from './generate.js'
import type { Case } from './types.js'

const N = Number(process.argv[2] ?? 200)

/**
 * 승인된 서술 문장 틀. **`{인물}` 은 정규화된 자리표다.**
 *
 * 판단 기준: *"이 문장이 **세계에 대한 주장**을 하는가?"*
 *   - 접속구·연결어              → 안전 (`", "` · `"에서 "` · `" 발견됐다. "`)
 *   - 절차를 말하는 문장          → 안전 (`"먼저 그 자리에 무엇이 있었는지를 적는다."`)
 *   - 시각·장소·사건을 단언하는 것 → ⛔ 여기 들어오면 안 된다
 */
const APPROVED: [string, string][] = [
  ['narration', '기록에 대한 정리가 끝나자, {인물}가 한마디를 보탰다.'],
  ['narration', '기록에 대한 정리가 끝나자, {인물}이 한마디를 보탰다.'],
  /**
   * ⚠ **이 하나가 「아침」을 말한다.** 지금은 1장이 아침 정황이라 참이지만,
   * **장 구성이 바뀌면 거짓이 되는 유일한 줄**이다. 07-30 부류에 가장 가깝다 —
   * 지울 수 있으면 지우는 쪽이 낫다(§MANIFESTO ❌C).
   */
  ['narration', '아침의 정황이 정리됐다. 장부가 한 권 더 있다는 것을 뒤늦게 들었다.'],

  ['opening', '남은 것은 이름과 이유다.'],
  ['opening', '다음으로 기록에 남은 것을 적는다.'],
  ['opening', '먼저 그 자리에 무엇이 있었는지를 적는다.'],

  ['report', ' 가리켰다. '],
  ['report', ' 남아 있었고, '],
  ['report', ' 발견됐다. '],
  ['report', ', '],
  ['report', ', 그리고 그를 움직인 것은 '],
  ['report', '.'],
  ['report', '. 기록에 남은 이름은 '],
  ['report', '기록에 '],
  ['report', '모든 정황이 한 사람을 가리켰다. 진범은 '],
  ['report', '소지품에서 개인적인 편지가 나온 것은 '],
  ['report', '소지품에서 낡은 명함이 나온 것은 '],
  ['report', '소지품에서 오래된 사진이 나온 것은 '],
  ['report', '소지품에서 접힌 영수증이 나온 것은 '],
  ['report', '소지품에서 지워진 기록이 나온 것은 '],
  ['report', '에서 '],
]

const ko = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')

const found = new Set<string>()
for (let i = 1; i <= N; i++) {
  const c = generateCase(i) as Case
  // 긴 이름부터 지운다 — 짧은 이름이 긴 이름의 일부일 수 있다
  const names = [...c.people.map((p) => p.name), c.victimProfile?.name ?? '']
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  const norm = (t: string) => names.reduce((acc, n) => acc.split(n).join('{인물}'), t)

  for (const ch of c.chapters) {
    if (ch.opening) found.add(`opening\t${norm(ko(ch.opening))}`)
    if (ch.epilogue) found.add(`epilogue\t${norm(ko(ch.epilogue))}`)
    for (const seg of ch.report ?? []) if (!('blank' in seg)) found.add(`report\t${norm(seg.text)}`)
  }
  for (const r of c.reveals) if (r.narration) found.add(`narration\t${norm(r.narration)}`)
}

const approved = new Set(APPROVED.map(([k, t]) => `${k}\t${t}`))
const added = [...found].filter((x) => !approved.has(x)).sort()
const gone = [...approved].filter((x) => !found.has(x)).sort()

console.log(`\n  서술 잠금 — 씨앗 ${N}건 · 문장 틀 ${found.size}종 (승인 ${approved.size}종)`)

if (!added.length && !gone.length) {
  console.log('  ✓ 생성기가 쥔 서술 문장이 승인 목록과 같다\n')
  process.exit(0)
}

if (added.length) {
  console.log(`\n  ✗ 승인 목록에 없는 문장 ${added.length}종`)
  for (const x of added) {
    const [k, t] = x.split('\t')
    console.log(`    [${k}] ${JSON.stringify(t)}`)
  }
  console.log('\n    → **읽어라.** 세계에 대한 주장(시각·장소·사건)을 하면 안 된다.')
  console.log('      07-30의 「그날 아침 [인물]이 가장 먼저 도착했다」가 그렇게 들어왔다.')
  console.log('      정당하면 prose-lock.ts 의 APPROVED 에 **손으로** 넣는다.')
}
if (gone.length) {
  console.log(`\n  ✗ 승인돼 있는데 이제 안 나오는 문장 ${gone.length}종`)
  for (const x of gone) {
    const [k, t] = x.split('\t')
    console.log(`    [${k}] ${JSON.stringify(t)}`)
  }
  console.log('\n    → 지웠으면 APPROVED 에서도 지운다. 남겨두면 목록이 낡는다.')
}
console.log('')
process.exit(1)
