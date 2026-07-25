/**
 * 앱 마크 — 건메탈 각인.
 *
 * `design/` 의 아이콘 탐색 32턴 끝에 확정된 형태를 프로토타입에서 그대로 가져왔다.
 * 45도 회전한 D 형 판에 사선 홈이 파여 있고, 판은 위에서 아래로 밝기가 떨어지는
 * 건메탈 그라디언트다. **새로 그리지 않는다** — 아이콘은 재미를 만들지 않고 증폭할
 * 뿐이라 이 단계에서 다시 손대는 것은 전형적인 실패다 (`HANDOFF-TO-CODE.md` §8.3).
 *
 * `<defs>` 는 문서에 한 번만 있으면 되므로 `MarkDefs` 를 앱 루트에 한 번 깔고
 * `Mark` 는 `<use>` 로 참조한다. id 는 `nl-` 로 격리했다 — 사건 화면에도 SVG 가
 * 많이 생길 것이고, 전역 id 충돌은 조용히 엉뚱한 그림을 그린다.
 */

export function MarkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <linearGradient id="nl-mark-gun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aeb6c0" />
          <stop offset=".45" stopColor="#5a616b" />
          <stop offset="1" stopColor="#2b2f36" />
        </linearGradient>
        <clipPath id="nl-mark-clip">
          <path d="M62 34 L62 166 A92 66 0 0 0 62 34 Z" />
        </clipPath>
        <mask id="nl-mark-mask">
          <path d="M62 34 L62 166 A92 66 0 0 0 62 34 Z" fill="#fff" />
          <g stroke="#000" strokeWidth="10" strokeLinecap="round">
            <line x1="34" y1="182" x2="152" y2="64" />
            <line x1="20" y1="150" x2="120" y2="50" />
            <line x1="12" y1="118" x2="92" y2="38" />
          </g>
        </mask>
        <symbol id="nl-mark" viewBox="0 0 200 200">
          <g transform="rotate(45 100 100)">
            <rect width="200" height="200" fill="url(#nl-mark-gun)" mask="url(#nl-mark-mask)" />
            <g clipPath="url(#nl-mark-clip)" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round">
              <line x1="40" y1="184" x2="158" y2="66" />
              <line x1="26" y1="152" x2="126" y2="52" />
              <line x1="18" y1="120" x2="98" y2="40" />
            </g>
          </g>
        </symbol>
      </defs>
    </svg>
  )
}

/** `size` 는 바깥 판의 한 변. 마크는 그 안에서 70% 를 차지한다 */
export function Mark({ size = 24, radius = 6 }: { size?: number; radius?: number }) {
  const inner = Math.round(size * 0.72)
  return (
    <span
      className="nl-mark"
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" width={inner} height={inner} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))' }}>
        <use href="#nl-mark" />
      </svg>
    </span>
  )
}
