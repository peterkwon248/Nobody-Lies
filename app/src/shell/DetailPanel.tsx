import { useState } from 'react'
import type { Action, Case } from '@engine/types'
import { ko } from '../case/loadCase'
import type { CaseProgress, PlayerAnnotations } from '../state/stores'
import { kindOf } from '../case/investigation'
import { initialOf, personColor } from '../case/people'
import { markColor, markStyle, refOf, segments, type Highlight } from '../marks/marks'

/**
 * 우측 디테일 패널 — **교차 참조**.
 *
 * 프로토타입의 토글 버튼 이름이 `crossRef` 인 것이 이 패널의 정체다. 보고서를 쓰면서
 * 오른쪽에서 진술을 확인하는 것 — 그 동시 참조가 이 게임의 핵심 동작이고,
 * `HANDOFF-TO-CODE.md` §8.1 이 1차 범위에 명시해뒀다.
 *
 * **프로토타입 936~975행을 읽고 옮겼다.** 탭 셋: 진술 / 조사 기록 / 메모.
 *
 * 한때 여기가 「이름 + 문단」과 「인물별 메모 한 줄」뿐이었다. 아바타·preview·
 * chevron·세그먼트 렌더·`표시만` 토글·메모 탭 전체가 빠져 있었다
 * (2026-07-25 전수 대조).
 */

type Tab = 'statements' | 'invlog' | 'memo'

export function DetailPanel({
  c,
  progress,
  annotations,
  onClose,
  onAddMemo,
  onEditMemo,
  onDeleteMemo,
  editing,
  onEditing,
}: {
  c: Case
  /** 조사 기록 탭이 본다 */
  progress: CaseProgress
  annotations: PlayerAnnotations
  onClose: () => void
  onAddMemo: () => void
  onEditMemo: (id: string, content: string) => void
  onDeleteMemo: (id: string) => void
  /**
   * 편집 중인 메모. **메모장과 같은 값을 본다** — 원본이 `editMemoId` 하나를
   * 둘이 나눠 쓴다. 여기서 편집을 열고 메모장으로 건너가면 그 메모가 열려 있다
   */
  editing: string | null
  onEditing: (id: string | null) => void
}) {
  const [tab, setTab] = useState<Tab>('statements')

  return (
    <aside className="nl-right">
      <div className="nl-right-tabs">
        {([
          ['statements', '진술'],
          ['invlog', '조사 기록'],
          ['memo', '메모'],
        ] as [Tab, string][]).map(([id, label]) => (
          <div
            key={id}
            className={tab === id ? 'nl-right-tab nl-right-tab-on' : 'nl-right-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </div>
        ))}
        <span className="iconbtn nl-right-close" onClick={onClose}>✕</span>
      </div>

      <div className="nl-right-body">
        {tab === 'statements' && <StatementsTab c={c} highlights={annotations.highlights} />}
        {tab === 'invlog' && <InvLogTab c={c} progress={progress} />}
        {tab === 'memo' && (
          <MemoTab
            annotations={annotations}
            onAdd={onAddMemo}
            onEdit={onEditMemo}
            onDelete={onDeleteMemo}
            editing={editing}
            onEditing={onEditing}
          />
        )}
      </div>
    </aside>
  )
}

/**
 * 진술 탭 — 인물별 아코디언 + `표시만` 토글.
 *
 * `표시만` 은 **하이라이트한 구절만** 보여준다. 진술 화면에서 드래그로 칠한 것이
 * 여기 모이므로, 보고서를 쓰면서 자기가 짚어둔 것만 훑을 수 있다.
 */
function StatementsTab({ c, highlights }: { c: Case; highlights: Highlight[] }) {
  const [open, setOpen] = useState<string | null>(c.people[0]?.id ?? null)
  const [marksOnly, setMarksOnly] = useState(false)

  return (
    <>
      {/* 원본 945행 — 우상단 토글. 켜면 accent, 끄면 테두리만 */}
      <div className="nl-right-toolbar">
        <span
          className={marksOnly ? 'nl-marks-toggle nl-marks-toggle-on' : 'nl-marks-toggle'}
          onClick={() => setMarksOnly((v) => !v)}
        >
          {marksOnly ? '표시만' : '전문'}
        </span>
      </div>

      {c.people.map((p, i) => {
        const paras = (p.statement?.paragraphs ?? []).map(ko)
        const marks = paras.flatMap((text, n) =>
          segments(text, highlights.filter((h) => h.textRef === refOf(p.id, n)))
            .filter((s) => s.kind)
            .map((s) => ({ text: s.text, kind: s.kind! })),
        )
        const isOpen = open === p.id

        return (
          <div key={p.id} className="nl-acc">
            <div className="nl-acc-head" onClick={() => setOpen(isOpen ? null : p.id)}>
              <span className="nl-acc-bar" style={{ background: personColor(i) }} />
              {/* 원본 947행 — 20px 아바타 */}
              <span className="nl-avatar nl-acc-av" style={{ background: personColor(i) }}>
                {initialOf(p.name)}
              </span>
              <span className="v-ui">{p.name}</span>
              {!isOpen && (
                <span className="v-micro nl-acc-preview">
                  {paras[0] && paras[0].length > 30 ? paras[0].slice(0, 30) + '…' : paras[0]}
                </span>
              )}
              <span className="nl-fs-spacer" />
              <svg
                width="13" height="13" viewBox="0 0 16 16" fill="none"
                stroke="var(--fg-4)" strokeWidth="1.5"
                style={{ flex: 'none', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M5 6.5L8 9.5l3-3" />
              </svg>
            </div>

            {isOpen && (
              <div className="nl-acc-body">
                {marksOnly ? (
                  marks.length ? (
                    <div className="nl-mk-list">
                      {marks.map((m, n) => (
                        <div key={n} className="nl-mk-item">
                          <span className="nl-mk-item-bar" style={{ background: markColor(m.kind) }} />
                          <span className="nl-mk-item-t">{m.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="nl-acc-nomarks">
                      아직 표시한 구절이 없습니다. 진술 원문에서 드래그해 표시하세요.
                    </div>
                  )
                ) : (
                  paras.map((text, n) => (
                    <p key={n} className="nl-acc-p">
                      {/* 원본 953행 — 여기서도 마크가 보인다. 진술 화면과 같은 세그먼트 */}
                      {segments(text, highlights.filter((h) => h.textRef === refOf(p.id, n))).map((s, k) => (
                        <span key={k} style={s.kind ? markStyle(s.kind) : undefined}>{s.text}</span>
                      ))}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * 조사 기록 탭 — 원본 957~959행.
 *
 * **조사 기록 화면의 축소판이다.** 카드는 같은 것이지만 좁은 패널이라
 * 「배제 정보」 태그와 「발견」 표시가 빠지고 본문이 `v-micro` 로 줄어든다 —
 * 원본이 959행에서 그렇게 다르게 그린다. 보고서를 쓰면서 곁눈질하는 자리라
 * 전문은 조사 기록 화면이 맡는다.
 */
function InvLogTab({ c, progress }: { c: Case; progress: CaseProgress }) {
  const done = progress.investigations
    .map((iv) => c.actions.find((x) => x.id === iv.actionId))
    .filter((a): a is Action => !!a)

  if (done.length === 0)
    return (
      <div className="v-meta nl-right-empty">
        아직 수행한 조사가 없습니다. 현장이나 용의자 카드에서 조사를 실행하세요.
      </div>
    )

  return (
    <>
      {done.map((a) => {
        const k = kindOf(a)
        const empty = a.yield === 'empty'
        return (
          <div key={a.id} className="nl-right-log">
            <div className="nl-log-bar" style={{ background: k.color }} />
            <div className="nl-right-log-top">
              <span
                className="nl-result-badge"
                style={{
                  color: empty ? 'var(--fg-3)' : '#0A0A0B',
                  background: empty ? 'var(--bg-elevated-2)' : k.color,
                }}
              >
                {k.label}
              </span>
              <span className="nl-fs-spacer" />
              <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{a.label}</span>
            </div>
            <div className="v-ui nl-right-log-title">
              {ko(a.result?.title) || '아무것도 없음'}
            </div>
            <div className="v-micro nl-right-log-desc">
              {ko(a.result?.body)
                || '여기서는 새로운 단서가 나오지 않았다. 이 대상은 배제해도 좋다.'}
            </div>
          </div>
        )
      })}
    </>
  )
}

/**
 * 메모 탭 — 원본 961~970행.
 *
 * **메모가 1급 객체다.** 번호 · 인용구 · 편집/읽기 전환 · 삭제 · 저장 표시.
 * 한때 여기가 인물별 한 줄 나열이었다.
 */
function MemoTab({
  annotations, onAdd, onEdit, onDelete, editing, onEditing,
}: {
  annotations: PlayerAnnotations
  onAdd: () => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  editing: string | null
  onEditing: (id: string | null) => void
}) {
  const notes = annotations.notes

  return (
    <>
      <div className="nl-right-toolbar">
        <span className="linklike nl-memo-new" onClick={onAdd}>＋ 새 메모</span>
      </div>

      {notes.length === 0 && (
        <div className="v-meta nl-right-empty">
          아직 메모가 없습니다. 진술 원문에서 문장을 눌러 인용하거나, 새 메모를 추가하세요.
        </div>
      )}

      {notes.map((n, i) => {
        const isEditing = editing === n.id
        return (
          <div key={n.id} className="nl-memo-card">
            <div className="nl-memo-top">
              <span className="v-num nl-memo-num">메모 {i + 1}</span>
              {/* 층위 표시 — 확정(물증)과 주장(진술)을 섞지 않는다 */}
              {n.source && <span className="nl-memo-layer">{n.source}</span>}
              <span className="nl-fs-spacer" />
              {isEditing ? (
                <>
                  <span className="linklike nl-memo-done" onClick={() => onEditing(null)}>완료</span>
                  <span className="linklike nl-memo-del" onClick={() => onDelete(n.id)}>삭제</span>
                </>
              ) : (
                <span className="linklike nl-memo-edit" onClick={() => onEditing(n.id)}>편집</span>
              )}
            </div>

            {/* 인용구 — 이탤릭 따옴표. 원본 966행이 `“{{ mo.quote }}”` 로
                따옴표를 **화면에서** 붙인다. 화자는 메모장에만 나온다 */}
            {n.quote && <div className="v-micro nl-memo-quote">“{n.quote}”</div>}

            {isEditing ? (
              <textarea
                className="nl-memo-input"
                value={n.content}
                autoFocus
                placeholder="메모 내용…"
                onChange={(e) => onEdit(n.id, e.target.value)}
              />
            ) : (
              n.content && <div className="v-meta nl-memo-text">{n.content}</div>
            )}

            <div className="nl-memo-meta">
              {!isEditing && n.content && (
                <>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--g-confirm)" strokeWidth="1.6">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  <span style={{ color: 'var(--g-confirm)' }}>저장됨</span>
                </>
              )}
              {n.at && <span>· {timeOf(n.at)}{n.context ? ` · ${n.context}` : ''}</span>}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** 원본 `memoMeta()` — 「오전 10:23」 */
function timeOf(at: number): string {
  const d = new Date(at)
  const h = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${mm}`
}
