import type { Action, Case } from '@engine/types'
import { ko } from '../case/loadCase'
import { Investigate } from './Investigate'
import type { CaseProgress } from '../state/stores'

/**
 * 조사 기록 — 프로토타입 565~578행. 사이드바 [도구] 그룹.
 *
 * 수행한 조사가 시간순으로 쌓인다. **전문 보존** — 결과 카드에서 한 번 읽고
 * 사라지는 게 아니라 여기 영구히 남는다 (*"한 번 보여주고 사라지는 텍스트는
 * 버그다"*, `HANDOFF` §0.3).
 *
 * ★ 유형 색은 결과의 종류이지 유용도가 아니다 ★
 * 「단서」와 「무관」이 같은 크기·같은 자리에 온다. 레드 헤링이 흐리게 보이면
 * 그것이 곧 정답 표시다.
 *
 * 아래에 남은 조사 목록을 붙였다 — 원본 `investigate` 뷰(875~911행)가
 * 「실행 목록 좌 + 기록 우」 한 화면이었던 것을 세로로 폈다. 장소·인물이 아닌
 * 조사(알리바이 대조)는 도면에도 카드에도 걸 자리가 없어서 여기서만 실행된다.
 */

const KIND: Record<string, { label: string; color: string }> = {
  solution: { label: '단서', color: 'var(--g-confirm)' },
  redherring: { label: '무관', color: 'var(--status-progress)' },
  exclusion: { label: '배제', color: 'var(--accent)' },
  empty: { label: '없음', color: 'var(--fg-4)' },
}

export function InvestigationLog({
  c,
  progress,
  onAsk,
}: {
  c: Case
  progress: CaseProgress
  onAsk: (a: Action) => void
}) {
  const done = progress.investigations
    .map((iv) => ({ iv, a: c.actions.find((x) => x.id === iv.actionId) }))
    .filter((x): x is { iv: typeof x.iv; a: Action } => !!x.a)

  const used = new Set(progress.investigations.map((iv) => iv.actionId))
  const remaining = c.budget - progress.actionsUsed

  return (
    <div className="nl-log">
      {done.length === 0 ? (
        <div className="nl-log-empty">
          아직 수행한 조사가 없습니다. 현장이나 용의자 카드에서 조사를 실행하세요.
        </div>
      ) : (
        <div className="nl-log-list">
          {done.map(({ a }) => {
            const k = KIND[a.yield] ?? KIND.empty
            const empty = a.yield === 'empty'
            return (
              <div key={a.id} className="nl-log-card">
                <div className="nl-log-bar" style={{ background: k.color }} />
                <div className="nl-log-top">
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
                <div className="v-title nl-log-title">
                  {ko(a.result?.title) || '아무것도 없음'}
                </div>
                <div className="nl-log-desc">
                  {ko(a.result?.body)
                    || '여기서는 새로운 단서가 나오지 않았다. 이 대상은 배제해도 좋다.'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="nl-log-sep">
        <span className="v-caption" style={{ color: 'var(--fg-2)' }}>남은 조사</span>
      </div>
      <Investigate
        c={c}
        used={used}
        remaining={remaining}
        solvedCount={progress.solved.length}
        onAsk={onAsk}
      />
    </div>
  )
}
