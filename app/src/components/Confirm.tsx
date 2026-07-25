/**
 * 확인 모달 · 토스트 — 원본 1161~1169행(포기) · 1245~1254행(제출·토스트).
 *
 * 둘 다 `scrim` + `modal` 이라는 Vector 클래스를 쓰고 z-index 95 로 뜬다.
 * (확보 단어 다이얼로그만 96 — 그 위에 겹칠 수 있어야 해서다.)
 */

export function Confirm({
  title,
  body,
  note,
  confirmLabel,
  danger,
  width = 400,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  /** 경고 한 줄. 제출 모달이 「아직 채우지 않은 공란 N개」를 여기 띄운다 */
  note?: string
  confirmLabel: string
  danger?: boolean
  width?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="nl-scrim nl-scrim-modal" onClick={onCancel}>
      <div className="nl-modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="nl-modal-body">
          <div className="v-h3" style={{ color: 'var(--fg)' }}>{title}</div>
          <div className="v-body nl-modal-desc">{body}</div>
          {note && <div className="v-meta nl-modal-note">{note}</div>}
        </div>
        <div className="nl-modal-foot">
          <button className="nl-btn" onClick={onCancel}>취소</button>
          <button
            className={danger ? 'nl-btn nl-btn-danger' : 'nl-btn nl-btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 토스트 — 원본 1254행.
 *
 * ★ 내용을 여기 담지 않는다 ★
 * *"한 번 보여주고 사라지는 텍스트는 버그다"* (`HANDOFF` §0.3).
 * 토스트는 **"어디에 새 것이 생겼다"** 신호만 나르고, 내용은 해당 화면에 영구히 남는다.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div className="nl-toast">
      <span className="nl-toast-dot" />
      {message}
    </div>
  )
}
