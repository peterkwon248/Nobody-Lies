import type { PlayerAnnotations } from '../state/stores'

/**
 * 인용 피커 — 프로토타입 1257~1266행.
 *
 * 「인용 모으기」를 켜둔 메모가 **둘 이상**일 때만 뜬다. 하나면 묻지 않고 거기
 * 이어 붙이고, 없으면 새 메모를 만든다 (원본 `routeQuote`, 2634행). 세 갈래가
 * 전부 인용 한 번에 대한 응답이라 어느 쪽도 되묻지 않는다 — 켜둔 개수가 이미
 * 플레이어의 대답이다.
 *
 * 확보 단어 다이얼로그(z-index 96) 위에서 떠야 한다. 단어 카드에서 인용하면
 * 그 다이얼로그가 아직 열려 있는 채로 이것이 올라온다.
 */

export function QuotePicker({
  notes,
  onPick,
  onNew,
  onCancel,
}: {
  /** 전체 메모. 번호는 만든 순서이므로 걸러내기 전에 세어야 한다 */
  notes: PlayerAnnotations['notes']
  onPick: (id: string) => void
  onNew: () => void
  onCancel: () => void
}) {
  const pinned = notes
    .map((n, i) => ({ n, num: i + 1 }))
    .filter(({ n }) => n.pinned)

  return (
    <div className="nl-scrim nl-scrim-quote" onClick={onCancel}>
      <div className="nl-qp" onClick={(e) => e.stopPropagation()}>
        <div className="nl-qp-head">
          <div className="v-h3" style={{ color: 'var(--fg)' }}>어느 메모에 담을까요?</div>
        </div>

        <div className="nl-qp-list">
          {pinned.map(({ n, num }) => (
            <div key={n.id} className="nl-qp-row" onClick={() => onPick(n.id)}>
              <span className="nl-qp-num">#{num}</span>
              <span className="nl-qp-excerpt">
                {((n.content || n.quote || `메모 ${num}`).split('\n')[0]).slice(0, 40)}
              </span>
            </div>
          ))}

          <div className="nl-qp-sep" />

          <div className="nl-qp-row nl-qp-new" onClick={onNew}>
            <span className="nl-qp-num nl-qp-num-new">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
            <span className="nl-qp-newlabel">새 메모로</span>
          </div>
        </div>
      </div>
    </div>
  )
}
