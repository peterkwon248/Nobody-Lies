/**
 * 산문 리더 — 프롤로그와 **장 인터루드가 공유하는 몸통**.
 *
 * 문단은 **한 화면에 전부** 나온다. 프로토타입 프롤로그가 그렇게 되어 있고,
 * `design-brief.md` §프롤로그가 요구한 조판도 그것이다:
 * *"표나 카드로 감싸지 말 것. UI 요소를 최소화하고 텍스트 자체가 화면이 되도록."*
 *
 * `step`/`steps` 는 **여러 화면짜리 시퀀스**에서만 쓴다. 장 인터루드가
 * `[서술] → [도착물 화면 0~n개] → 다음 장` 으로 이어지기 때문이다
 * (`docs/MEMORY.md` §장 인터루드 시퀀스 구조). 프롤로그는 한 화면이라 점이 없다.
 *
 * **건너뛰기가 없다.** 진술을 정독시키는 게임에서 건너뛰기는 "이건 안 읽어도 된다"는
 * 말이고, 인터루드는 새 정보를 나르는 화면이라 건너뛰면 못 보고 지나간다.
 * 대신 점 인디케이터가 유일한 "곧 끝난다" 신호이므로 시퀀스에서는 반드시 둔다.
 */
export function Reader({
  kicker,
  paragraphs,
  onDone,
  doneLabel = '다음',
  step,
  steps,
}: {
  kicker?: string
  paragraphs: string[]
  onDone: () => void
  doneLabel?: string
  step?: number
  steps?: number
}) {
  return (
    <div className="nl-reader">
      {kicker && <div className="v-caption nl-reader-kicker">{kicker}</div>}

      {paragraphs.map((p, i) => (
        <p key={i} className="nl-reader-p">
          {p}
        </p>
      ))}

      <div className="nl-reader-foot">
        <button className="nl-btn nl-btn-primary" onClick={onDone}>
          {doneLabel}
        </button>
        {steps && steps > 1 && (
          <div className="nl-seq-dots" aria-hidden="true">
            {Array.from({ length: steps }, (_, i) => (
              <span key={i} className={i <= (step ?? 0) ? 'nl-dot nl-dot-on' : 'nl-dot'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
