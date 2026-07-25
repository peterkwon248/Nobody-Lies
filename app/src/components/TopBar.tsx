import { useEffect, useState } from 'react'

/**
 * 전체화면 표면의 상단 바 (홈 · 사건 상세 · 진입 흐름).
 *
 * 프로토타입과 같은 구성 — 좌측에 표지 또는 뒤로, 우측에 테마 전환.
 *
 * **언어 전환(한국어/EN)은 아직 넣지 않는다.** 사건 파일의 `Text.en` 이 대부분
 * 비어 있어서(번역 전) 지금 붙이면 절반만 번역된 화면이 된다. 어휘가 고정이라
 * 번역은 싸지만(`SYSTEM-DECISIONS.md` §7) 아직 하지 않은 일이다.
 */
export function TopBar({
  title,
  onBack,
  ruled,
}: {
  title: string
  onBack?: () => void
  ruled?: boolean
}) {
  return (
    <div className={ruled ? 'nl-fs-bar nl-fs-bar-ruled' : 'nl-fs-bar'}>
      {onBack ? (
        <span className="linklike" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg className="icon-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3.5L5.5 8l4.5 4.5" />
          </svg>
          돌아가기
        </span>
      ) : (
        <>
          <span className="nl-fs-mark" aria-hidden="true" />
          <span className="v-ui" style={{ color: 'var(--fg-3)' }}>{title}</span>
        </>
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
