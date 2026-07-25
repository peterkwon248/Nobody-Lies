import { useState } from 'react'
import type { Case, PersonId } from '@engine/types'
import { TopBar } from '../components/TopBar'
import { ko } from '../case/loadCase'
import type { PlayerAnnotations } from '../state/stores'

/**
 * 진술 정독 — 진입 흐름 3단계이자 **게임의 실제 시작점**.
 *
 * *"원본 오프라인 게임에서는 진행자가 시나리오를 낭독하고 플레이어들이 받아적는
 * 시간이 있었다. 그 단계가 몰입의 시작이자 무엇을 해야 하는가를 알려주는 장치였다.
 * 디지털에서 이 단계를 생략하면 플레이어는 빈칸부터 마주하게 된다."*
 * (`design-brief.md` §4.01)
 *
 * ★ 층위는 **주장**이다 ★ — 확정(브리핑·물증)과 섞이면 안 된다. 게임은 여기서
 * 어떤 판정도 하지 않는다. 볼드·하이라이트·모순 표시 전부 금지
 * (`HANDOFF-TO-CODE.md` §0.2). **거짓말하는 사람의 진술도 다른 넷과 완전히
 * 동일하게 생겨야 한다.**
 *
 * 인물색은 **아바타에만** 둔다. 한때 문단마다 색선을 그었는데 프로토타입에 없는
 * 것이었고, 문단 단위 장식은 강조로 읽힌다 — 강조는 게임이 하지 않는다.
 *
 * 메모는 플레이어가 만든 것이라 `PlayerAnnotations` 로 간다. 모순 경고를 없앴으므로
 * 확정과 주장의 대조를 플레이어가 전부 혼자 해야 하고, **그 대조가 일어나는 자리가
 * 메모다** (`HANDOFF` §6).
 */

/** 인물색. 인덱스 기반 고정 배정 — 유죄와 무관해야 하므로 사건 데이터를 보지 않는다 */
const PERSON_COLORS = [
  'var(--label-orange)', 'var(--label-blue)', 'var(--label-purple)',
  'var(--label-green)', 'var(--label-pink)', 'var(--label-red)',
]

export function Statements({
  c,
  read,
  annotations,
  onMemo,
  onRead,
  onDone,
  onHome,
}: {
  c: Case
  read: PersonId[]
  annotations: PlayerAnnotations
  onMemo: (person: PersonId, content: string) => void
  onRead: (person: PersonId) => void
  onDone: () => void
  onHome: () => void
}) {
  const [i, setI] = useState(() => {
    const next = c.people.findIndex((p) => !read.includes(p.id))
    return next < 0 ? 0 : next
  })
  // 원본의 `readHi` 와 같다 — 정독 화면에만 사는 표시라 저장소로 가지 않는다
  const [lit, setLit] = useState<Record<string, boolean>>({})

  const p = c.people[i]
  const total = c.people.length
  const isLast = i === total - 1
  const color = PERSON_COLORS[i % PERSON_COLORS.length]
  const memo = annotations.notes.find((n) => n.target === p.id)?.content ?? ''

  const goto = (next: number) => {
    onRead(p.id)
    setI(next)
  }

  return (
    <div className="nl-fs">
      <TopBar onBack={onHome} />

      <div className="nl-fs-body nl-fs-body-top">
        <div className="nl-read">
          <div className="nl-read-head">
            <span className="v-meta v-num" style={{ color: 'var(--fg-4)' }}>
              {i + 1} / {total}
            </span>
            <span className="nl-fs-spacer" />
            {/* 진술은 이후에도 언제든 다시 볼 수 있으므로 정독을 건너뛸 수 있다.
                프로토타입과 같다 — 여기서 막으면 재방문이 벌처럼 느껴진다 */}
            <span className="linklike" onClick={() => { onRead(p.id); onDone() }}>
              건너뛰기
            </span>
          </div>

          <div className="nl-read-card">
            <div className="nl-read-who">
              <span className="nl-avatar" style={{ background: color }}>
                {p.name.slice(0, 1)}
              </span>
              <span className="v-h3" style={{ color: 'var(--fg)' }}>{p.name}</span>
              <span className="v-meta" style={{ color: 'var(--fg-4)' }}>
                {p.age} · {p.job}
              </span>
            </div>

            {/* 지문 — 원본 1045·1047행. 이탤릭 `fg-4` 로 진술 본문과 층을 가른다.
                전원이 갖거나 전원이 없다(검증기 9-1) */}
            {p.statement?.gesture?.pre && (
              <p className="nl-read-gesture">{ko(p.statement.gesture.pre)}</p>
            )}

            {/* 문단 클릭 토글. 원본 1908행.
                **자유 진행 진술 화면의 드래그 4색 마킹과는 별개의 단순 버전이다** —
                정독은 한 번 지나가는 선형 흐름이라 눈에 걸린 문단만 짚어두는
                용도이고, 프로토타입도 이 둘을 다른 상태로 갖고 있다
                (`readHi` ↔ `hls`). 그래서 여기 표시는 `표시만` 에 안 뜬다 */}
            {(p.statement?.paragraphs ?? []).map((t, n) => {
              const key = `${p.id}-${n}`
              return (
                <p
                  key={n}
                  className={lit[key] ? 'nl-read-p nl-read-p-lit' : 'nl-read-p'}
                  onClick={() => setLit((v) => ({ ...v, [key]: !v[key] }))}
                >
                  {ko(t)}
                </p>
              )
            })}

            {p.statement?.gesture?.post && (
              <p className="nl-read-gesture nl-read-gesture-post">{ko(p.statement.gesture.post)}</p>
            )}

            <div className="nl-read-memo-label">
              <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" />
                <path d="M9.4 3.4l2.4 2.4" />
              </svg>
              <span className="v-meta">메모</span>
            </div>
            <textarea
              className="nl-read-memo"
              value={memo}
              onChange={(e) => onMemo(p.id, e.target.value)}
              placeholder="이 진술에서 눈에 띄는 점…"
            />
          </div>

          <div className="nl-read-foot">
            <button className="nl-btn nl-read-prev" onClick={() => setI(i - 1)} disabled={i === 0}>
              이전
            </button>
            {/* 원본 1919행 — 지나온 것과 남은 것을 인덱스로 가른다. 읽음 기록이 아니다 */}
            <div className="nl-read-dots">
              {c.people.map((q, n) => (
                <span
                  key={q.id}
                  className={n === i ? 'nl-dot nl-dot-now' : n < i ? 'nl-dot nl-dot-past' : 'nl-dot'}
                  onClick={() => goto(n)}
                />
              ))}
            </div>
            <button
              className="nl-btn nl-btn-primary"
              onClick={() => (isLast ? (onRead(p.id), onDone()) : goto(i + 1))}
            >
              {isLast ? '보고서 열기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
