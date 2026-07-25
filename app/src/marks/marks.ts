import type { HighlightKind, PlayerAnnotations } from '../state/stores'

/**
 * 진술 마킹 — 드래그로 구절을 골라 네 색 중 하나를 칠한다.
 *
 * **프로토타입 `추리게임.dc.html` 2609~2650행에서 옮겼다.**
 * `_readSel`(문자 오프셋 계산) · `applyHl`(겹침 제거) · `segsFor`(구간 분할)
 * 셋이 이 파일의 전부다.
 *
 * ★ 이것은 게임이 아니라 **플레이어가** 하는 표시다 ★
 * 「모순」 마크가 절대 규칙(모순 경고 금지)에 걸리지 않는 이유가 그것이다.
 * 게임이 "여기가 어긋납니다"라고 말하는 것과, 플레이어가 스스로 그렇게 칠하는
 * 것은 정반대다. 후자가 이 게임이 파는 감각이다.
 *
 * 그래서 **네 색 사이에 위계가 없다.** 「모순」이 「표시」보다 진하거나 크면
 * 그것이 곧 "이쪽이 중요하다"가 된다.
 */

/** 마크 종류와 색. 원본 2642~2643행의 값 그대로 */
export const MARKS: { kind: HighlightKind; bg: string; line: string }[] = [
  { kind: '표시', bg: 'rgba(76,141,255,.30)', line: 'var(--accent)' },
  { kind: '확인', bg: 'rgba(76,183,130,.30)', line: 'var(--g-confirm)' },
  { kind: '의심', bg: 'rgba(242,201,76,.32)', line: 'var(--g-suspect)' },
  { kind: '모순', bg: 'rgba(235,87,87,.30)', line: 'var(--g-contradict)' },
]

const BY_KIND = new Map(MARKS.map((m) => [m.kind, m]))

export type Highlight = PlayerAnnotations['highlights'][number]

export type Segment = { text: string; kind?: HighlightKind }

/** 마크의 선 색. 우측 패널 `표시만` 목록의 레일이 이 색을 쓴다 */
export const markColor = (kind: HighlightKind) => BY_KIND.get(kind)!.line

/** 마크의 화면 스타일. 배경 + 밑선. 원본 2647행 */
export function markStyle(kind: HighlightKind): React.CSSProperties {
  const m = BY_KIND.get(kind)!
  return {
    background: m.bg,
    boxShadow: `inset 0 -2px 0 ${m.line}`,
    borderRadius: 2,
    padding: '0.5px 0',
  }
}

/** 문단을 가리키는 키. 원본은 `pid` + `pi` 두 필드였다 */
export const refOf = (owner: string, paraIndex: number | string) => `${owner}:${paraIndex}`

/**
 * 문단을 마크 구간으로 쪼갠다. 마크가 없으면 통짜 하나.
 *
 * 원본 2644~2649행. 겹치는 마크는 `cur` 로 앞선 것이 이긴다 —
 * `applyHl` 이 겹침을 미리 제거하므로 실제로는 거의 일어나지 않지만,
 * 저장된 데이터가 깨져 있어도 렌더가 무너지지 않아야 한다.
 */
export function segments(text: string, marks: Highlight[]): Segment[] {
  const mine = marks
    .filter((h) => h.range[1] > h.range[0])
    .sort((a, b) => a.range[0] - b.range[0])
  if (!mine.length) return [{ text }]

  const out: Segment[] = []
  let cur = 0
  for (const m of mine) {
    const s = Math.max(cur, m.range[0])
    if (s > cur) out.push({ text: text.slice(cur, s) })
    if (m.range[1] > s) out.push({ text: text.slice(s, m.range[1]), kind: m.kind })
    cur = Math.max(cur, m.range[1])
  }
  if (cur < text.length) out.push({ text: text.slice(cur) })
  return out
}

export type Selection = {
  ref: string
  start: number
  end: number
  text: string
  /** 툴바 위치. 문단 요소 기준 상대 좌표 */
  left: number
  top: number
}

/**
 * 지금 드래그된 구간을 문단 안의 **문자 오프셋**으로 읽는다.
 *
 * 원본 2613~2625행. 핵심은 `Range.selectNodeContents(el)` 후 `setEnd` 하고
 * 길이를 세는 것 — 문단이 이미 마크 때문에 여러 `<span>` 으로 쪼개져 있어도
 * 오프셋이 **원문 기준**으로 나온다. 노드를 세면 마크가 늘 때마다 좌표가 어긋난다.
 */
export function readSelection(el: HTMLElement, ref: string): Selection | null {
  const s = window.getSelection()
  if (!s || s.isCollapsed || !String(s).trim()) return null
  if (!el.isConnected) return null
  if (!s.anchorNode || !s.focusNode) return null
  if (!el.contains(s.anchorNode) || !el.contains(s.focusNode)) return null

  const offset = (node: Node, o: number) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    r.setEnd(node, o)
    return r.toString().length
  }

  const a = offset(s.anchorNode, s.anchorOffset)
  const b = offset(s.focusNode, s.focusOffset)
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  if (end <= start) return null

  const parent = el.getBoundingClientRect()
  let rect = parent
  try {
    rect = s.getRangeAt(0).getBoundingClientRect()
  } catch {
    // 범위를 못 읽으면 문단 기준으로 띄운다. 툴바가 안 뜨는 것보다 낫다
  }

  return {
    ref,
    start,
    end,
    text: String(s),
    left: rect.left - parent.left + rect.width / 2,
    top: rect.top - parent.top,
  }
}

/**
 * 마크를 칠하거나 지운다. 원본 2626~2632행.
 *
 * **겹치는 기존 마크는 먼저 걷어낸다** — 안 그러면 같은 구절에 두 색이 쌓여
 * 어느 쪽이 위인지 렌더 순서가 정한다. `kind` 가 없으면 지우기다.
 */
export function applyMark(
  all: Highlight[],
  sel: Selection,
  kind?: HighlightKind,
): Highlight[] {
  const kept = all.filter(
    (h) => !(h.textRef === sel.ref && h.range[0] < sel.end && h.range[1] > sel.start),
  )
  if (!kind) return kept
  return [...kept, { textRef: sel.ref, range: [sel.start, sel.end], kind }]
}

/** 브라우저 선택을 푼다. 툴바를 닫은 뒤 파란 블록이 남아 있으면 지저분하다 */
export function clearSelection(): void {
  try {
    window.getSelection()?.removeAllRanges()
  } catch {
    // 지원 안 하는 환경이면 그냥 둔다
  }
}
