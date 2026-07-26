import type { Case } from '@engine/types'
import type { PlayerAnnotations } from '../state/stores'
import { personColor } from '../case/people'

/**
 * 메모장 — 프로토타입 382~419행. 사이드바 [도구] 그룹.
 *
 * 우측 패널의 메모 탭(966행)과 **같은 데이터를 다르게 본다.** 패널은 보고서를
 * 쓰면서 곁눈질하는 자리라 번호·인용·본문만 있고, 여기는 메모가 주인공이라
 * 필터·검색·정렬·대상 지정·인용 모으기가 전부 나온다.
 *
 * ★ 게임은 메모를 읽지 않는다 ★
 * 대상(인물·진술·물증)은 **플레이어가 자기 메모를 묶는 방식**이지 게임에 대한
 * 신고가 아니다. 채점에 쓰이지 않고, 무엇을 적었는지에 대해 게임은 아무 말도
 * 하지 않는다 — 심증(`verdicts`)과 같은 성질이다.
 *
 * 클래스는 `nl-nb-`(notebook). 우측 패널의 `nl-memo-` 와 **일부러 다르다** —
 * 같은 이름을 나눠 쓰면 한쪽 여백을 고칠 때 다른 쪽이 조용히 따라 움직인다.
 */

type Note = PlayerAnnotations['notes'][number]
type TargetType = NonNullable<Note['targetType']>

/**
 * 대상 칩의 순서 — 원본 2746행. **「없음」이 맨 앞이다**: 편집 중인 카드에서
 * 대상을 지우는 것이 첫 번째 선택지다.
 */
const TARGETS: TargetType[] = ['없음', '인물', '진술', '물증']

/**
 * 필터의 순서 — 원본 2748행. **「없음」이 맨 뒤다.** 위와 순서가 다른 것이
 * 실수처럼 보이지만 아니다 — 필터는 *찾으려는 것*을 앞에 두고, 대상 칩은
 * *지우는 것*을 앞에 둔다.
 */
const FILTERS: (TargetType | '전체')[] = ['전체', '인물', '진술', '물증', '없음']

/** 대상 색 — 원본 `tc`(2718행). 왼쪽 세로 막대와 칩 테두리가 같은 색을 쓴다 */
const TARGET_COLOR: Record<TargetType, string> = {
  없음: 'var(--fg-4)',
  인물: 'var(--accent)',
  진술: 'var(--status-progress)',
  물증: 'var(--g-confirm)',
}

/** 정렬 「대상순」의 순서 — 원본 `ord`(2727행) */
const TARGET_ORDER: Record<TargetType, number> = { 인물: 0, 진술: 1, 물증: 2, 없음: 3 }

/** 층위 색 — 원본 `layerMeta`(2721행). 대상 색과 겹치는 것은 우연이 아니다 */
const LAYER_COLOR: Record<'확정' | '주장', string> = {
  주장: 'var(--status-progress)',
  확정: 'var(--g-confirm)',
}

const targetOf = (n: Note): TargetType => n.targetType ?? '없음'

export function Memo({
  c,
  annotations,
  terms,
  editing,
  onEditing,
  onAdd,
  onEdit,
  onDelete,
  onTarget,
  onPin,
  filter,
  onFilter,
  sort,
  onSort,
  query,
  onQuery,
}: {
  c: Case
  annotations: PlayerAnnotations
  /** 지금 손에 있는 확보 단어. 물증 칩이 여기서 나온다 */
  terms: Set<string>
  /** 편집 중인 메모. 인용이 새 메모를 만들면 그것이 열린 채로 온다 */
  editing: string | null
  onEditing: (id: string | null) => void
  onAdd: () => void
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  onTarget: (id: string, type: TargetType, target: string | null) => void
  onPin: (id: string) => void
  /** 필터·정렬·검색은 화면 상태다. 인용이 필터를 「전체」로 되돌려야 해서 App 이 쥔다 */
  filter: TargetType | '전체'
  onFilter: (f: TargetType | '전체') => void
  sort: '최신순' | '대상순'
  onSort: (s: '최신순' | '대상순') => void
  query: string
  onQuery: (q: string) => void
}) {
  const all = annotations.notes
  // 번호는 **만든 순서**다. 정렬을 바꿔도 #3은 계속 #3이다
  const numOf = new Map(all.map((n, i) => [n.id, i + 1]))

  const q = query.trim().toLowerCase()
  let rows = all.filter((n) => filter === '전체' || targetOf(n) === filter)
  if (q) rows = rows.filter((n) => `${n.content} ${n.quote ?? ''}`.toLowerCase().includes(q))
  rows = rows.slice().reverse()
  if (sort === '대상순')
    rows = rows.slice().sort((a, b) => TARGET_ORDER[targetOf(a)] - TARGET_ORDER[targetOf(b)])

  // 원본 2744행은 `COLLECTED_POOL` 중 공개된 것만 칩으로 세운다 — 아직 손에
  // 없는 단어를 고를 수 있으면 그 목록 자체가 남은 단서를 알려준다
  const collected = [...terms].sort()

  return (
    <div className="nl-nb">
      <div className="nl-nb-bar-row">
        <div className="nl-nb-chips">
          {FILTERS.map((f) => (
            <span
              key={f}
              className={filter === f ? 'nl-nb-chip nl-nb-chip-on' : 'nl-nb-chip'}
              onClick={() => onFilter(f)}
            >
              {f} {all.filter((n) => f === '전체' || targetOf(n) === f).length}
            </span>
          ))}
        </div>
        <span className="nl-fs-spacer" />
        <div className="nl-nb-chips">
          {(['최신순', '대상순'] as const).map((s) => (
            <span
              key={s}
              className={sort === s ? 'nl-nb-chip nl-nb-chip-on' : 'nl-nb-chip'}
              onClick={() => onSort(s)}
            >
              {s}
            </span>
          ))}
        </div>
        <button className="nl-btn" onClick={onAdd}>＋ 새 메모</button>
      </div>

      {/* 원본 392~393행 — 돋보기가 입력칸 안쪽 왼쪽에 앉는다 */}
      <div className="nl-nb-search">
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="none"
          stroke="var(--fg-4)" strokeWidth="1.4"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5l3 3" />
        </svg>
        <input
          value={query}
          placeholder="메모 검색…"
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      {rows.length === 0 && (
        <div className="nl-nb-empty">
          {q
            ? '검색 결과가 없습니다.'
            : '아직 메모가 없습니다. 진술 원문에서 문장을 눌러 인용하거나, 새 메모를 추가하세요.'}
        </div>
      )}

      <div className="nl-nb-grid">
        {rows.map((n) => {
          const tt = targetOf(n)
          const isEditing = editing === n.id
          return (
            <div key={n.id} className="nl-nb-card">
              <div className="nl-nb-accent" style={{ background: TARGET_COLOR[tt] }} />

              <div className="nl-nb-top">
                <span className="v-num nl-nb-num">#{numOf.get(n.id)}</span>
                {n.source && (
                  <span
                    className="nl-nb-layer"
                    style={{ borderColor: LAYER_COLOR[n.source], color: LAYER_COLOR[n.source] }}
                  >
                    {n.source}
                  </span>
                )}
                <span className="nl-fs-spacer" />

                {isEditing ? (
                  <>
                    {/* 인용 모으기 — 켠 메모가 둘 이상이면 인용할 때 물어본다 */}
                    <span
                      className="linklike nl-nb-pin"
                      style={n.pinned ? { color: 'var(--accent)' } : undefined}
                      onClick={() => onPin(n.id)}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 2v6 M5 5l3-3 3 3 M4 13h8" />
                      </svg>
                      {n.pinned ? '인용 모으는 중' : '인용 모으기'}
                    </span>
                    <span className="linklike nl-nb-done" onClick={() => onEditing(null)}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                      완료
                    </span>
                    <span className="linklike nl-nb-del" onClick={() => onDelete(n.id)}>삭제</span>
                  </>
                ) : (
                  <span className="linklike nl-nb-edit" onClick={() => onEditing(n.id)}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M3 12l.8-3L10 2.8l2.4 2.4L6.2 11.4z" />
                      <path d="M9.4 3.4l2.4 2.4" />
                    </svg>
                    편집
                  </span>
                )}
              </div>

              {/* 원본 401행 — 여는 따옴표가 본문 밖에 크게 선다 */}
              {n.quote && (
                <div className="nl-nb-quote">
                  <span className="nl-nb-quote-mark">“</span>
                  <div className="nl-nb-quote-body">
                    <div className="v-meta nl-nb-quote-text">{n.quote}</div>
                    {n.quoteWho && (
                      <div className="v-micro nl-nb-quote-who">— {n.quoteWho} · 인용</div>
                    )}
                  </div>
                </div>
              )}

              {isEditing ? (
                <>
                  <textarea
                    className="nl-nb-input"
                    value={n.content}
                    placeholder="메모 내용…"
                    onChange={(e) => onEdit(n.id, e.target.value)}
                  />

                  <div className="nl-nb-targets">
                    <span className="v-micro nl-nb-targets-label">대상</span>
                    {TARGETS.map((t) => (
                      <span
                        key={t}
                        className={tt === t ? 'nl-nb-chip nl-nb-chip-on' : 'nl-nb-chip'}
                        style={tt === t ? { borderColor: TARGET_COLOR[t], color: TARGET_COLOR[t] } : undefined}
                        onClick={() =>
                          onTarget(
                            n.id,
                            t,
                            // 인물·진술로 바꾸면 이미 아는 사람이 있으면 그 사람으로,
                            // 없으면 첫 번째로 떨어진다 (원본 2746행)
                            t === '인물' || t === '진술'
                              ? n.target ?? c.people[0]?.id ?? null
                              : null,
                          )
                        }
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {(tt === '인물' || tt === '진술') && (
                    <div className="nl-nb-picks">
                      {c.people.map((p, i) => (
                        <span
                          key={p.id}
                          className={n.target === p.id ? 'nl-nb-pick nl-nb-pick-on' : 'nl-nb-pick'}
                          style={
                            n.target === p.id
                              ? { borderColor: tt === '인물' ? personColor(i) : TARGET_COLOR.진술 }
                              : undefined
                          }
                          onClick={() => onTarget(n.id, tt, p.id)}
                        >
                          <span className="nl-nb-dot" style={{ background: personColor(i) }} />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {tt === '물증' && (
                    <div className="nl-nb-picks">
                      {collected.length === 0 ? (
                        <span className="v-micro" style={{ color: 'var(--fg-4)' }}>
                          아직 확보한 단어가 없습니다
                        </span>
                      ) : (
                        collected.map((w) => (
                          <span
                            key={w}
                            className={n.target === w ? 'nl-nb-pick nl-nb-pick-on' : 'nl-nb-pick'}
                            style={n.target === w ? { borderColor: TARGET_COLOR.물증 } : undefined}
                            onClick={() => onTarget(n.id, '물증', w)}
                          >
                            <span className="nl-nb-dot" style={{ background: TARGET_COLOR.물증 }} />
                            {w}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {n.content && <div className="v-body nl-nb-text">{n.content}</div>}
                  <div className="nl-nb-meta">
                    {n.content.trim() && (
                      <>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--g-confirm)" strokeWidth="1.6">
                          <path d="M3.5 8.5l3 3 6-7" />
                        </svg>
                        <span style={{ color: 'var(--g-confirm)' }}>저장됨</span>
                      </>
                    )}
                    {(n.at || n.context) && (
                      <span>· {[n.at && timeOf(n.at), n.context].filter(Boolean).join(' · ')}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 원본 `memoWhen()`(2686행) — 오늘 것은 시각만, 다른 날 것은 날짜를 앞에 붙인다.
 * 한 판이 며칠에 걸치면 「오전 10:23」 만으로는 어제 것과 구분이 안 된다.
 */
export function timeOf(at: number): string {
  const d = new Date(at)
  const now = new Date()
  const h = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  const time = `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${mm}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? time : `${d.getMonth() + 1}월 ${d.getDate()}일 · ${time}`
}
