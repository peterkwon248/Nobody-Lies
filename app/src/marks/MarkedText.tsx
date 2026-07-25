import { useRef, useState } from 'react'
import type { HighlightKind } from '../state/stores'
import {
  MARKS, applyMark, clearSelection, markStyle, readSelection, segments,
  type Highlight, type Selection,
} from './marks'

/**
 * 마킹 가능한 문단. 원본 349~360행(진술) · 827행(개요)이 같은 구조를 쓴다.
 *
 * 드래그하면 선택 툴바가 뜨고, 네 색 중 하나를 고르거나 지우거나
 * 인용·복사할 수 있다. 툴바는 **선택 구간 바로 위**에 뜬다.
 */
export function MarkedText({
  text,
  textRef,
  highlights,
  onMark,
  onQuote,
  className,
}: {
  text: string
  /** 이 문단의 키. `refOf(owner, index)`. **`ref` 라고 부르지 않는다** —
      React 19 는 함수 컴포넌트의 `ref` 를 여전히 특수 취급한다 */
  textRef: string
  highlights: Highlight[]
  onMark: (next: Highlight[]) => void
  /** 인용 → 메모. 없으면 인용 버튼이 안 뜬다 */
  onQuote?: (quote: string) => void
  className?: string
}) {
  const el = useRef<HTMLParagraphElement>(null)
  const [sel, setSel] = useState<Selection | null>(null)

  const mine = highlights.filter((h) => h.textRef === textRef)
  const parts = segments(text, mine)

  // 브라우저가 선택을 확정한 뒤에 읽어야 한다 — mouseup 시점에는 아직 비어 있다
  const onMouseUp = () => {
    const node = el.current
    if (!node) return
    setTimeout(() => setSel(readSelection(node, textRef)), 0)
  }

  const finish = (next?: Highlight[]) => {
    if (next) onMark(next)
    setSel(null)
    clearSelection()
  }

  return (
    <p ref={el} className={className ?? 'nl-mk-p'} onMouseUp={onMouseUp}>
      {parts.map((p, i) => (
        <span key={i} style={p.kind ? markStyle(p.kind) : undefined}>{p.text}</span>
      ))}

      {sel && (
        <span
          className="nl-seltb"
          style={{ left: sel.left, top: sel.top }}
          // 툴바를 누를 때 문단의 mouseup 이 다시 돌면 선택이 비어 툴바가 닫힌다
          onMouseUp={(e) => e.stopPropagation()}
        >
          <span className="nl-seltb-inner">
            {MARKS.map((m) => (
              <MarkButton
                key={m.kind}
                kind={m.kind}
                color={m.line}
                onPick={() => finish(applyMark(highlights, sel, m.kind))}
              />
            ))}
            <span
              className="nl-seltb-x"
              title="표시 지우기"
              onClick={() => finish(applyMark(highlights, sel))}
            >
              ✕
            </span>
            {onQuote && (
              <>
                <span className="nl-seltb-sep" />
                <span
                  className="nl-seltb-icon"
                  title="메모에 인용"
                  onClick={() => { onQuote(sel.text); finish() }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M5 4H3v3h2V4zM5 4c0 2-.5 3-2 3.5M11 4H9v3h2V4zM11 4c0 2-.5 3-2 3.5" />
                  </svg>
                </span>
              </>
            )}
            <span
              className="nl-seltb-icon"
              title="텍스트 복사"
              onClick={() => { void navigator.clipboard?.writeText(sel.text); finish() }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="5" y="5" width="8" height="8" rx="1" />
                <path d="M3 10V3h7" />
              </svg>
            </span>
          </span>
        </span>
      )}
    </p>
  )
}

/** 네 버튼은 완전히 같게 생긴다 — 색만 다르다. 크기 차이는 곧 위계다 */
function MarkButton({
  kind, color, onPick,
}: {
  kind: HighlightKind
  color: string
  onPick: () => void
}) {
  return (
    <span className="nl-seltb-mark" style={{ color }} onClick={onPick}>
      <span className="nl-seltb-swatch" style={{ background: color }} />
      {kind}
    </span>
  )
}
