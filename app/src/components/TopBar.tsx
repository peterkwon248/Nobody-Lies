import { useEffect, useState } from 'react'
import { Mark } from './Mark'

/**
 * 전체화면 표면의 상단 바.
 *
 * 프로토타입은 표면마다 구성이 다르다 — **인트로(프롤로그·브리핑)에는 제목도 마크도
 * 없고 우측 컨트롤만 있다.** 산문 화면에서 UI 를 최소화하기 위해서다. 그 자리에
 * 마크를 놓으면 텍스트가 화면이 되는 것을 방해한다.
 *
 * 다만 **돌아가기는 인트로에도 둔다.** 프로토타입은 인트로에서 홈으로 나갈 길이
 * 없는데(사이드바가 z-index 아래로 덮인다), 그것은 이식할 만한 성질이 아니다.
 * 진행은 `CaseProgress.stage` 에 저장되므로 나갔다 와도 이어진다.
 */
export function TopBar({
  title,
  onBack,
  showMark,
  ruled,
}: {
  title?: string
  onBack?: () => void
  showMark?: boolean
  ruled?: boolean
}) {
  return (
    <div className={ruled ? 'nl-fs-bar nl-fs-bar-ruled' : 'nl-fs-bar'}>
      {onBack && (
        <span className="linklike nl-back" onClick={onBack}>
          <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3.5L5.5 8l4.5 4.5" />
          </svg>
          홈
        </span>
      )}
      {showMark && <Mark size={24} />}
      {showMark && title && (
        <span className="v-ui" style={{ color: 'var(--fg-3)' }}>{title}</span>
      )}
      <span className="nl-fs-spacer" />
      <ThemeToggle />
    </div>
  )
}

/** Vector 는 `<html data-theme="light">` 로 라이트 테마를 켠다 */
function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
  }, [light])

  return (
    <span
      className="iconbtn"
      onClick={() => setLight((v) => !v)}
      title="테마 전환"
      style={{ width: 'auto', height: 24, padding: '0 8px', fontSize: 13 }}
    >
      {light ? '◐' : '◑'}
    </span>
  )
}
