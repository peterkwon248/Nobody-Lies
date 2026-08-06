/**
 * ─────────────────────────────────────────────────────────────
 *  에필로그 — 「무슨 일이 있었나」를 구조에서 **방출한다** (2026-08-06 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * ## 왜 있나
 *
 * 테스터(전찬웅) 3차: *"정답을 봐도 트릭·동기 납득 안 감"*. 채점 화면이 **답만**
 * 보여주고 **왜 그 답인지**를 안 보여준다. 사건 넷 전부 `epilogue` 데이터가 0이라
 * 「렌더가 없다」가 아니라 **낼 것이 없었다.**
 *
 * ## 무엇을 하나 — 새 산문을 짓지 않는다
 *
 * ⛔ **이 파일은 문장을 창작하지 않는다.** 매니페스토 §가름 축대로 **코드는 사실·구조**
 * 만 낸다. 재료는 전부 이미 있다:
 *
 * ```
 * incident.scene / sceneState   어디서 죽었나
 * culprit.presence ↔ claim      어느 슬롯에서 진실과 주장이 갈리나 = 범행 시각
 * trick.illusions[]             인상 → madeBy(만든 물증) → brokenBy(깨는 물증)
 * trick.exit                    어떻게 빠져나갔나
 * trick.flaw                    트릭의 허점 · 어디에 심겼나
 * facts[]                       동기·기회·수단과 그것을 드러내는 물증
 * ```
 *
 * **문장 조립은 앱이 결정론적으로 한다** — 조립 진술이 이미 그렇게 돈다.
 * 여기서는 **순서와 연결**만 정한다. 그것이 「사슬의 재생」이다.
 *
 * ## ⚠ 파생 데이터라 저작 층이 아니다
 *
 * `_difficulty`·`_oracle` 과 같은 부류다 — **`export-case` 가 붙이고 사건 YAML 에는
 * 없다.** 그래서 §다섯 곳 한 벌(types+schema+to-yaml+generate+방어검사)의 대상이
 * 아니다. 그 규칙은 **사람이 쓰는 필드**가 전달 구간에서 증발하는 것을 막는 것이고,
 * 이건 매 방출마다 다시 계산된다. **방어 검사는 그대로 붙인다**(`cand-check §3`).
 */
import type { Case } from './types.js'

const ko = (x: unknown): string =>
  typeof x === 'string' ? x : ((x as { ko?: string } | undefined)?.ko ?? '')

/**
 * ⛳ `record` 가 붙었다 (2026-08-06) — 비트3 「균열」이 **물증의 기록**을 인용한다.
 * 카드 제목(`description`)이 아니라 관찰문이라야 「작은 곳에서 시작했다」가 뜻을 갖는다.
 */
export type EvidenceRef = { id: string; description: string; record?: string }

/**
 * ─────────────────────────────────────────────────────────────
 *  1막 문장틀 — **데이터로 둔다** (2026-08-06 · 경훈 지시)
 * ─────────────────────────────────────────────────────────────
 *
 * *"틀 문안은 경훈+Claude 큐로 넘어올 수 있게 틀을 데이터로 분리해둬라."*
 * 코드를 안 열고 문안만 갈아 끼울 수 있어야 한다. **자유 작문을 하지 않는다** —
 * 값이 들어갈 자리(`{…}`)만 있고 나머지는 고정 문안이다.
 *
 * ⚠ 이 문안은 **잠정**이다. 화면이 그렇게 표기한다(트릭 붕괴 인터루드 선례).
 */
export const ACT1_TEMPLATES = {
  ko: {
    /* ── 비트1 장면 (기) ── 척추. 피해자 이름·발견 장소 둘 다 10/10 */
    scene: '{victim|이/가} {foundPlace}에서 발견됐다. 이야기는 그보다 몇 시간 앞에서 시작한다.',
    sceneMoved: '{victim|이/가} {foundPlace}에서 발견됐다. 그러나 일이 벌어진 곳은 거기가 아니었다 — 이야기는 몇 시간 앞, 다른 방에서 시작한다.',

    /* ── 비트2 인상의 세계 (승) ── 인상은 여럿일 수 있고, 「만들어 둔 이야기」는 한 번만 */
    impression: '그날의 현장은 한 가지 이야기를 하고 있었다 — 「{impression}」.',
    /**
     * 인상이 둘 이상이면 **한 문장으로 묶는다** (2026-08-06 · 경훈 확정).
     * 산장은 인상이 셋이라 같은 문장이 세 번 반복됐다 — 묶으면 한 줄이 된다.
     */
    impressions: '그날의 현장은 이런 이야기들을 하고 있었다 — {list}.',
    staged: '{culprit|이/가} 그렇게 읽히도록 만들어 둔 이야기였다.',
    /** 곁가지 — 위장물이 없으면 이 절만 빠지고 위 둘은 남는다 */
    stagedBy: '{stagingEvidence|은/는} 그 이야기를 위해 놓였다.',

    /* ── 비트3 균열 (전) ── */
    crack: '균열은 작은 곳에서 시작했다. {brokenByRecord}',
    question: '질문은 하나로 좁혀졌다. {flawText}',

    /* ── 비트4 진실의 재생 (결) ── */
    truth: '{murderTime}, {culprit|은/는} {claimedPlace}에 있지 않았다. {truePlace}에 있었다.',
    /** 곁가지 — 거짓말이 **첫 칸**에 난 사건은 앞 칸이 없다(실측 2/14) */
    /**
     * ⚠ **`{afterPlace}로` 라고 쓰면 「다인의 방로」가 나온다** (2026-08-06 실측 —
     * 초안 문안 그대로 넣었다가 산장에서 바로 났다). 이 파일 머리말이 경고하는
     * 바로 그 부류다: **문장을 만드는 쪽마다 조사가 필요하다.**
     */
    gap: '{beforeTime} {beforePlace}에서, {afterTime}에는 다시 {afterPlace|으로/로} — 그 사이가 비어 있었다.',
    /**
     * ★ 앞뒤 칸이 **같은 장소**면 「…에서, 다시 …로」의 대비가 죽는다 ★
     * (2026-08-06 · 경훈 확정) `body_moved` 는 t0·t2 가 둘 다 hall 이라 **구조적으로**
     * 늘 그렇게 나온다 — 문안 취향이 아니라 **갈래 누락**이었다.
     * ⛳ 새 주장이 0이다: 두 앵커는 진실이고, 「그 사이」가 거짓의 자리라는 것은
     * 바로 위 `truth` 가 이미 말했다.
     */
    gapSame: '{beforeTime}에도, {afterTime}에도 {place}에 있었다 — 문제는 그 사이였다.',
    /** 곁가지 — `trick.exit.method` 는 6/14 */
    exit: '그리고 {exitMethod}.',
    murder: '사건은 그 방에서, 그 시각에 일어났다.',
    /**
     * ⚠ **시신을 옮긴 사건은 「그 방」이 두 곳을 가리킨다** (2026-08-06 실측 · `gen-4`).
     * 비트1이 *"방에서 발견됐다 — 그러나 거기가 아니었다"* 라고 말해둔 상태에서
     * 「그 방」이 나오면 **비트1을 뒤집어 읽을 수 있다.** 그래서 이 갈래만 장소를
     * 명시한다. ⛳ 새 주장을 더하지 않는다 — `truth` 가 이미 말한 곳을 되풀이할 뿐이다.
     */
    murderMoved: '사건은 {truePlace}에서, 그 시각에 일어났다.',

    /* ── 비트5 동기 (코다) ── */
    motive: '{background}. {trigger}. {resolve}. 기록에 적힌 동기는 「{label}」 — 짧은 말로 줄이면 그랬다.',
    /** 세 칸이 없을 때. 옛 팔레트·미저작 사건이 여기로 온다 */
    motiveShort: '이유는 기록에 「{label}」{^label|이라고/라고} 남았다.',

    provisional: '※ 이 재구성의 문안은 잠정입니다',
  },
  en: {
    scene: '{victim} was found at {foundPlace}. The story begins a few hours earlier.',
    sceneMoved: '{victim} was found at {foundPlace} — but that is not where it happened. The story begins a few hours earlier, in another room.',

    impression: 'The scene told one story that day — “{impression}”.',
    impressions: 'The scene told several stories that day — {listEn}.',
    staged: '{culprit} had arranged for it to read that way.',
    stagedBy: '{stagingEvidence} was placed to serve that story.',

    crack: 'The crack started somewhere small. {brokenByRecord}',
    question: 'It came down to a single question. {flawText}',

    truth: '{murderTime}: {culprit} was not at {claimedPlace}, but at {truePlace}.',
    gap: '{beforeTime} at {beforePlace}, and by {afterTime} back at {afterPlace} — the hours between are missing.',
    gapSame: 'At {beforeTime} and again at {afterTime}, at {place} — the hours between are the question.',
    exit: 'And then: {exitMethod}.',
    murder: 'It happened in that room, at that hour.',
    murderMoved: 'It happened at {truePlace}, at that hour.',

    motive: '{background}. {trigger}. {resolve}. The record calls the motive “{label}” — that is the short of it.',
    motiveShort: 'The record puts the reason down as “{label}”.',

    provisional: '※ Provisional wording',
  },
} as const

type Act1Kind =
  | 'scene' | 'sceneMoved'
  | 'impression' | 'impressions' | 'staged' | 'stagedBy'
  | 'crack' | 'question'
  | 'truth' | 'gap' | 'gapSame' | 'exit' | 'murder' | 'murderMoved'
  | 'motive' | 'motiveShort'

type Act1Line = { kind: Act1Kind; ko: string; en: string }

/**
 * 받침이 있나 — 조사를 고르는 데 쓴다.
 *
 * ⛔ **없으면 「잠금를」·「소문였다」가 나온다** (2026-08-06 실측). 앱에는
 * `particle()`·`batchim()` 이 진작 있는데 엔진에는 없어서, 문장틀이 엔진으로
 * 내려온 순간 같은 결함이 재발했다. **문장을 만드는 쪽마다 이것이 필요하다.**
 */
const jongseong = (w: string): number => {
  const s = (w || '').trim()
  if (!s) return 0
  const ch = s.charCodeAt(s.length - 1)
  if (ch < 0xac00 || ch > 0xd7a3) return 0
  return (ch - 0xac00) % 28
}
const hasBatchim = (w: string): boolean => jongseong(w) > 0
/** ㄹ 받침. 종성 인덱스 8 */
const RIEUL = 8

/**
 * `{값|을/를}` 꼴을 받침에 맞춰 고른다. 앞쪽이 받침 있을 때 쓰는 조사다.
 * 값 자리는 `{키}`, 조사는 `{키|은/는}` 처럼 쓴다.
 *
 * ★ **`{^키|A/B}` — 조사만** (2026-08-06). 값은 안 찍고 조사만 고른다.
 * `「{label}」{^label|이라고/라고}` 처럼 **값과 조사 사이에 따옴표가 끼는** 자리에
 * 필요하다. 이게 없으면 문안이 `「{label}」{이라고/라고}` 로 적히는데, 키가
 * `\w+` 라 한글 조사는 매치가 안 돼 **치환이 안 된 채 화면에 나간다**
 * (`cand-check §3` 이 그 부류를 문다 — 여기서 미리 막는다).
 */
const fill = (tpl: string, vals: Record<string, string>) =>
  tpl.replace(/\{(\^?)(\w+)(?:\|([^/}]+)\/([^}]+))?\}/g, (_, only, k, withB, withoutB) => {
    const v = vals[k] ?? ''
    if (withB === undefined) return only ? '' : v
    /**
     * ★ **ㄹ 받침 예외** ★ (2026-08-06 실측) 「으」로 시작하는 조사(으로 · 으로서 ·
     * 으며)는 **ㄹ 받침 뒤에서 「으」가 빠진다** — 「홀으로」가 아니라 「홀로」다.
     * 받침 유무만 보면 이것을 놓친다: 초안 문안을 그대로 넣었더니 생성 6건 중
     * 넷이 「홀으로」, 손저작 하나가 「1층 화장실으로」였다.
     *
     * ⛳ **꼴로 알아낸다** — `withB` 가 「으」+`withoutB` 면 그 부류다. 이라고/라고
     * 처럼 「이」가 빠지는 짝에는 이 예외가 없으므로 건드리면 안 된다.
     */
    const j = jongseong(v)
    const dropsEu = withB.startsWith('으') && withB.slice(1) === withoutB
    const particle = j > 0 && !(dropsEu && j === RIEUL) ? withB : withoutB
    return only ? particle : v + particle
  })

export type Epilogue = {
  /** 현장 */
  scene: { location: string; label: string; state: string }
  /** 범인 */
  culprit: { id: string; name: string }
  /**
   * 거짓말이 난 자리. **이것이 범행 시각이다** — 진실 동선과 주장이 갈리는 슬롯.
   * 자백형 사건(주장이 없음)이면 `null` 이고, 그때는 현장에 있던 슬롯을 쓴다.
   */
  lie: { slot: string; slotLabel: string; claimed: string; claimedLabel: string; actual: string; actualLabel: string } | null
  /** 트릭이 만든 인상과 그것을 깨는 물증 */
  illusions: { impression: string; madeBy: EvidenceRef[]; brokenBy: EvidenceRef[] }[]
  /** 어떻게 빠져나갔나 */
  exit: { method: string; enabledBy: EvidenceRef[]; brokenBy: EvidenceRef[] } | null
  /** 트릭의 허점 — 플레이어가 물었어야 할 질문 */
  flaw: { text: string; plantedIn: string[] } | null
  /** 동기·기회·수단과 그것을 드러내는 물증 */
  facts: { kind: string; subject: string; subjectName: string; content: string; revealedBy: EvidenceRef[] }[]
  /**
   * 1막 — 그날의 재구성. **슬롯 순서대로** 편 문장이다.
   * 값은 전부 구조에서 왔고 문안은 `ACT1_TEMPLATES` 다(잠정).
   */
  act1: { lines: Act1Line[]; provisionalKo: string; provisionalEn: string }
}

export function buildEpilogue(c: Case): Epilogue {
  const evById = new Map((c.evidence ?? []).map((e) => [e.id, e]))
  const ref = (ids: readonly string[] | undefined): EvidenceRef[] =>
    (ids ?? [])
      .map((id) => {
        const e = evById.get(id)
        return e
          ? { id, description: ko(e.description) || id, ...(ko(e.record) ? { record: ko(e.record) } : {}) }
          : { id, description: id }
      })
      // 참조가 있는데 대상이 비면 조용하다 — 그 부류를 여기서 만들지 않는다
      .filter((x) => x.description)

  const nameOf = (id: string) =>
    ko(c.people.find((p) => p.id === id)?.name) ||
    (c.victim === id ? ko(c.victimProfile?.name) : '') ||
    id
  const locLabel = (id: string) => (c.locations ?? []).find((l) => l.id === id)?.label ?? id
  const slotLabel = (id: string) => (c.slots ?? []).find((s) => s.id === id)?.label ?? id

  const culprit = c.people.find((p) => p.id === c.culprit)

  /**
   * ★ 거짓말이 난 슬롯을 찾는다 ★ 진실 `presence` 와 주장 `claim` 이 갈리는 칸이
   * **범인이 감추려 한 시각**이다. 검증기가 「거짓말은 범인만, 그리고 하나」를 이미
   * 강제하므로 첫 불일치가 곧 그 자리다.
   */
  let lie: Epilogue['lie'] = null
  if (culprit?.claim?.length && culprit.presence?.length) {
    const claimAt = new Map(culprit.claim.map((x) => [x.slot, x.location]))
    for (const p of culprit.presence) {
      const said = claimAt.get(p.slot)
      if (said && said !== p.location) {
        lie = {
          slot: p.slot,
          slotLabel: slotLabel(p.slot),
          claimed: said,
          claimedLabel: locLabel(said),
          actual: p.location,
          actualLabel: locLabel(p.location),
        }
        break
      }
    }
  }

  const t = c.trick

  /**
   * ★ 1막 — 범인의 **진실 동선**을 슬롯 순서대로 편다 ★
   *
   * ⛳ **없는 사실을 만들지 않는다.** 「사건은 여기서 일어났다」는 그 칸의 장소가
   * `incident.scene` 과 **같을 때만** 붙는다. 「나중에 …라고 말했다」는 그 칸이
   * 거짓말이 난 칸일 때만. 위장·퇴장·동기는 데이터가 있을 때만 한 줄씩 붙는다.
   *
   * ⚠ 슬롯 순서는 `c.slots` 가 정본이다 — `presence` 배열 순서를 믿지 않는다
   * (사건마다 저작 순서가 다를 수 있고, 그러면 시간이 뒤섞인다).
   */
  const slotOrder = new Map((c.slots ?? []).map((s, i) => [s.id, i]))
  const lines: Act1Line[] = []
  const TK = ACT1_TEMPLATES.ko
  const TE = ACT1_TEMPLATES.en
  const culpritName = nameOf(c.culprit)

  const walk = [...(culprit?.presence ?? [])].sort(
    (a, b) => (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0),
  )
  /** 한 줄 = 한 문장. 틀 하나가 ko·en 을 같이 낸다 — 한쪽만 비는 것을 막는다 */
  const say = (kind: Act1Kind, vals: Record<string, string>) =>
    lines.push({ kind, ko: fill(TK[kind], vals), en: fill(TE[kind], vals) })

  /* ── 비트1 장면 (기) ─────────────────────────────────────────────
   * ⛔ **범인이 발견 장소에 한 번도 안 가는 사건이 있다** (`body_moved` — 시신을
   * 옮긴 트릭이라 그것이 옳다). 전에는 「atScene 줄이 안 생겼으면」으로 뒤늦게
   * 알아냈는데, 이제 **동선에 현장이 있나**를 직접 묻는다.
   * ⛳ **죽인 곳을 추론하지 않는다** — 데이터에 없다. 「거기가 아니었다」까지만. */
  const scene = c.incident?.scene ?? ''
  const victimName = ko(c.victimProfile?.name) || c.incident?.subject || ''
  const isMoved = !!scene && !walk.some((p) => p.location === scene)
  if (victimName && scene) {
    say(isMoved ? 'sceneMoved' : 'scene', { victim: victimName, foundPlace: locLabel(scene) })
  }

  /* ── 비트2 인상의 세계 (승) ───────────────────────────────────────
   * 인상 문장만 반복하고 「만들어 둔 이야기」는 **한 번**이다 (경훈 초안).
   * 여럿일 때 매번 붙이면 범인이 같은 말을 세 번 하는 꼴이 된다. */
  const illusions = (t?.illusions ?? []).filter((il) => ko(il.impression))
  if (illusions.length === 1) {
    say('impression', { impression: ko(illusions[0]!.impression) })
  } else if (illusions.length > 1) {
    // 여럿이면 한 문장으로 묶는다 — 산장이 같은 문장을 세 번 말하던 자리다
    const xs = illusions.map((il) => ko(il.impression))
    say('impressions', {
      list: xs.map((x) => `「${x}」`).join(' · '),
      listEn: xs.map((x) => `“${x}”`).join(' · '),
    })
  }
  if (illusions.length) {
    say('staged', { culprit: culpritName })
    /**
     * 곁가지 — **위장물**. `trick.staging` 이 정본이고, 없으면 인상을 만든 물건
     * (`madeBy`)으로 내려간다. 둘 다 없으면 **이 절만** 빠진다.
     */
    const staging = ref(t?.staging).concat(illusions.flatMap((il) => ref(il.madeBy)))
    const names = [...new Set(staging.map((x) => x.description))].filter(Boolean)
    if (names.length) say('stagedBy', { stagingEvidence: names.join(' · ') })
  }

  /* ── 비트3 균열 (전) ─────────────────────────────────────────────
   * 인용은 **카드 제목이 아니라 기록**이다. 「작은 곳에서 시작했다」 다음에
   * 「문과 틀 사이의 틈…」이 와야 뜻이 서고, 「잠금장치」가 오면 안 선다. */
  const brokenRecord = illusions.flatMap((il) => ref(il.brokenBy)).map((x) => x.record).find(Boolean)
  if (brokenRecord) say('crack', { brokenByRecord: brokenRecord })
  if (t?.flaw?.text) say('question', { flawText: ko(t.flaw.text) })

  /* ── 비트4 진실의 재생 (결) ───────────────────────────────────────
   * ★ **범행 문장은 여기 한 번뿐이다** ★ 전에는 현장에 머무는 **칸마다** 붙어서
   * 산장이 「사건은 여기서 일어났다」를 두 번 말했다. 범행 시각은 **거짓말이 난
   * 칸**(`lie.slot`) 하나다 — 그래서 비트4 안으로 들어왔다. */
  if (lie) {
    say('truth', {
      murderTime: lie.slotLabel, culprit: culpritName,
      claimedPlace: lie.claimedLabel, truePlace: lie.actualLabel,
    })
    /**
     * 곁가지 — 앞뒤 칸. **거짓말이 첫 칸에 난 사건은 앞이 없다**(실측 2/14).
     * 경훈 초안에는 곁가지 표시가 없었지만 값이 없으면 문장이 설 수 없다.
     */
    const li = walk.findIndex((p) => p.slot === lie.slot)
    const before = li > 0 ? walk[li - 1] : undefined
    const after = li >= 0 && li < walk.length - 1 ? walk[li + 1] : undefined
    if (before && after) {
      // 앞뒤가 같은 곳이면 대비가 죽는다 — 갈래를 갈아 끼운다 (§gapSame)
      if (before.location === after.location) {
        say('gapSame', {
          beforeTime: slotLabel(before.slot), afterTime: slotLabel(after.slot),
          place: locLabel(before.location),
        })
      } else {
        say('gap', {
          beforeTime: slotLabel(before.slot), beforePlace: locLabel(before.location),
          afterTime: slotLabel(after.slot), afterPlace: locLabel(after.location),
        })
      }
    }
  }
  /** 곁가지 — 퇴장 방법 */
  if (t?.exit?.method) say('exit', { exitMethod: ko(t.exit.method) })
  // 「그 방에서, 그 시각에」는 위 truth 를 가리킨다. 그것이 없으면 가리킬 곳이 없다
  if (lie) say(isMoved ? 'murderMoved' : 'murder', { truePlace: lie.actualLabel })

  /* ── 비트5 동기 (코다) ───────────────────────────────────────────
   * 세 칸이 다 차면 인과로, 아니면 짧은 폴백으로. `label`(= `content`)은 언제나
   * 짧은 명사구다 — 「동기」 공란의 답이자 확보 단어라서다. */
  const motiveFact = (c.facts ?? []).find((f) => f.kind === 'motive' && f.subject === c.culprit)
  if (motiveFact) {
    const s = motiveFact.story
    const label = ko(motiveFact.content)
    if (s?.background && s?.trigger && s?.resolve) {
      say('motive', { background: s.background, trigger: s.trigger, resolve: s.resolve, label })
    } else {
      say('motiveShort', { label })
    }
  }

  return {
    act1: { lines, provisionalKo: TK.provisional, provisionalEn: TE.provisional },
    scene: {
      location: c.incident?.scene ?? '',
      label: locLabel(c.incident?.scene ?? ''),
      state: ko(c.incident?.sceneState),
    },
    culprit: { id: c.culprit, name: nameOf(c.culprit) },
    lie,
    illusions: (t?.illusions ?? []).map((il) => ({
      impression: ko(il.impression),
      madeBy: ref(il.madeBy),
      brokenBy: ref(il.brokenBy),
    })),
    exit: t?.exit
      ? { method: ko(t.exit.method), enabledBy: ref(t.exit.enabledBy), brokenBy: ref(t.exit.brokenBy) }
      : null,
    flaw: t?.flaw ? { text: ko(t.flaw.text), plantedIn: (t.flaw.plantedIn ?? []).map(nameOf) } : null,
    facts: (c.facts ?? []).map((f) => ({
      kind: f.kind,
      subject: f.subject,
      subjectName: nameOf(f.subject),
      content: ko(f.content),
      revealedBy: ref(f.revealedBy),
    })),
  }
}
