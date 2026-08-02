/**
 * ─────────────────────────────────────────────────────────────
 *  ⑤검열관 — `npm run censor -w engine -- <사건.yaml> [--judge <응답.yaml>]`
 * ─────────────────────────────────────────────────────────────
 * (2026-08-02 신설 · `MANIFESTO §남은 일` ②)
 *
 * ## 왜 있나 — **코드가 못 하는 자리가 정확히 5칸으로 좁혀졌다**
 *
 * 상용화 게이트의 마지막 5칸(보고서 × 모순 · 장 전환 서사 ×2 · 장 인터루드 ×2)은
 * **결정론적 검사로 못 닫는다.** 재서 확인했다 — 이 채널들은 시각·장소를 **전부
 * 공란/데이터로만** 말하고 글자에는 안 쓴다:
 *
 * ```
 * 보고서 서술문 글자가 이름표를 말하나   0 / 1037
 * 장 인터루드                          0 /  218
 * 장 전환 서사                         1 /  176
 * ```
 *
 * **대조할 닻이 없다.** 남는 벡터는 *"그날 아침 도착했다"* 같은 **자연어 사건 주장**뿐이고
 * 그건 의미 이해다. `MANIFESTO §6` 이 LLM 몫으로 갈라둔 자리다.
 *
 * `MANIFESTO §남은 일` 이 ②를 미루라며 단 조건이 **이제 충족됐다** —
 * *"①이 끝나면 검열할 것 자체가 줄어들고, 그래야 ②가 정말 필요한 자리가 몇 개인지
 * 드러난다."* **답은 5칸이다.**
 *
 * ## 경계 — **LLM 은 경고만, 판정은 코드** (§14)
 *
 * ```
 * ① 코드   검열 브리프를 만든다      산문 + 그것이 어겨선 안 될 데이터를 나란히
 * ② 사람   챗봇에 붙여넣는다         §8 — 앱은 API 를 안 쓴다
 * ③ LLM   「경고」 목록을 낸다        의미 이해. 여기만 LLM 이다
 * ④ 코드   경고를 받아 판정한다       ← 이 파일의 --judge
 * ```
 *
 * ★ **④가 이 설계의 값이다** ★ LLM 이 낸 경고를 **그대로 믿지 않는다.**
 * 코드가 세 가지를 기계적으로 대조한다:
 *
 * ```
 * ⓐ 인용한 문장이 실제로 사건 안에 있나   없으면 지어낸 것이다 → 기각
 * ⓑ 가리킨 자리가 실재하나                 없는 채널이면 → 기각
 * ⓒ 등급이 아는 것인가                     모르는 kind 면 → 기각
 * ```
 *
 * **ⓐ가 특히 중요하다.** LLM 이 *"프롤로그가 「범인은 문세라다」라고 말한다"* 고
 * 경고해도, 그 문장이 사건에 없으면 **코드가 기각한다.** 환각이 판정에 못 들어온다 —
 * 이것이 §14 *"게임 판정은 코드가 한다"* 를 검열 층에서 지키는 방법이다.
 *
 * ⛔ **게이트에 걸지 않는다** — 사람의 왕복이 필요하다. `proof-check`·`world-check` 와
 * 같은 자리다. 대신 **배선이 사는지는 `censor-check` 이 게이트에서 문다.**
 */
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { parseCase } from './schema.js'
import type { Case } from './types.js'

const ko = (x: unknown) => (typeof x === 'string' ? x : (x as { ko?: string })?.ko ?? '')

/** 검열 대상 — ⓐ 벽 5칸이 사는 채널만 모은다 */
export type Passage = { where: string; text: string }

export function passages(c: Case): Passage[] {
  const out: Passage[] = []
  for (const ch of c.chapters) {
    if (ch.opening) out.push({ where: `chapter[${ch.order}].opening`, text: ko(ch.opening) })
    if (ch.epilogue) out.push({ where: `chapter[${ch.order}].epilogue`, text: ko(ch.epilogue) })
    const rep = (ch.report ?? [])
      .map((s) => ('blank' in s ? `〔${ch.blanks[s.blank]?.label ?? '?'}〕` : s.text))
      .join('')
    if (rep.trim()) out.push({ where: `chapter[${ch.order}].report`, text: rep })
  }
  c.reveals.forEach((r, i) => {
    if (r.narration) out.push({ where: `reveal[${i}].narration`, text: r.narration })
  })
  for (const [i, p] of (c.prologue ?? []).entries())
    out.push({ where: `prologue[${i}]`, text: ko(p) })
  return out.filter((p) => p.text.trim())
}

/** 산문이 어겨선 안 될 사실. **브리프에 이것을 같이 실어야 LLM 이 대조할 수 있다** */
export function facts(c: Case): string[] {
  const rows: string[] = []
  const vName = c.victimProfile?.name ?? String(c.victim)
  rows.push(`피해자: ${vName}`)
  rows.push(`용의자 ${c.people.length}명: ${c.people.map((p) => p.name).join(' · ')}`)
  rows.push(`시간대: ${c.slots.map((s) => `${s.id}=${ko(s.label)}${s.isWindow ? '(사망 구간)' : ''}`).join(' · ')}`)
  rows.push(`장소: ${c.locations.map((l) => `${l.id}=${ko(l.label)}`).join(' · ')}`)
  rows.push(`현장: ${c.incident.scene ?? '(없음)'}`)
  for (const p of c.people) {
    const m = new Map(p.presence.map((x) => [x.slot, x.location]))
    const truth = c.slots.map((s) => `${ko(s.label)}=${m.get(s.id) ?? '—'}`).join(' ')
    rows.push(`  ${p.name} 실제 동선: ${truth}`)
    if (p.claim?.length)
      rows.push(`  ${p.name} 주장(거짓): ${p.claim.map((x) => `${x.slot}=${x.location}`).join(' ')}`)
  }
  return rows
}

/** ─── ④ 판정 — LLM 이 낸 경고를 코드가 검산한다 ─────────────── */

export type Raw = { where?: unknown; kind?: unknown; quote?: unknown; why?: unknown }
export type Verdict =
  | { ok: true; where: string; kind: 'leak' | 'contradiction'; quote: string; why: string }
  | { ok: false; reason: string; raw: Raw }

const KINDS = new Set(['leak', 'contradiction'])

/**
 * **LLM 의 주장을 사실과 대조한다.** 통과한 것만 결함으로 센다.
 *
 * ⚠ 여기가 §14 의 경계다 — *"LLM 은 규칙을 결정하지 않는다."* 인용이 실물과
 * 안 맞으면 **아무리 그럴듯해도 기각**이다.
 */
export function judge(c: Case, raws: Raw[]): Verdict[] {
  const ps = passages(c)
  const byWhere = new Map(ps.map((p) => [p.where, p.text]))
  return raws.map((r): Verdict => {
    const where = typeof r.where === 'string' ? r.where.trim() : ''
    const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
    const kind = typeof r.kind === 'string' ? r.kind.trim() : ''
    const why = typeof r.why === 'string' ? r.why.trim() : ''
    if (!where || !quote || !kind) return { ok: false, reason: '칸이 비어 있다 (where·quote·kind 는 필수)', raw: r }
    if (!KINDS.has(kind)) return { ok: false, reason: `모르는 kind '${kind}' (leak · contradiction 만)`, raw: r }
    const text = byWhere.get(where)
    if (text === undefined) return { ok: false, reason: `'${where}' 라는 자리가 이 사건에 없다`, raw: r }
    // ★ 환각 차단 — 인용이 실물에 없으면 기각한다
    if (!text.includes(quote))
      return { ok: false, reason: `인용한 문장이 '${where}' 에 없다 — 지어낸 것이다`, raw: r }
    return { ok: true, where, kind: kind as 'leak' | 'contradiction', quote, why }
  })
}

/** ─── CLI ─────────────────────────────────────────────────── */

if (process.argv[1]?.endsWith('censor.ts')) {
  const casePath = process.argv[2]
  if (!casePath) {
    console.error('\n  쓰는 법: npm run censor -w engine -- <사건.yaml> [--judge <응답.yaml>]\n')
    process.exit(2)
  }
  const c = parseCase(load(readFileSync(casePath, 'utf8')), casePath)
  const ji = process.argv.indexOf('--judge')

  if (ji < 0) {
    // ① 브리프를 낸다 — 서식의 복사 구간에 자리표를 채운다
    const tpl = readFileSync(new URL('../templates/CENSOR-BRIEF.md', import.meta.url), 'utf8')
    const body = tpl.split('⬇ 여기서부터 복사')[1]?.split('⬆ 여기까지 복사')[0] ?? ''
    console.log(
      body
        .replace('{{FACTS}}', facts(c).join('\n'))
        .replace('{{PASSAGES}}', passages(c).map((p) => `[${p.where}]\n${p.text}`).join('\n\n')),
    )
    process.exit(0)
  }

  // ④ 응답을 받아 판정한다
  const resp = load(readFileSync(process.argv[ji + 1]!, 'utf8')) as { warnings?: Raw[] }
  const verdicts = judge(c, resp?.warnings ?? [])
  const live = verdicts.filter((v): v is Extract<Verdict, { ok: true }> => v.ok)
  const dropped = verdicts.filter((v): v is Extract<Verdict, { ok: false }> => !v.ok)

  console.log(`\n  검열 판정 — LLM 이 낸 경고 ${verdicts.length}건`)
  console.log(`    통과 ${live.length} · 기각 ${dropped.length}\n`)
  for (const v of live)
    console.log(`  ${v.kind === 'leak' ? '⛔ 누설' : '⚠ 모순'}  [${v.where}]\n     「${v.quote}」\n     ${v.why}\n`)
  for (const v of dropped)
    console.log(`  · 기각  ${v.reason}\n     ${JSON.stringify(v.raw.quote ?? '')}\n`)

  if (live.some((v) => v.kind === 'leak')) {
    console.log('  ✗ 누설 경고가 살아 있다 — 상품이 사라지는 부류다\n')
    process.exit(1)
  }
  if (live.length) {
    console.log('  ⚠ 모순 경고가 살아 있다 — 읽고 판단한다\n')
    process.exit(1)
  }
  console.log('  ✓ 살아남은 경고가 없다\n')
}
