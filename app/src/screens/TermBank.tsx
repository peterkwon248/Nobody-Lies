import { useState } from 'react'
import type { Case } from '@engine/types'
import { ko } from '../case/loadCase'
import type { PlayerAnnotations } from '../state/stores'

/**
 * 확보 단어 은행 — 보고서 오른쪽에 붙는 292px 패널.
 *
 * **프로토타입 `추리게임.dc.html` 311~321행(은행) · 1141~1159행(다이얼로그)에서 옮겼다.**
 * 이 패널이 통째로 빠져 있었고, 그래서 보고서가 단일 컬럼이었다 —
 * 원본은 좌우 2단이고 오른쪽 절반이 이것이다 (2026-07-25 전수 대조에서 발견).
 *
 * ★ 여기가 유용도를 누설하기 가장 쉬운 자리다 ★
 * 결정적 단어와 레드 헤링이 **완전히 동일하게** 생겨야 한다. 칩의 유일한 상태
 * 차이는 「이미 어딘가 답으로 쓴 것」뿐이고, 그건 플레이어 자신의 행동이다.
 */

/** 원본 `ICONS`(1516행). 없는 단어는 네모 — 아이콘 유무가 신호가 되지 않도록 */
const ICONS: Record<string, string> = {
  '테이프': 'M3 6h10v4H3z M5 6l6 4',
  '연탄': 'M4 4h8v8H4z M6.5 4v8 M9.5 4v8 M4 6.5h8 M4 9.5h8',
  '일산화탄소 중독': 'M8 13c3 0 4-2 4-4 0-3-4-6-4-6S4 6 4 9c0 2 1 4 4 4z',
  '유서': 'M4 2.5h6l2.5 2.5v9H4z M9.5 2.5v3H12 M6 8h4 M6 10.5h4',
  '김선생': 'M8 8.5a2 2 0 100-4 2 2 0 000 4z M4 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5',
  '마약': 'M6 4h4v2l-1 5H7L6 6z M6.5 6h3',
  '폭로 임박': 'M8 2v6 M8 11v.5 M2.5 13l5.5-9 5.5 9z',
  '별채 대포폰': 'M5 2.5h6v11H5z M7 12h2 M3 5l1-1',
  '치정': 'M8 12.5S3.5 9.8 3.5 6.8A2.3 2.3 0 018 5.6a2.3 2.3 0 014.5 1.2c0 3-4.5 5.7-4.5 5.7z',
  '영수증': 'M4 2.5h8v11l-1.3-1-1.4 1-1.3-1-1.4 1-1.3-1L4 13.5z M6 6h4 M6 8.5h4',
  '물자국': 'M8 3.5c2 2.5 3 4 3 5.3a3 3 0 11-6 0c0-1.3 1-2.8 3-5.3z',
}

/** 원본 `termIconPath(w)` — 없는 단어는 네모. 상황판 물증 카드도 같은 것을 쓴다 */
export const iconOf = (word: string) => ICONS[word] ?? 'M4 4h8v8H4z'

export function TermBank({
  c,
  terms,
  answers,
  notes,
  onQuote,
}: {
  c: Case
  /** 지금 손에 있는 확보 단어. 엔진 `deriveTerms` 의 결과 */
  terms: Set<string>
  answers: Record<string, string>
  /** 단어 다이얼로그의 메모 개수 배지에 쓴다 */
  notes: PlayerAnnotations['notes']
  /** 인용문과 **어느 단어에서 나왔는지**. 메모가 그 단어를 대상으로 잡는다 */
  onQuote: (quote: string, term: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const words = [...terms].sort()
  // 이미 답으로 쓴 단어. **플레이어 자신의 행동**이라 누설이 아니다
  const used = new Set(Object.values(answers))

  return (
    <aside className="nl-bank">
      <div className="nl-bank-head">
        <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="var(--fg-3)" strokeWidth="1.4">
          <rect x="2.5" y="4" width="11" height="8.5" rx="1.2" />
          <path d="M2.5 6.5h11" />
        </svg>
        <span className="v-caption" style={{ color: 'var(--fg-2)' }}>확보 단어</span>
      </div>
      <div className="v-micro nl-bank-hint">
        흉기·동기처럼 조사로 발견해야 하는 열린 후보가 여기 모입니다.
      </div>

      {words.length === 0 && (
        <div className="nl-bank-empty">
          아직 공개된 단어가 없습니다. 장을 확인하면 조사로 드러난 단어가 추가됩니다.
        </div>
      )}

      <div className="nl-bank-words">
        {words.map((w) => (
          <span
            key={w}
            className={used.has(w) ? 'nl-word nl-word-used' : 'nl-word'}
            onClick={() => setOpen(w)}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flex: 'none', opacity: 0.7 }}>
              <path d={iconOf(w)} />
            </svg>
            {w}
          </span>
        ))}
      </div>

      {open && (
        <TermDialog c={c} word={open} notes={notes} onClose={() => setOpen(null)} onQuote={onQuote} />
      )}
    </aside>
  )
}

/**
 * 확보 단어 다이얼로그 — 원본 1141~1159행.
 * 두 줄뿐이다: 어디서 나왔나 · 무엇이었나. **뜻은 적지 않는다**
 *
 * 은행의 칩과 **조사 기록 카드**(원본 572행 `e.onOpen`) 둘 다 이것을 연다.
 */
export function TermDialog({
  c,
  word,
  notes,
  onClose,
  onQuote,
}: {
  c: Case
  word: string
  /** 이 단어를 대상으로 쓴 메모. 개수만 배지로 보인다 (원본 2109행 `mc`) */
  notes?: PlayerAnnotations['notes']
  onClose: () => void
  onQuote: (quote: string, term: string) => void
}) {
  const info = c.terms?.find((t) => t.word === word)
  const memoCount = (notes ?? []).filter(
    (n) => n.targetType === '물증' && n.target === word,
  ).length

  return (
    <div className="nl-scrim" onClick={onClose}>
      <div className="nl-dlg" onClick={(e) => e.stopPropagation()}>
        <div className="nl-dlg-head">
          <span className="nl-dlg-icon">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="var(--fg-2)" strokeWidth="1.4">
              <path d={iconOf(word)} />
            </svg>
          </span>
          <div className="v-ui nl-dlg-title">{word}</div>
          {/* 원본 1147행 — 이 단어에 메모를 몇 개 달았나. **개수뿐이다** ·
              내용은 메모장에서 본다. 없으면 배지 자체가 안 뜬다 */}
          {memoCount > 0 && (
            <span className="nl-dlg-memos">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" />
              </svg>
              {memoCount}
            </span>
          )}
          <span className="iconbtn" onClick={onClose} style={{ flex: 'none' }}>✕</span>
        </div>
        <div className="nl-dlg-body">
          <Line k="발견" v={ko(info?.source) || '—'} />
          <Line k="기록" v={ko(info?.note) || '—'} />
        </div>
        <div className="nl-dlg-foot">
          <span
            className="linklike nl-dlg-quote"
            /* 인용문은 기록 그 자체다. 단어는 메모의 **대상**으로 붙으므로
               문장에 다시 적지 않는다 (원본 `quoteTermToMemo`) */
            onClick={() => { onQuote(ko(info?.note) || word, word); onClose() }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h5v4l-2 -1.2L5 8V4z" />
              <path d="M4 12h8" />
            </svg>
            메모에 인용
          </span>
        </div>
      </div>
    </div>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="nl-dlg-line">
      <div className="nl-dlg-k">{k}</div>
      <div className="v-body nl-dlg-v">{v}</div>
    </div>
  )
}
