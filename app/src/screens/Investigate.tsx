import type { Action, Case } from '@engine/types'
import { ko } from '../case/loadCase'

/**
 * 조사 — 예산을 쓰는 유일한 자리. 프로토타입 875~911행.
 *
 * ★ 게임은 무엇을 조사하라고 말하지 않는다 ★
 * 목록은 **평평하다** — 결정적 조사와 레드 헤링이 완전히 같게 생긴다.
 * 정렬도 사건 파일 순서 그대로다. `salience` 로 정렬하면 그 순서가 곧 정답이다.
 *
 * 상태 셋만 사실로 표시한다: 실행 가능 / 잔여 부족 / 조사 완료.
 * 이건 판정이 아니라 **내가 무엇을 했는가**이므로 누설이 아니다.
 */

export type ActionState = 'ok' | 'nobudget' | 'used' | 'locked'

export function actionState(
  _c: Case, a: Action, used: Set<string>, remaining: number, solvedCount: number,
): ActionState {
  if (used.has(a.id)) return 'used'
  if (a.availableAfter && solvedCount < a.availableAfter) return 'locked'
  if (a.cost > remaining) return 'nobudget'
  return 'ok'
}

export function Investigate({
  c,
  used,
  remaining,
  solvedCount,
  onAsk,
}: {
  c: Case
  used: Set<string>
  remaining: number
  solvedCount: number
  onAsk: (a: Action) => void
}) {
  return (
    <div className="nl-inv">
      <div className="nl-inv-budget">
        <div className="nl-inv-budget-top">
          <span className="v-caption" style={{ color: 'var(--fg-3)' }}>잔여 조사</span>
          <span className="v-num nl-inv-num">
            {remaining} <span className="nl-inv-den">/ {c.budget}</span>
          </span>
        </div>
        {/* 남은 만큼 채워진 칸. 사실이지 재촉이 아니다 */}
        <div className="nl-inv-pips">
          {Array.from({ length: c.budget }, (_, i) => (
            <span key={i} className={i < remaining ? 'nl-pip nl-pip-on' : 'nl-pip'} />
          ))}
        </div>
        <div className="v-micro nl-inv-hint">
          조사는 되돌릴 수 없습니다. 같은 대상은 한 번만 조사합니다.
        </div>
      </div>

      <div className="nl-inv-list">
        {c.actions.map((a) => {
          const st = actionState(c, a, used, remaining, solvedCount)
          return (
            <div
              key={a.id}
              className={`nl-inv-row nl-inv-row-${st}`}
              onClick={st === 'ok' ? () => onAsk(a) : undefined}
            >
              <span className="v-ui nl-inv-label">{a.label}</span>
              <span className="nl-fs-spacer" />
              {st === 'used' ? (
                <span className="v-meta nl-inv-done">조사 완료</span>
              ) : st === 'locked' ? (
                <span className="v-meta nl-inv-state">{a.availableAfter}장 완성 후</span>
              ) : st === 'nobudget' ? (
                <span className="v-meta nl-inv-state">잔여 부족</span>
              ) : (
                <span className="v-meta nl-inv-cost">비용 {a.cost}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 조사 결과 카드 — 원본 1231~1243행. 유형별 색은 **결과의 종류**이지 유용도가 아니다 */
const KIND: Record<string, { label: string; color: string }> = {
  solution:   { label: '단서', color: 'var(--g-confirm)' },
  redherring: { label: '무관', color: 'var(--status-progress)' },
  exclusion:  { label: '배제', color: 'var(--accent)' },
  empty:      { label: '없음', color: 'var(--fg-4)' },
}

export function ResultCard({ a, onClose }: { a: Action; onClose: () => void }) {
  const k = KIND[a.yield] ?? KIND.empty
  const empty = a.yield === 'empty'
  return (
    <div className="nl-scrim">
      <div className="nl-result" onClick={(e) => e.stopPropagation()}>
        <div className="nl-result-accent" style={{ background: k.color }} />
        <div className="nl-result-body">
          <div className="nl-result-head">
            <span
              className="nl-result-badge"
              style={{
                color: empty ? 'var(--fg-3)' : '#0A0A0B',
                background: empty ? 'var(--bg-elevated-2)' : k.color,
              }}
            >
              {k.label}
            </span>
            <span className="v-micro" style={{ color: 'var(--fg-4)' }}>{a.label}</span>
          </div>
          <div className="v-h3 nl-result-title">
            {ko(a.result?.title) || '아무것도 없음'}
          </div>
          <div className="nl-result-text">
            {ko(a.result?.body)
              || '여기서는 새로운 단서가 나오지 않았다. 이 대상은 배제해도 좋다.'}
          </div>
          <div className="nl-result-foot">
            <button className="nl-btn nl-btn-primary" onClick={onClose}>조사 기록에 보관</button>
          </div>
        </div>
      </div>
    </div>
  )
}
