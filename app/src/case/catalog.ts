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

/** 문서 헤더의 사건번호. 프로토타입 표기 그대로 `CASE-001` 꼴 */
export function caseNo(id: string): string {
  const n = CAMPAIGN.find((e) => e.id === id)?.num
  return n ? `CASE-${n.padStart(3, '0')}` : id.toUpperCase()
}
