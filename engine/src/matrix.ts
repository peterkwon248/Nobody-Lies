/**
 * ─────────────────────────────────────────────────────────────
 *  불변식 행렬 — 「검사되지 않는 축이 몇 칸 남았나」 (2026-08-01 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 있나
 *
 * 2026-08-01에 **인물 공란 48개가 근거 없는 찍기**인 것을 찾았다. 게이트는 내내
 * 초록이었고, 뿌리는 **「그 규칙을 어디에 대고 물을지」를 안 정한 것**이었다 —
 * 규칙(*"플레이어는 조사해서 알아내야 한다"*)은 처음부터 있었는데 검사는
 * **장 전체**에만 물었고 **공란 하나하나**에는 안 물었다.
 *
 * 그날 사용자와 정리한 결론:
 *
 * ```
 * 게임 규칙   유한하다   5명 · 범인 1 · 범인만 거짓 가능 · 무고는 진실만 · 트릭/물증 완전
 * 관측 채널   유한하다   플레이어가 정보를 받는 표면 (아래 CHANNELS)
 * ⟹ 곱이 유한하다. 「결함 0」은 이 표가 다 찼다는 뜻이고, 셀 수 있다
 * ```
 *
 * **이 표가 없을 때는 빈칸이 몇 개인지도 몰랐다.** 07-31의 *"A 부류는 거의 닫혀
 * 있었다"* 가 정확히 그 상태였다 — 세어보긴 했는데 **무엇을 안 셌는지**를 몰랐다.
 *
 * ## 범위 — 객관 축 둘만 본다 (2026-08-01 사용자 확정)
 *
 * ```
 * ✅ 범인과 용의자가 구분되는가        누설 · 도출
 * ✅ 트릭·물증이 완전히 구현되는가     모순 · 배선
 * ⛔ 재미 · 산문 두께 · 난이도 체감    ← 기준에서 뺐다. 테스터가 답한다
 * ```
 *
 * ⚠ 그래서 검증기의 검사 중 **난이도·플레이 감각 쪽은 이 표에 안 들어온다**
 * (§4 발판 · §6 헤링 밀도 · §8 예산 비율 · §9-9 길이 쏠림). 그것들은 **논리에서
 * 유도되지 않고 플레이에서 나온 규칙**이라 미리 다 적을 수 없다 — 아래 §OUTSIDE 에
 * 이름만 남겨 잃어버리지 않게 한다.
 *
 * ## 양방향으로 문다
 *
 * `covered` 칸은 **실재하는 검사를 표식으로 가리켜야** 한다. 표식이 소스에 없으면
 * `npm run matrix` 가 exit 1 이다 — `port-check` 의 `staleAllow` 가 *"적어놨는데
 * 코드에 없으면 실패한다"* 로 무는 것과 같은 구조다. **적어만 두고 안 짓는 것**이
 * 이 표의 유일한 실패 방식이라 거기를 막는다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 플레이어가 정보를 받는 표면. 새 화면을 만들면 여기가 는다 */
export const CHANNELS = [
  { id: 'statement', label: '진술 문단' },
  { id: 'addClaims', label: '추가 진술' },
  { id: 'actionList', label: '조사 목록(제목·비용·salience)' },
  { id: 'actionResult', label: '조사 결과(제목·본문)' },
  { id: 'evidence', label: '물증 카드' },
  { id: 'terms', label: '확보 단어' },
  { id: 'report', label: '보고서 서술문' },
  { id: 'grid', label: '주장 대조표(격자)' },
  { id: 'plan', label: '평면도' },
  { id: 'graph', label: '관계도' },
  { id: 'revealNarration', label: '장 전환 서사' },
  { id: 'prologue', label: '프롤로그·개요·브리핑' },
  { id: 'profile', label: '용의자 프로필(유죄 요건)' },
  { id: 'interlude', label: '장 인터루드' },
  { id: 'result', label: '결말 화면' },
] as const

/** 객관 축 둘을 네 불변식으로 쪼갠 것 */
export const INVARIANTS = [
  { id: 'leak', label: '누설', ask: '조사 없이 답이 나오나' },
  { id: 'contradiction', label: '모순', ask: '내용이 격자·데이터와 어긋나나' },
  { id: 'derivable', label: '도출', ask: '이 채널이 묻는 답에 도달 경로가 있나' },
  { id: 'wiring', label: '배선', ask: '가리키는 것이 실재하나' },
] as const

type ChannelId = (typeof CHANNELS)[number]['id']
type InvariantId = (typeof INVARIANTS)[number]['id']

type Cell = {
  channel: ChannelId
  invariant: InvariantId
  /**
   * covered = 그 불변식을 **다 덮는다** · partial = 검사는 있는데 **일부만** 본다 ·
   * open = 없다 · na = 이 조합은 성립하지 않는다
   *
   * ★ `partial` 은 2026-08-01에 늘렸다 ★ 처음엔 `covered`/`open` 둘뿐이었는데,
   * 어휘 봉쇄를 재려다 **`진술 × 누설` 이 ✓ 인데 반만 덮고 있는 것**을 찾았다 —
   * §9-10 은 **확보 단어 누설만** 보고, 「남의 사망 구간 위치를 말한다」(공짜 알리바이)는
   * `STATEMENT-BRIEF` 규칙 4가 금지하는데 **검사가 없다.**
   *
   * **✓ 가 「완전히 덮였다」를 뜻하지 않으면 비율 자체가 거짓말이다** — `verifier §5` 가
   * 조합 수를 정확히 계산하면서 틀린 명제를 재던 것과 같은 부류를, **이 표가 자기에게
   * 저지르고 있었다.** 그래서 머리 숫자는 **완전히 덮인 칸만** 센다.
   */
  status: 'covered' | 'partial' | 'open' | 'na'
  /** covered·partial 이면 검사 표식. 소스에 없으면 실패한다 */
  marker?: { file: string; text: string }
  /** partial 이면 **안 보는 것**을 여기 적는다. 이게 곧 남은 일이다 */
  missing?: string
  /** open 이면 무엇을 지어야 하나 · na 면 왜 성립 안 하나 */
  note: string
}

const V = 'src/verifier.ts'

/**
 * ★ 표 본체 ★ **적지 않은 칸은 자동으로 `open`** 이다 — 빠뜨려도 조용히 넘어가지
 * 않게 하려는 것이다. 여기 적힌 것은 `covered` 와 `na` 뿐이다.
 */
const CELLS: Cell[] = [
  // ── 격자 — 여기가 가장 튼튼하다. 명제 둘이 완전하게 강제된다 ──
  { channel: 'grid', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '7.5 presence → 진술 도출 무결성' },
    note: '무고한 자의 claim ≠ presence 면 오류. 범인이 사망 구간에 거짓이 없어도 오류. **완전하다**' },
  { channel: 'grid', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '레지스트리에 없다' },
    note: 'presence·claim 의 slot·location 이 레지스트리에 있는가' },
  { channel: 'grid', invariant: 'leak', status: 'partial',
    marker: { file: V, text: '사망 시간대에 현장' },
    missing: '모양 누설 검사(§동선 모양)는 **`prose.source === \'template\'` 일 때만** 돈다. 산문을 입히면 꺼진다 — 손저작은 모양이 같아도 문장이 달라서 걸면 틀리기 때문이고 이유가 적혀 있다. 다만 **누설이 없어지는 게 아니라 볼 수 없어지는 것**이다',
    note: '무고한 자가 사망 구간에 현장에 있으면 기회가 생겨 유일성이 무너진다' },
  { channel: 'grid', invariant: 'derivable', status: 'na',
    note: '격자는 답을 묻지 않는다 — 주장을 보여주는 표면이다' },

  // ── 보고서 서술문 — 08-01에 한 칸이 비어 48개가 빠져나갔다 ──
  { channel: 'report', invariant: 'derivable', status: 'partial',
    marker: { file: V, text: '6.8 페어플레이' },
    missing: '**인물 공란만** 본다. 시각·장소·discovered 는 안 문다(proof-check 이 재기만 한다: 시각 0/60)',
    note: '인물 공란의 답을 집어낼 근거가 있나(경고). 정밀 판본은 proof.ts' },
  { channel: 'report', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.75 보고서 서술문' },
    note: '공란과 참조가 정확히 1:1' },
  { channel: 'report', invariant: 'contradiction', status: 'open',
    note: '서술문이 격자·물증과 어긋나는지 아무도 안 본다. 「가장 먼저 일어났다」가 그렇게 살았다' },
  { channel: 'report', invariant: 'leak', status: 'open',
    note: '서술문이 조사 없이 답을 흘리는지 안 본다. proof.ts 의 cost 0 이 그 자리다' },

  // ── 확보 단어 ──
  { channel: 'terms', invariant: 'derivable', status: 'covered',
    marker: { file: V, text: '6.5 discovered 공란의 답이 실제로 확보 가능한가' },
    note: '그 단어를 주는 조사가 있는가' },
  { channel: 'terms', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.56 확보 단어 카드' },
    note: '설명이 있는 단어가 실제로 확보 가능한가' },
  { channel: 'terms', invariant: 'contradiction', status: 'open',
    note: 'terms[].note 가 물증 기록과 어긋나는지 안 본다 (07-31에 손으로 단일 출처를 준 자리)' },
  { channel: 'terms', invariant: 'leak', status: 'na',
    note: '확보 단어는 조사의 산출물이라 정의상 비용을 치른다' },

  // ── 조사 결과 ──
  { channel: 'actionResult', invariant: 'contradiction', status: 'partial',
    marker: { file: V, text: '6.55 조사 결과문과 실제 산출이 어긋나는가' },
    missing: '**산출**과만 대조한다. 결과문이 **격자·트릭**과 어긋나는지는 안 본다',
    note: '결과문이 말하는 것과 실제로 주는 것' },
  { channel: 'actionResult', invariant: 'leak', status: 'partial',
    marker: { file: V, text: '9-7' },
    missing: '**확보 단어**만 본다. 결과문이 범인을 가리키는 다른 방식은 안 본다',
    note: '결과문이 그 조사가 주지 않는 확보 단어를 말하는가' },
  { channel: 'actionResult', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.4 decoy' },
    note: 'decoy 가 필수 경로에 개입하지 않는가' },
  { channel: 'actionResult', invariant: 'derivable', status: 'na',
    note: '결과는 답이 아니라 단서다 — 도출되는 쪽이 아니라 도출하는 쪽' },

  // ── 물증 ──
  { channel: 'evidence', invariant: 'wiring', status: 'partial',
    marker: { file: V, text: '6.57 레드 헤링 회수' },
    missing: '**레드 헤링 회수**만 본다. 물증 전반의 참조 무결성은 스키마가 따로 본다',
    note: '심어놓고 닫지 않은 물증' },
  { channel: 'evidence', invariant: 'contradiction', status: 'open',
    note: '물증 기록이 격자·트릭과 어긋나는지 안 본다' },
  { channel: 'evidence', invariant: 'leak', status: 'open',
    note: '물증 기록이 범인을 지목하는지 안 본다 — 소지품 150/150 이 그 부류였다' },
  { channel: 'evidence', invariant: 'derivable', status: 'na',
    note: '물증은 답이 아니라 단서다' },

  // ── 진술 산문 — 명제 둘이 여기서 무검사다 ──
  { channel: 'statement', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-11. **진술이 남의 사망 구간 위치를 말한다**' },
    note: '누설 두 갈래를 덮는다 — §9-10 확보 단어 선점 · §9-11 남의 사망 구간 위치(공짜 알리바이). ★ 08-01에 §9-11 을 지어 ◐ → ✓ 로 올렸다' },
  { channel: 'statement', invariant: 'contradiction', status: 'open',
    note: '★ 가장 큰 빈칸 ★ 「무고한 사람은 진실만 말한다」가 **격자에서만** 강제된다. 산문은 무검사다' },
  { channel: 'statement', invariant: 'derivable', status: 'open',
    note: '진술이 인물을 구별하는 근거를 주는지 안 본다 (proof.ts R3 가 반쪽)' },
  { channel: 'statement', invariant: 'wiring', status: 'na',
    note: '진술은 무엇도 가리키지 않는다 — 자유 텍스트다' },

  // ── 추가 진술 ──
  { channel: 'addClaims', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.9 **공개가 가리키는 것이 실재하는가**' },
    note: '화자 id · slot 이 실재하는가. ⚠ 내용은 안 본다' },
  { channel: 'addClaims', invariant: 'contradiction', status: 'open',
    note: '추가 진술 내용이 격자와 어긋나는지 안 본다 — 명제 둘의 나머지 절반' },
  { channel: 'addClaims', invariant: 'leak', status: 'open', note: '' },
  { channel: 'addClaims', invariant: 'derivable', status: 'na',
    note: '추가 진술은 답이 아니라 단서다' },

  // ── 장 전환 서사 ──
  { channel: 'revealNarration', invariant: 'leak', status: 'partial',
    marker: { file: V, text: '6.7 서사 조각의 균일성' },
    missing: '**유무의 균일성**만 본다. 서사 **내용**이 답을 흘리는지는 §9-7(d)가 확보 단어까지만',
    note: '서사의 유무가 유용도를 노출한다' },
  { channel: 'revealNarration', invariant: 'contradiction', status: 'open',
    note: '★ 08-01에 이 채널이 §6.8 을 속였다 — 「…가 한마디를 보탰다」가 증거로 셈해졌다' },
  { channel: 'revealNarration', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '영영 열리지 않는다' },
    note: '트리거 조사·장이 실재하는가' },
  { channel: 'revealNarration', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 프롤로그·개요 ──
  { channel: 'prologue', invariant: 'leak', status: 'partial',
    marker: { file: V, text: '9-7' },
    missing: '**확보 단어**만 본다. 프롤로그가 범인·트릭을 가리키는지는 안 본다',
    note: '프롤로그가 확보 단어를 먼저 말하는가' },
  { channel: 'prologue', invariant: 'contradiction', status: 'open',
    note: 'closing-theater 에 **일부러 남긴 재현 테스트**가 여기 있다' },
  { channel: 'prologue', invariant: 'derivable', status: 'na', note: '전제를 말하는 자리다' },
  { channel: 'prologue', invariant: 'wiring', status: 'na', note: '가리키는 것이 없다' },

  // ── 용의자 프로필 ──
  { channel: 'profile', invariant: 'derivable', status: 'covered',
    marker: { file: V, text: '1. 유일성' },
    note: '유죄 요건 셋이 정확히 한 사람에게만 선다' },
  { channel: 'profile', invariant: 'leak', status: 'open',
    note: '프로필이 조사 전에 유죄 요건을 보여주는지 안 본다 (§절대 규칙의 「프로필의 유죄 판정 금지」)' },
  { channel: 'profile', invariant: 'contradiction', status: 'open', note: '' },
  { channel: 'profile', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '2. 트릭' },
    note: '트릭 계약이 사실·물증과 맞물리는가' },

  // ── 조사 목록 — 08-01에 여기가 인물 식별의 유일한 자리였다 ──
  { channel: 'actionList', invariant: 'leak', status: 'open',
    note: '★ 목록의 모양이 범인을 지목하는지 안 본다 — salience·비용·조사 개수·빈손 여부' },
  { channel: 'actionList', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.6 필수 조사' },
    note: '답을 한 조사로만 얻으면 그 조사는 건너뛸 수 없다' },
  { channel: 'actionList', invariant: 'contradiction', status: 'na',
    note: '제목·비용은 주장이 아니라 메뉴다' },
  { channel: 'actionList', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 평면도 ──
  { channel: 'plan', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '9-3' },
    note: '평면도가 격자·트릭과 좌표로 맞는가' },
  { channel: 'plan', invariant: 'leak', status: 'open',
    note: '방 크기·위치가 현장을 지목하는지 안 본다 (plan-check 이 세지만 게이트 밖)' },
  { channel: 'plan', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '9-3' },
    note: '장소 id 가 실재하는가' },
  { channel: 'plan', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 관계도 · 인터루드 · 결말 — 아직 아무도 안 읽는다 ──
  { channel: 'graph', invariant: 'leak', status: 'open',
    note: '★ MEMORY §오케스트레이터가 「관계 그래프가 답을 그림」을 미해결로 적어뒀다' },
  { channel: 'graph', invariant: 'contradiction', status: 'open', note: '' },
  { channel: 'graph', invariant: 'wiring', status: 'open', note: '' },
  { channel: 'graph', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  { channel: 'interlude', invariant: 'contradiction', status: 'open', note: '' },
  { channel: 'interlude', invariant: 'leak', status: 'open', note: '' },
  { channel: 'interlude', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.9 **공개가 가리키는 것이 실재하는가**' },
    note: '인터루드는 reveal 위에 산다' },
  { channel: 'interlude', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  { channel: 'result', invariant: 'contradiction', status: 'open',
    note: '★ MEMORY §오케스트레이터: 「결말이 옛 트릭을 서술」 — §9-7 은 결말을 안 읽는다' },
  { channel: 'result', invariant: 'leak', status: 'na',
    note: '결말은 채점 뒤라 누설할 것이 남아 있지 않다' },
  { channel: 'result', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },
  { channel: 'result', invariant: 'wiring', status: 'open', note: '' },
]

/**
 * 이 표 **밖**에 있는 검사들. 논리에서 유도되지 않고 **플레이에서 나온** 규칙이라
 * 미리 다 적을 수 없다 — 사용자가 테스터 몫으로 분류한 축이다.
 * 잃어버리지 않게 이름만 남긴다.
 */
export const OUTSIDE = [
  { check: '§4 조사 없이 확정 가능한 장', why: '발판이 없으면 첫 장에서 막힌다 — 플레이테스트에서 나왔다' },
  { check: '§6 레드 헤링 밀도', why: '함정이 적으면 심심하다 — 난이도 감각' },
  { check: '§8 예산 대비 조사 비율', why: '좌절 위험 — 체감' },
  { check: '§9-9 진술 길이 쏠림', why: '산문 품질 — 기준에서 뺐다' },
  { check: '§7 부문 분포', why: '채점 구성 — 게임 설계지 정합성이 아니다' },
  { check: '§5 단계별 교착', why: '난이도 사다리' },
]

// ─────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const src = new Map<string, string>()
const read = (f: string) => {
  if (!src.has(f)) src.set(f, readFileSync(join(ROOT, f), 'utf8'))
  return src.get(f)!
}

const byKey = new Map<string, Cell>()
for (const c of CELLS) byKey.set(`${c.channel}|${c.invariant}`, c)

let covered = 0
let half = 0
let open = 0
let na = 0
const stale: string[] = []
const openList: { ch: string; inv: string; note: string }[] = []
const halfList: { ch: string; inv: string; missing: string }[] = []

const rows: string[][] = []
for (const ch of CHANNELS) {
  const row: string[] = [ch.label]
  for (const inv of INVARIANTS) {
    const cell = byKey.get(`${ch.id}|${inv.id}`)
    if (!cell || cell.status === 'open') {
      open++
      row.push('·')
      openList.push({ ch: ch.label, inv: inv.label, note: cell?.note ?? '' })
      continue
    }
    if (cell.status === 'na') { na++; row.push('—'); continue }
    if (cell.status === 'partial') {
      half++
      row.push('◐')
      halfList.push({ ch: ch.label, inv: inv.label, missing: cell.missing ?? '(안 보는 것이 안 적혀 있다)' })
    } else {
      covered++
      row.push('✓')
    }
    // ★ 양방향으로 문다 — 적어놨는데 소스에 없으면 실패
    if (cell.marker && !read(cell.marker.file).includes(cell.marker.text))
      stale.push(`${ch.label} × ${inv.label} → '${cell.marker.text}' 가 ${cell.marker.file} 에 없다`)
    // partial 인데 안 보는 것을 안 적었으면 그것도 실패다 — 「반쯤 덮었다」가 뜻을 잃는다
    if (cell.status === 'partial' && !cell.missing)
      stale.push(`${ch.label} × ${inv.label} → partial 인데 missing 이 비어 있다`)
  }
  rows.push(row)
}

const total = CHANNELS.length * INVARIANTS.length
const live = total - na

/**
 * ★ 두 모드 ★ 게이트는 **표식이 실재하는가**만 본다(기준이 분명하다).
 * 찬 칸 비율은 기준치가 없으므로 **판정하지 않고 한 줄로만** 알린다 —
 * 표를 매 빌드에 40줄씩 찍으면 그 자체가 소음이 되어 아무도 안 읽는다.
 */
const brief = process.argv.includes('--brief')

if (brief) {
  console.log(
    `\n  불변식 행렬 — 완전 ${covered}/${live} (${((covered / live) * 100).toFixed(0)}%) · 부분 ${half} · 빈칸 ${open}`,
  )
  if (stale.length) {
    console.log(`\n  ✗ 표식이 소스에 없다 (${stale.length})`)
    for (const s of stale) console.log(`    ${s}`)
    console.log('    → 적어만 두고 안 지었거나, 검사 주석이 바뀌었다\n')
    process.exit(1)
  }
  console.log('    (전체 표는 npm run matrix)\n')
  process.exit(0)
}

console.log(`\n  관측 채널 ${CHANNELS.length} × 불변식 ${INVARIANTS.length} = ${total}칸`)
console.log(`  해당 없음 ${na} → **살아 있는 칸 ${live}**\n`)

const head: string[] = ['채널', ...INVARIANTS.map((i) => i.label)]
const w = [34, 7, 7, 7, 7]
/** 한글·기호는 터미널에서 두 칸을 먹는다 — 그걸 세어서 채운다 */
const width = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0)
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(1, n - width(s)))
const line = (cols: string[]) => '  ' + cols.map((c, i) => pad(c, w[i]!)).join('')
console.log(line(head))
console.log('  ' + '─'.repeat(52))
for (const r of rows) console.log(line(r))

console.log(`\n  ✓ 완전히 덮임 ${covered} / ${live}   (${((covered / live) * 100).toFixed(0)}%)`)
console.log(`  ◐ 부분만     ${half}        ← 검사는 있는데 일부만 본다. **✓ 로 세지 않는다**`)
console.log(`  · 빈 칸      ${open}        ← 검사가 없다`)
console.log(`  — 해당없음   ${na}\n`)

if (halfList.length) {
  console.log('  ── 부분만 덮인 칸 — 「안 보는 것」이 곧 남은 일이다 ──')
  for (const h of halfList) console.log(`    ${h.ch} × ${h.inv}\n        ${h.missing}`)
  console.log('')
}

if (openList.length) {
  console.log('  ── 빈칸 목록 ──')
  for (const o of openList)
    console.log(`    ${o.ch} × ${o.inv}${o.note ? `\n        ${o.note}` : ''}`)
}

console.log('\n  ── 이 표 밖 (플레이에서 나온 규칙 — 테스터 몫) ──')
for (const o of OUTSIDE) console.log(`    ${o.check.padEnd(28)} ${o.why}`)

if (stale.length) {
  console.log(`\n  ✗ 표식이 소스에 없다 (${stale.length})`)
  for (const s of stale) console.log(`    ${s}`)
  console.log('    → 적어만 두고 안 지었거나, 검사 주석이 바뀌었다\n')
  process.exit(1)
}
console.log('\n  ✓ 찬 칸의 표식이 전부 소스에 있다\n')
