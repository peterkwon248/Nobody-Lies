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
  /**
   * ★ `brief` 는 2026-08-02에 늘렸다 ★ **사람의 왕복이 필요한 반자동**이다 —
   * 코드가 검열 브리프를 만들고, 사용자가 챗봇에 붙이고, 코드가 응답을 판정한다
   * (`censor.ts`). 게이트가 매번 자동으로 무는 `covered` 와 **같은 ✓ 로 세면 안 된다** —
   * 그러면 이 표가 자기를 틀리게 말하는 여덟 번째가 된다. 머리 숫자에서 갈라 센다.
   */
  status: 'covered' | 'brief' | 'partial' | 'open' | 'na'
  /** covered·partial 이면 검사 표식. 소스에 없으면 실패한다 */
  marker?: { file: string; text: string }
  /** partial 이면 **안 보는 것**을 여기 적는다. 이게 곧 남은 일이다 */
  missing?: string
  /** open 이면 무엇을 지어야 하나 · na 면 왜 성립 안 하나 */
  note: string
}

/**
 * ─────────────────────────────────────────────────────────────
 *  ★★ 상용화 게이트 — **출시에 필요한 칸** (2026-08-02 · 사용자 확정) ★★
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 필요한가 — **행렬 % 는 출시 기준이 아니다**
 *
 * 행렬 전체 비율은 *"검사할 수 있는 표면 중 얼마나 검사하나"* 지 *"팔 수 있나"* 가
 * 아니다. **그걸 100% 로 끌고 가려는 것이 「작업이 끝없이 늘어나는」 느낌의 원인이었다.**
 *
 * 축별로 갈라 세니 41% 가 무엇을 감추는지 드러났다:
 *
 * ```
 * 배선  11/13  85%   가리키는 게 실재하나        ← 거의 끝났다
 * 도출   2/ 4  50%   답에 도달 경로가 있나       ← proof-check 320/320 이 실측으로 받친다
 * 모순   3/14  21%   화면이 데이터와 다른 말을 하나
 * 누설   2/13  15%   조사 없이 답이 나오나       ← 상품을 죽이는 축인데 제일 낮다
 * ```
 *
 * **41% 가 낮은 게 문제가 아니라, 낮은 자리가 하필 상품 그 자체인 게 문제다.**
 * `MEMORY §절대 규칙` 첫 줄이 그렇게 정의한다 — *"이 게임의 상품은 「내가 알아냈다」는
 * 감각이다. 아래를 위반하면 상품이 사라진다."* 그 「아래」가 전부 **누설**이다.
 *
 * ## 무엇이 드나
 *
 * ```
 * ✅ 누설 축 전부              살아있는 칸 전부   이게 상품이다
 * ✅ 모순 축 중 산문 채널만      아래 PROSE       산문은 데이터와 따로 놀아서
 *                                              어긋나도 아무도 모른다
 * ⏭ 도출                      0               생성 320/320 실측이 이미 받친다
 * ⏭ 배선                      0               85%. 남은 둘은 결말 화면 — 채점 뒤라 늦어도 된다
 * ```
 *
 * **여기 안 드는 칸은 출시 후에 해도 된다. 100% 는 상용화 조건이 아니다.**
 *
 * ## ⚠ 태그가 아니라 **규칙**이다
 *
 * 칸마다 `ship: true` 를 손으로 붙이면 **채널을 새로 만들 때 조용히 빠진다** — 이
 * 저장소가 다섯 번 밟은 함정이 정확히 그것이다(`b9f49b4` · `PORT-AUDIT` 표 ·
 * 08-02의 §9-3h). 규칙으로 두면 **새 채널의 누설 칸이 자동으로 게이트에 든다.**
 * 그리고 문서에는 숫자를 안 적는다 — `npm run matrix` 가 센다.
 */
const PROSE_CHANNELS = new Set<ChannelId>([
  'statement', 'addClaims', 'report', 'revealNarration', 'prologue', 'interlude',
])
const inShipGate = (c: Cell) =>
  c.status !== 'na' &&
  (c.invariant === 'leak' || (c.invariant === 'contradiction' && PROSE_CHANNELS.has(c.channel)))

const V = 'src/verifier.ts'
const PL = 'src/prose-lock.ts'
const CS = 'src/censor.ts'

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
    note: 'presence·claim 의 slot·location 이 레지스트리에 있는가 · §9-3g(사망 구간 축소 범위가 뒤집혔거나 격자의 창을 한 칸도 안 덮는가)' },
  /**
   * ★ 2026-08-02 — **두 검사가 한 조건에 묶여 있었다** ★
   *
   * 옛 `missing`: *"모양 누설 검사는 `prose.source === 'template'` 일 때만 돈다.
   * 산문을 입히면 꺼진다 … **누설이 없어지는 게 아니라 볼 수 없어지는 것**이다."*
   *
   * 그 「`template` 일 때만」이라는 이유는 **①에만 참이었다:**
   * ```
   * ① 무고한 둘의 동선이 같다   조립 진술이 글자까지 같아진다   ← 산문 문제. 게이트가 맞다
   * ② 범인의 동선이 유일하다     격자 표에 그대로 보인다        ← 격자 문제. 산문과 무관하다
   * ```
   * **격자는 표다** — 산문을 아무리 다르게 써도 「누가 어느 칸에 있었다고 말했나」의
   * 모양은 화면에 그대로 뜬다. ②를 풀었더니 **셋이 걸렸다**(산장 · 연습실 · 저작 서식).
   */
  { channel: 'grid', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-11. **동선의 모양이 곧 지목이 된다**' },
    note: '둘을 본다 — ⓐ 무고한 자가 사망 구간에 현장에 있으면 기회가 생겨 유일성이 무너진다(§7.5) · ⓑ **동선의 모양**(§9-11). ⓑ 는 08-02에 `template` 게이트에서 풀었다: 「무고한 둘이 같은 모양」은 조립 진술에서만 뜻이 있어 그대로 두고, **「범인만 유일한 모양」은 격자 표에 산문과 무관하게 보이므로 전건에서 본다.** ⚠ 저작분은 **경고**다(오류로 걸면 커밋된 셋이 빨개져 검사가 거짓말이 된다 — §5-b·§9-14·§9-10 과 같은 판단) · **생성분은 오류**다' },
  { channel: 'grid', invariant: 'derivable', status: 'na',
    note: '격자는 답을 묻지 않는다 — 주장을 보여주는 표면이다' },

  // ── 보고서 서술문 — 08-01에 한 칸이 비어 48개가 빠져나갔다 ──
  /**
   * ★ 2026-08-02 정정 — **죽은 검사를 표식으로 쓰고 있었다** ★
   *
   * 표식이 `6.8 페어플레이` 였는데 **§6.8 은 08-01에 접혔다.** 지금 그 자리에는
   * `// (실행부 없음 — 위 §5-b 가 proof.ts 의 R1·R3 로 같은 자리를 본다.)` 만 있다.
   * **표식 검사는 「그 글자가 소스에 있나」만 보므로 주석만 남아도 통과한다.**
   *
   * `missing` 도 낡아 있었다 — *"인물 공란만 본다. 시각·장소는 안 문다(시각 0/60)"*.
   * §5-b 는 **모든 장의 모든 공란**을 보고 `proof-check` 실측은 **시각 60/60**이다.
   *
   * ⚠ **역방향 검사(§검증기의 절이 표에 놓였는가)로는 이걸 못 잡는다** — §6.8 은
   * 표에 놓여 **있었고** 글자도 소스에 **있었다.** 못 잡는 것은 *"표식이 가리키는
   * 자리에 실행부가 있나"* 다. 도구의 사거리로 적어둔다.
   */
  { channel: 'report', invariant: 'derivable', status: 'covered',
    marker: { file: V, text: '5-b 페어플레이' },
    note: '§5-b 가 `weakBlanks` 로 **모든 장의 모든 공란**에 사슬이 서는지 묻는다(경고). 실측: 생성 320/320 · 손저작 55/61. ⚠ 경고인 이유는 *"사슬이 없다"* 와 *"근거가 없다"* 를 구분 못 하기 때문이다 — 손저작 26개는 `proof.ts` 의 규칙이 사람이 쓴 산문에 안 닿는 것이지 결함이 아니다' },
  { channel: 'report', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.75 보고서 서술문' },
    note: '공란과 참조가 정확히 1:1' },
    { channel: 'report', invariant: 'contradiction', status: 'brief',
    marker: { file: CS, text: '⑤검열관' },
    note: '★ 08-02 ⑤검열관 ★ 결정론적으로는 못 잰다 — 이 채널은 시각·장소를 **공란/데이터로만** 말하고 글자에는 안 쓴다(실측). 그래서 둘로 나눠 덮는다: **생성 경로**는 `prose-lock` 이 문장 틀 21종을 잠그고, **손저작·산문 왕복 경로**는 `npm run censor` 가 검열 브리프를 만들어 챗봇에 묻는다. ⚠ **LLM 은 경고만 내고 판정은 코드가 한다**(§14) — 인용이 실물에 없으면 기각한다(환각 차단). 그 배선은 `censor-check` 이 게이트에서 문다. ⛔ **자동이 아니다** — 사람 왕복이 필요하므로 `covered` 와 같은 ✓ 로 세지 않는다' },
  /**
   * ★ 2026-08-02 정정 — **이 칸도 이미 덮여 있었다** ★
   *
   * 옛 노트: *"서술문이 조사 없이 답을 흘리는지 안 본다. **proof.ts 의 cost 0 이
   * 그 자리다**."* 그 자리를 **`weakBlanks` 가 이미 보고 있다** —
   * `kind: 'free'`(조사 없이 풀린다)가 정확히 그것이고, 「선언된 전제」
   * (§R5 현장·§R7 발견 시각·§R8 씨앗)는 `isDeclaredPremise` 로 빼고 센다.
   * §5-b 가 그것을 경고로 낸다.
   *
   * **노트가 자기 답을 적어놓고 「안 본다」고 말하고 있었다** — §9-3h 와 같은 부류의
   * **여섯 번째**다.
   */
  { channel: 'report', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '5-b 페어플레이' },
    note: '§5-b 의 `weakBlanks` 가 `kind: \'free\'` 로 문다 — **비용 0 인데 선언된 전제가 아닌** 공란. 전제(§R5 현장·§R7 발견 시각·§R8 씨앗)는 `isDeclaredPremise` 가 갈라낸다. ★ 이 판정은 `clue-check` 의 **종료 조건 그 자체**이기도 하다 — 검증기와 게이트가 같은 함수를 부르므로 갈릴 수 없다' },

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
    note: '결과문이 말하는 것과 실제로 주는 것. 거울상인 §9-8(데이터를 주는데 산문이 침묵한다)도 여기 산다' },
  { channel: 'actionResult', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-19. **조사 결과문·물증 기록이 범인만 부른다**' },
    note: '★ 08-02에 **경계를 못 박아서** ◐ → ✓ 가 됐다 ★ 옛 `missing` 이 *"범인을 가리키는 **다른 방식**은 안 본다"* 로 **끝이 열려** 있어서 무슨 검사를 넣어도 ✓ 가 될 수 없었다. 가리키는 방식을 **둘로 못 박는다** — ① 확보 단어 선점(§9-7 c·d) · ② 용의자 중 **범인만 이름이 나온다**(§9-19). ②는 §9-13·§9-18 이 이미 대는 자와 같고 채널만 다르다. ⚠ 그 조사가 겨누는 인물은 빼고 센다(안 그러면 「소지품 검사 · 문세라」가 전부 걸린다 — 실제로 첫 판에서 5건이 그랬다). 실측 657조각 · 0건' },
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
  { channel: 'evidence', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-19. **조사 결과문·물증 기록이 범인만 부른다**' },
    note: '★ 08-02에 **경계를 못 박아서** ◐ → ✓ 가 됐다 ★ 둘로 나눠 본다 — ① **유무가 갈리는가**(§9-14 · 기록이 섞여 있으면 그 유무가 곧 유용도 표시다) · ② **내용이 범인만 부르는가**(§9-19). 옛 `missing` 은 *"내용이 범인을 가리키는지 안 본다 — 관측면 자료구조가 서야 잰다"* 로 미뤄뒀는데, **자료구조 없이 이름 대조로 된다**(그 물증을 주는 조사가 겨누는 인물만 빼면 된다). 실측 701조각 · 0건' },
  { channel: 'evidence', invariant: 'derivable', status: 'na',
    note: '물증은 답이 아니라 단서다' },

  // ── 진술 산문 — 명제 둘이 여기서 무검사다 ──
  { channel: 'statement', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-11. **진술이 남의 사망 구간 위치를 말한다**' },
    note: '누설 두 갈래를 덮는다 — §9-10 확보 단어 선점 · §9-11 남의 사망 구간 위치(공짜 알리바이). ★ 08-01에 §9-11 을 지어 ◐ → ✓ 로 올렸다' },
  { channel: 'statement', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '9-15. **진술 산문이 자기 주장 격자와 어긋난다**' },
    note: '★ 08-02에 지었다 — 「가장 큰 빈칸」이었다 ★ 산문이 말한 (시각, 장소)를 **그 사람의 주장 격자**(presence 를 claim 이 덮어쓴 것)와 대조한다. 진실이 아니라 「그 사람이 하는 말」과 맞춘다 — 범인은 격자에서도 거짓말하고 산문이 그것과 일치하는 것이 정상이다. 실측: 거짓 양성 0/16건 · 심어서 70/70. ⚠ 시각 1·장소 1 인 문단만 본다(149/241) — 여럿이면 어느 쌍이 짝인지 모르므로 안 찍는다' },
  { channel: 'statement', invariant: 'derivable', status: 'open',
    note: '진술이 인물을 구별하는 근거를 주는지 안 본다 (proof.ts R3 가 반쪽)' },
  { channel: 'statement', invariant: 'wiring', status: 'na',
    note: '진술은 무엇도 가리키지 않는다 — 자유 텍스트다' },

  // ── 추가 진술 ──
  { channel: 'addClaims', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.9 **공개가 가리키는 것이 실재하는가**' },
    note: '화자 id · slot 이 실재하는가. ⚠ 내용은 안 본다' },
  { channel: 'addClaims', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '9-17. **추가 진술이 자기 격자와 어긋나거나 단어를 흘린다**' },
    note: '★ 08-02에 지었다 ★ §6.9 는 **화자 id·slot 이 실재하는지**만 보고(*"내용은 안 본다"* 라고 그 자리에 적혀 있었다) §9-7 은 조사 결과문·장 전환 서사까지만 봐서, **추가 진술의 내용이 두 검사 사이로 빠져 있었다.** §9-15 와 같은 명제 — 진실이 아니라 **화자의 주장 격자**와 맞춘다(범인은 격자에서도 거짓말하고 추가 진술이 그것과 일치하는 것이 정상이다). 실측 132조각 중 64%가 시각1·장소1 이고 **어긋남 0**' },
  { channel: 'addClaims', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-17. **추가 진술이 자기 격자와 어긋나거나 단어를 흘린다**' },
    note: '씨앗이 아닌 확보 단어를 추가 진술이 먼저 말하는가 — §9-7(c)(d) 가 조사 결과문·서사에 대해 대는 것과 **같은 자**다. 실측 0/132' },
  { channel: 'addClaims', invariant: 'derivable', status: 'na',
    note: '추가 진술은 답이 아니라 단서다' },

  // ── 장 전환 서사 ──
    { channel: 'revealNarration', invariant: 'leak', status: 'brief',
    marker: { file: CS, text: '⑤검열관' },
    note: '★ 08-02 ⑤검열관 ★ 결정론적으로는 못 잰다 — 이 채널은 시각·장소를 **공란/데이터로만** 말하고 글자에는 안 쓴다(실측). 그래서 둘로 나눠 덮는다: **생성 경로**는 `prose-lock` 이 문장 틀 21종을 잠그고, **손저작·산문 왕복 경로**는 `npm run censor` 가 검열 브리프를 만들어 챗봇에 묻는다. ⚠ **LLM 은 경고만 내고 판정은 코드가 한다**(§14) — 인용이 실물에 없으면 기각한다(환각 차단). 그 배선은 `censor-check` 이 게이트에서 문다. ⛔ **자동이 아니다** — 사람 왕복이 필요하므로 `covered` 와 같은 ✓ 로 세지 않는다' },
    { channel: 'revealNarration', invariant: 'contradiction', status: 'brief',
    marker: { file: CS, text: '⑤검열관' },
    note: '★ 08-02 ⑤검열관 ★ 결정론적으로는 못 잰다 — 이 채널은 시각·장소를 **공란/데이터로만** 말하고 글자에는 안 쓴다(실측). 그래서 둘로 나눠 덮는다: **생성 경로**는 `prose-lock` 이 문장 틀 21종을 잠그고, **손저작·산문 왕복 경로**는 `npm run censor` 가 검열 브리프를 만들어 챗봇에 묻는다. ⚠ **LLM 은 경고만 내고 판정은 코드가 한다**(§14) — 인용이 실물에 없으면 기각한다(환각 차단). 그 배선은 `censor-check` 이 게이트에서 문다. ⛔ **자동이 아니다** — 사람 왕복이 필요하므로 `covered` 와 같은 ✓ 로 세지 않는다' },
  { channel: 'revealNarration', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '영영 열리지 않는다' },
    note: '트리거 조사·장이 실재하는가' },
  { channel: 'revealNarration', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 프롤로그·개요 ──
  { channel: 'prologue', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-18. **프롤로그가 범인을 부르거나 사실과 어긋난다**' },
    note: '확보 단어(§9-7b · 오류)에 더해 **§9-18 이 「용의자 중 범인만 이름이 나오나」**를 문다 — §9-13(도식이 범인만 가리킨다)과 같은 명제다. 실측 44건: 용의자를 부르는 프롤로그가 1건(2%)이고 **범인만 부르는 것은 0**' },
  { channel: 'prologue', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '9-18. **프롤로그가 범인을 부르거나 사실과 어긋난다**' },
    note: '§9-18 이 둘을 문다 — ⓐ「죽었다」고 한 사람이 **피해자**인가(`victimProfile.name` 이 정본이다. `people` 에는 피해자가 없다) · ⓑ **인원수를 글자로** 말하는데 실제와 같은가(*"다섯 사람이 더"* — MANIFESTO ❌C 부류로, 세계가 바뀌어도 문장이 안 따라오는 자리다). ⛳ `closing-theater` 의 **일부러 남긴 재현 테스트**는 이 둘이 아니라 프롤로그↔데이터 불일치라 ⑤검열관 몫으로 남는다' },
  { channel: 'prologue', invariant: 'derivable', status: 'na', note: '전제를 말하는 자리다' },
  { channel: 'prologue', invariant: 'wiring', status: 'na', note: '가리키는 것이 없다' },

  // ── 용의자 프로필 ──
  { channel: 'profile', invariant: 'derivable', status: 'covered',
    marker: { file: V, text: '1. 유일성' },
    note: '유죄 요건 셋이 정확히 한 사람에게만 선다' },
  { channel: 'profile', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-16. **인물별 수량이 범인을 혼자 세운다**' },
    note: '§절대 규칙이 **이름으로 금지**한 자리인데(*"프로필의 유죄 판정 금지 · 기회 있음 ✓ 금지"*) 검사가 없었다. §9-16 이 **프로필에 찬 칸 수**로 범인이 혼자 최다/최소인지 문다. ⛔ **다만 지금은 발화할 수가 없다 — 채널이 비어 있다.** `action.clues` 를 가진 사건은 **산장 하나뿐**(12개)이고 생성 40건 + 저작 3건이 **전부 0** 이다. 즉 이 축은 **채워지는 순간부터 무는 회귀 감시**이고, 지금 「누설 없음」은 **내용이 없어서**다. ★ 채널이 빈 것 자체는 누설이 아니라 **결손**이라 여기 안 센다 — `NEXT-ACTION` §프로필 채널이 비어 있다 참조' },
  { channel: 'profile', invariant: 'contradiction', status: 'open', note: '' },
  { channel: 'profile', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '2. 트릭' },
    note: '트릭 계약이 사실·물증과 맞물리는가' },

  // ── 조사 목록 — 08-01에 여기가 인물 식별의 유일한 자리였다 ──
  { channel: 'actionList', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-16. **인물별 수량이 범인을 혼자 세운다**' },
    note: '빈손 여부(§9-3h) · 이름의 모양(§9-3e) · **세어볼 수 있는 수량**(§9-16 — 조사 개수·비용 합)까지 본다. ⛳ **`salience` 는 일부러 뺐다** — `App.jsx` 어디에도 렌더되지 않아(전수 grep 0건) 보이지 않는 값이다. 재보니 범인의 고립률이 무고한 자보다 **낮았다**(34% 대 41% · 배율 0.82x) — 기준선 없이 34%만 봤으면 없는 누설을 잡으러 갔다. ⚠ 2026-08-02 정정: 이 칸은 원래 `open` 으로 적혀 있었는데 §9-3h 가 이미 오류 등급으로 빈손을 보고 있었다 — **행렬이 자기 코드를 모르던 다섯 번째**' },
  { channel: 'actionList', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '6.6 필수 조사' },
    note: '답을 한 조사로만 얻으면 그 조사는 건너뛸 수 없다' },
  { channel: 'actionList', invariant: 'contradiction', status: 'na',
    note: '제목·비용은 주장이 아니라 메뉴다' },
  { channel: 'actionList', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 평면도 ──
  { channel: 'plan', invariant: 'contradiction', status: 'covered',
    marker: { file: V, text: '9-3' },
    note: '평면도가 격자·트릭과 좌표로 맞는가 — §9-3b(트릭이 말한 창이 현장에 있나) · §9-3i(도면의 기하 여섯 갈래)' },
  /**
   * ★ 2026-08-02 재분류 — **`open` 이 틀린 전제 위에 서 있었다** ★
   *
   * 옛 노트: *"방 크기·위치가 **현장을 지목하는지** 안 본다."* 재보니 **현장이 가장 큰
   * 방인 사건이 40/44(91%)** 였다 — 숫자는 컸는데 **누설이 아니다.**
   * `proof.ts` §R5 가 못박아뒀다: *"시신이 어디서 나왔는지는 **전제이지 답이 아니다**"*
   * — 사건 개요가 처음부터 현장을 말한다. **공개된 것을 가리키는 것은 누설이 아니다.**
   *
   * 그래서 「전제가 아닌 것」을 흘리는 벡터를 셋 더 재봤고 **전부 0**이었다:
   * ```
   * 트릭의 이탈 방법   창으로 나갔다는 4건 중 「현장에만 창」 0건 (창 있는 방이 87%라 지목이 안 된다)
   * 공개 전 고정물     데이터엔 42건 있으나 App.jsx:3276 이 revealedLocs 로 거른다
   * 방 크기·자리       현장 말고 가리킬 것이 없다 — 범인·트릭과 무관하다
   * ```
   * **평면도가 보여주는 것은 전부 전제이거나 공개 시점으로 걸러진다.**
   * ⚠ 벡터가 새로 생기면(도면이 전제 아닌 것을 그리게 되면) 되살린다.
   */
  { channel: 'plan', invariant: 'leak', status: 'na',
    note: '도면이 말하는 것은 **전부 전제**(현장 — proof.ts §R5)이거나 **앱이 공개 시점으로 거른다**(고정물 — App.jsx:3276). 실측 44건: 「현장에만 창」 0 · 창 있는 방 87%라 지목 불가. ⛳ 다양성(방 크기 쏠림)은 누설이 아니라 **품질**이고 `plan-check` 이 따로 센다' },
  { channel: 'plan', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '9-3' },
    note: '장소 id 가 실재하는가 — §9-3c(고정물이 도면 위에 있나) · §9-3d(보행선의 장소 쌍) · §9-3j(장소가 있는데 평면도가 없다)' },
  { channel: 'plan', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

  // ── 관계도 · 인터루드 · 결말 — 아직 아무도 안 읽는다 ──
  { channel: 'graph', invariant: 'leak', status: 'covered',
    marker: { file: V, text: '9-13. **관계 도식이 범인을 처음부터 그린다**' },
    note: '처음부터 보이는 danger 간선이 범인만 가리키면 오류. ★ MEMORY §오케스트레이터의 「관계 그래프가 답을 그림」이 08-01에 닫혔다 — 산장은 이미 지키고 있었고(전부 게이트) 규칙이 못박히지 않았을 뿐이다' },
  { channel: 'graph', invariant: 'contradiction', status: 'open',
    note: '간선 라벨이 사실·격자와 어긋나는지 안 본다. ⚠ 다만 생성 사건은 간선이 0개라 지금은 잴 것이 없다' },
  /**
   * ★ 08-01에 정정 ★ 처음엔 `open` 으로 적었는데 **§9-5 가 이미 덮고 있었다** —
   * 노드가 없는 인물을 가리키나 · 인물이 도식에서 빠졌나 · 간선 끝점이 실재하나.
   * **표가 자기를 틀리게 말한 네 번째**다. 적기 전에 소스를 봐야 한다.
   */
  { channel: 'graph', invariant: 'wiring', status: 'covered',
    marker: { file: V, text: '9-5. 관계 도식 ↔ 인물·조사 정합' },
    note: '노드·간선 끝점이 실재하는가 · 인물이 하나라도 빠지면 그게 곧 표시다' },
  { channel: 'graph', invariant: 'derivable', status: 'na', note: '답을 묻지 않는다' },

    { channel: 'interlude', invariant: 'contradiction', status: 'brief',
    marker: { file: CS, text: '⑤검열관' },
    note: '★ 08-02 ⑤검열관 ★ 결정론적으로는 못 잰다 — 이 채널은 시각·장소를 **공란/데이터로만** 말하고 글자에는 안 쓴다(실측). 그래서 둘로 나눠 덮는다: **생성 경로**는 `prose-lock` 이 문장 틀 21종을 잠그고, **손저작·산문 왕복 경로**는 `npm run censor` 가 검열 브리프를 만들어 챗봇에 묻는다. ⚠ **LLM 은 경고만 내고 판정은 코드가 한다**(§14) — 인용이 실물에 없으면 기각한다(환각 차단). 그 배선은 `censor-check` 이 게이트에서 문다. ⛔ **자동이 아니다** — 사람 왕복이 필요하므로 `covered` 와 같은 ✓ 로 세지 않는다' },
    { channel: 'interlude', invariant: 'leak', status: 'brief',
    marker: { file: CS, text: '⑤검열관' },
    note: '★ 08-02 ⑤검열관 ★ 결정론적으로는 못 잰다 — 이 채널은 시각·장소를 **공란/데이터로만** 말하고 글자에는 안 쓴다(실측). 그래서 둘로 나눠 덮는다: **생성 경로**는 `prose-lock` 이 문장 틀 21종을 잠그고, **손저작·산문 왕복 경로**는 `npm run censor` 가 검열 브리프를 만들어 챗봇에 묻는다. ⚠ **LLM 은 경고만 내고 판정은 코드가 한다**(§14) — 인용이 실물에 없으면 기각한다(환각 차단). 그 배선은 `censor-check` 이 게이트에서 문다. ⛔ **자동이 아니다** — 사람 왕복이 필요하므로 `covered` 와 같은 ✓ 로 세지 않는다' },
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
  { check: '§9-3f 사망 구간 이름표', why: '어휘 품질 — 「(전반)」이 기계 것이라 진술이 반복 인용하기에 나쁘다. 관측면×불변식이 아니라 팔레트 품질이다' },
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
let briefed = 0
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
    if (cell.status === 'brief') { briefed++; row.push('◑'); 
      if (cell.marker && !read(cell.marker.file).includes(cell.marker.text))
        stale.push(`${ch.label} × ${inv.label} → '${cell.marker.text}' 가 ${cell.marker.file} 에 없다`)
      continue }
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

/** ─── 상용화 게이트 셈 (위 §상용화 게이트 참조) ────────────────── */
const shipAll: Cell[] = []
for (const ch of CHANNELS)
  for (const inv of INVARIANTS) {
    const cell = byKey.get(`${ch.id}|${inv.id}`)
      ?? { channel: ch.id, invariant: inv.id, status: 'open' as const, note: '' }
    if (inShipGate(cell)) shipAll.push(cell)
  }
const shipDone = shipAll.filter((c) => c.status === 'covered')
const shipBrief = shipAll.filter((c) => c.status === 'brief')
const shipLeft = shipAll.filter((c) => c.status !== 'covered' && c.status !== 'brief')
const label = (c: Cell) =>
  `${CHANNELS.find((x) => x.id === c.channel)!.label} × ${INVARIANTS.find((x) => x.id === c.invariant)!.label}`

/**
 * ─────────────────────────────────────────────────────────────
 *  ★ 진짜 역방향 — **검증기의 절이 표 어딘가에 놓였는가** (2026-08-02 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * 위 §양방향은 **한 방향만** 물고 있었다: *"적어놨는데 소스에 없으면 실패."*
 * 반대쪽 — **소스에 있는데 표가 모르는 검사** — 은 아무도 안 봤다.
 *
 * 그래서 값을 치렀다. `§9-3h`(사람을 겨누는 조사에서 범인만 혼자 다르다)는
 * **오류 등급**이고 소지품 150/150 누설을 잡고 만들어진 검사인데, **어느 칸도
 * 표식으로 안 쓰고 있었고** `조사 목록 × 누설` 노트는 *"빈손 여부를 안 본다"* 라고
 * 적어놨다. **이미 있는 검사를 지으러 갈 자리였다.**
 *
 * 이 부류는 **다섯 번째**다 (위 `graph × wiring` 주석의 「네 번째」에 이어서).
 * 네 번을 *"적기 전에 소스를 봐야 한다"* 로 넘겼는데 다섯 번째가 또 나왔으므로
 * **주의가 아니라 기계로 막는다** — `clue-check ③ 배선`과 같은 판단이다.
 *
 * 놓였다고 보는 조건: 절 번호가 **표식·노트·missing·OUTSIDE 어디든** 적혀 있다.
 * 칸에 넣기 애매한 것은 `OUTSIDE` 에 이름을 올리면 된다 — **어디에도 안 적는 것만**
 * 실패다. 「분류할 자리가 없다」가 아니라 **「분류를 안 했다」를 막는 검사다.**
 */
const SECTION_RE = /(?:^|[ */])([0-9]+(?:-[0-9]+[a-z]?)?(?:\.[0-9]+)?)\. \*\*([^*]+)\*\*/gm
const claimedText = [
  ...CELLS.map((c) => [c.marker?.text ?? '', c.note ?? '', c.missing ?? ''].join(' ')),
  ...OUTSIDE.map((o) => `${o.check} ${o.why}`),
].join('\n')

const unplaced: string[] = []
for (const m of read(V).matchAll(SECTION_RE)) {
  const id = m[1]!
  // 정확한 번호로 찾는다 — 접두(9-3)로 느슨하게 맞추면 9-3f 가 9-3b 에 묻어간다
  const token = new RegExp(`(?:^|[^0-9.a-z-])${id.replace(/[.]/g, '\\.')}(?![0-9a-z-])`)
  if (!token.test(claimedText)) unplaced.push(`${id}. ${m[2]!.trim()}`)
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
  // ★ 출시에 필요한 것은 이 줄이다 — 위 전체 비율이 아니다
  console.log(
    `  ★ 상용화 게이트 — 자동 ${shipDone.length} + 브리프 ${shipBrief.length} / ${shipAll.length} ` +
      `· 남은 ${shipLeft.length}칸`,
  )
  if (stale.length) {
    console.log(`\n  ✗ 표식이 소스에 없다 (${stale.length})`)
    for (const s of stale) console.log(`    ${s}`)
    console.log('    → 적어만 두고 안 지었거나, 검사 주석이 바뀌었다\n')
    process.exit(1)
  }
  // ⚠ 이 줄이 없으면 **역방향은 게이트에서 안 돈다** — 손으로 부를 때만 물었다.
  //   드리프트를 막자고 만든 검사가 드리프트하는 자리라 여기가 핵심이다 (2026-08-02)
  if (unplaced.length) {
    console.log(`\n  ✗ 검증기에 있는데 표가 모르는 검사 (${unplaced.length})`)
    for (const s of unplaced) console.log(`    ${s}`)
    console.log('    → 칸의 note·missing 에 절 번호를 적거나, OUTSIDE 에 이름을 올린다\n')
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
console.log(`  ◑ 브리프    ${String(briefed).padStart(2)}       ← 사람 왕복. 자동이 아니다`)
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

console.log(
  `\n  ★★ 상용화 게이트 — ${shipDone.length + shipBrief.length} / ${shipAll.length} ★★`,
)
console.log(`     ✓ 자동    ${String(shipDone.length).padStart(2)}   게이트가 매번 문다`)
console.log(`     ◑ 브리프  ${String(shipBrief.length).padStart(2)}   사람 왕복이 필요하다 (npm run censor)`)
console.log(`     · 남은    ${String(shipLeft.length).padStart(2)}`)
console.log('     ⚠ 브리프는 자동과 **같은 ✓ 로 세지 않는다** — 세면 이 표가 자기를 틀리게 말한다')
console.log('     (누설 축 전부 + 산문 채널의 모순. 여기 없는 칸은 출시 후에 해도 된다)')
if (shipLeft.length) {
  console.log('\n  ── 출시까지 남은 칸 ──')
  for (const c of shipLeft)
    console.log(`    ${c.status === 'partial' ? '◐' : '·'} ${label(c)}`)
}

console.log('\n  ── 이 표 밖 (플레이에서 나온 규칙 — 테스터 몫) ──')
for (const o of OUTSIDE) console.log(`    ${o.check.padEnd(28)} ${o.why}`)

if (stale.length) {
  console.log(`\n  ✗ 표식이 소스에 없다 (${stale.length})`)
  for (const s of stale) console.log(`    ${s}`)
  console.log('    → 적어만 두고 안 지었거나, 검사 주석이 바뀌었다\n')
  process.exit(1)
}
if (unplaced.length) {
  console.log(`\n  ✗ 검증기에 있는데 표가 모르는 검사 (${unplaced.length})`)
  for (const s of unplaced) console.log(`    ${s}`)
  console.log('    → 칸의 note·missing 에 절 번호를 적거나, OUTSIDE 에 이름을 올린다.')
  console.log('      ⚠ 「분류할 자리가 없다」가 아니라 **분류를 안 했다**를 막는 검사다 —')
  console.log('        §9-3h 가 이미 있는데 표는 「안 본다」고 적어두고 있었다\n')
  process.exit(1)
}
console.log('\n  ✓ 찬 칸의 표식이 전부 소스에 있다')
console.log('  ✓ 검증기의 절이 전부 표 어딘가에 놓였다\n')
