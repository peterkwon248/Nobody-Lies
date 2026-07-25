import { useState } from 'react'

/**
 * 산문 리더 — 프롤로그와 **장 인터루드가 공유하는 몸통**.
 *
 * 한 번에 한 문단씩 드러난다. `design-brief.md` §프롤로그가 요구한 조판이다:
 * *"표나 카드로 감싸지 말 것. UI 요소를 최소화하고 텍스트 자체가 화면이 되도록."*
 *
 * **건너뛰기가 없다.** 진술을 정독시키는 게임에서 건너뛰기는 "이건 안 읽어도 된다"는
 * 말이고, 인터루드는 새 정보를 나르는 화면이라 건너뛰면 못 보고 지나간다. 사건이
 * 1회성이라 재플레이 피로 문제도 없다. **대신 점 인디케이터가 유일한 "곧 끝난다"
 * 신호이므로 반드시 둔다.**
 *
 * 이미 드러난 문단은 사라지지 않는다 — "한 번 보여주고 사라지는 텍스트는 버그다"
 * (`HANDOFF-TO-CODE.md` §0.3).
 */
export function Reader({
  paragraphs,
  onDone,
  doneLabel = '다음',
}: {
  paragraphs: string[]
  onDone: () => void
  doneLabel?: string
}) {
  const [shown, setShown] = useState(1)
  const last = shown >= paragraphs.length

  return (
    <div className="reader">
      <div className="reader-prose">
        {paragraphs.slice(0, shown).map((p, i) => (
          <p key={i} className={i === shown - 1 ? 'reader-p reader-p-new' : 'reader-p'}>
            {p}
          </p>
        ))}
      </div>

      <div className="reader-foot">
        {/* 점 인디케이터 — 건너뛰기를 없앤 대가로 반드시 있어야 하는 신호 */}
        <div className="reader-dots" aria-hidden="true">
          {paragraphs.map((_, i) => (
            <span key={i} className={i < shown ? 'dot dot-on' : 'dot'} />
          ))}
        </div>
        <button
          className="reader-next"
          onClick={() => (last ? onDone() : setShown((n) => n + 1))}
        >
          {last ? doneLabel : '다음'}
        </button>
      </div>
    </div>
  )
}
