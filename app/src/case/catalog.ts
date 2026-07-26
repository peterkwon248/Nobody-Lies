/**
 * 캠페인 목록.
 *
 * 홈과 보고서가 같은 목록을 본다 — 보고서 문서 헤더의 `사건번호`가 여기 번호에서 나온다.
 * 캠페인 30개가 목표지만 지금 존재하는 사건은 하나다. 나머지는 자리만 보여준다.
 */
export type CampaignEntry = {
  num: string
  /** 사건 파일이 있으면 그 id, 없으면 null(준비 중) */
  id: string | null
  title: string
  est: string
  diff: string
}

export const CAMPAIGN: CampaignEntry[] = [
  { num: '01', id: 'mountain-lodge', title: '산장 살인사건', est: '40–60분', diff: 'hard' },
  { num: '02', id: null, title: '사건 02', est: '30–40분', diff: 'normal' },
  { num: '03', id: null, title: '사건 03', est: '40–60분', diff: 'hard' },
  { num: '04', id: null, title: '사건 04', est: '20–30분', diff: 'easy' },
  { num: '05', id: null, title: '사건 05', est: '30–40분', diff: 'normal' },
  { num: '06', id: null, title: '사건 06', est: '40–60분', diff: 'hard' },
]

/**
 * 진행 상태 칩 — 원본 `statusChip()`(2037행).
 *
 * **셋뿐이다.** 원본 `caseStatus()` 는 `clear`(다섯 장 완성) · `inProgress`(시작함) ·
 * `unplayed` 만 돌려준다. **실패가 없다** — 예산을 다 쓰고 못 끝내도 「진행 중」이다.
 * 이 게임은 틀린 답을 실패로 부르지 않고, 틀린 채로 종결된 조서를 남긴다.
 *
 * 「준비 중」(아직 없는 사건)은 여기 없다 — 그건 진행이 아니라 카탈로그 상태다.
 */
export function statusChip(status: 'unplayed' | 'in_progress' | 'cleared' | 'failed'): {
  label: string
  color: string
  background: string
} {
  // 원본은 여기서 게임 토큰을 쓰는데 **홈은 셸 밖이라 토큰이 죽는다** —
  // 앱은 `--g-*` 를 `:root` 로 올려서 고쳤다 (`DC-SYNC-CHANGESET.md` 8번)
  if (status === 'cleared')
    return { label: '클리어', color: 'var(--g-lock-mark)', background: 'var(--g-lock-bg)' }
  if (status === 'in_progress')
    return { label: '진행 중', color: 'var(--status-progress)', background: 'rgba(242, 201, 76, .14)' }
  return { label: '미플레이', color: 'var(--fg-3)', background: 'var(--bg-elevated-2)' }
}

/** 문서 헤더의 사건번호. 프로토타입 표기 그대로 `CASE-001` 꼴 */
export function caseNo(id: string): string {
  const n = CAMPAIGN.find((e) => e.id === id)?.num
  return n ? `CASE-${n.padStart(3, '0')}` : id.toUpperCase()
}
