/**
 * Vector 의 `StatusIcon` — 워크플로 상태 글리프.
 *
 * **원본은 DC 컴포넌트(`VectorDesignSystem_490b73.StatusIcon`)라 앱에서 못 쓴다.**
 * `_ds_bundle.js` 의 구현을 읽고 도형과 색을 그대로 옮겼다. 눈대중으로 원을
 * 그리지 않은 이유가 이것이다 — 디자인 시스템 컴포넌트는 계약이고, 링 두께
 * (`stroke-width:6` + `dasharray`)로 진행률을 표현하는 방식까지 정해져 있다.
 *
 * 보고서 장 머리에 붙는다 (원본 209행).
 */

export type Status = 'backlog' | 'todo' | 'progress' | 'review' | 'done' | 'canceled'

const COLOR: Record<Status, string> = {
  backlog: '#8A8F98',
  todo: '#9CA0A8',
  progress: '#F2C94C',
  review: '#4CB782',
  done: '#4C8DFF',
  canceled: '#62666D',
}

export function StatusIcon({ status = 'todo', size = 14 }: { status?: Status; size?: number }) {
  const c = COLOR[status] ?? COLOR.todo
  const p = { width: size, height: size, viewBox: '0 0 14 14' }

  if (status === 'backlog')
    return (
      <svg {...p}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="1.6 1.8" />
      </svg>
    )

  if (status === 'todo')
    return (
      <svg {...p}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" />
      </svg>
    )

  // 진행/검토는 같은 링에 채움 길이만 다르다 — 7.5 는 약 1/4, 14 는 약 1/2
  if (status === 'progress' || status === 'review')
    return (
      <svg {...p}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" />
        <circle
          cx="7" cy="7" r="3" fill="none" stroke={c} strokeWidth="6"
          strokeDasharray={status === 'progress' ? '7.5 100' : '14 100'}
          transform="rotate(-90 7 7)"
        />
      </svg>
    )

  if (status === 'done')
    return (
      <svg {...p}>
        <circle cx="7" cy="7" r="6" fill={c} />
        <path d="M4.3 7.1l1.8 1.8 3.4-3.6" stroke="#0A0A0B" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  return (
    <svg {...p}>
      <circle cx="7" cy="7" r="6" fill={c} />
      <path d="M5 5l4 4M9 5l-4 4" stroke="#0A0A0B" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
