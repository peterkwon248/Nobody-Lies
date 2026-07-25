import type { Case, Person } from '@engine/types'

/**
 * 인물의 표시 속성 — 색·이니셜·관계.
 *
 * 셋 다 **사건 데이터와 무관해야 한다.** 유죄 여부나 유용도를 보고 정하면
 * 그 순간 색이 정답을 가리킨다. 색은 배열 순서로, 이니셜은 이름으로,
 * 관계는 `presence` 로만 정한다.
 */

/** 원본 `PEOPLE[].color`(1417~1421행) 다섯 색 그대로, 같은 순서로 */
const COLORS = [
  'var(--label-orange)',  // 문세라
  'var(--label-blue)',    // 서지안
  'var(--label-purple)',  // 한유빈
  'var(--label-green)',   // 오나경
  'var(--status-progress)', // 백리원 — 원본 #F2C94C
  'var(--label-red)',
]

export const personColor = (i: number) => COLORS[i % COLORS.length]

/**
 * 아바타 이니셜. **성이 아니라 이름의 첫 글자다.**
 *
 * 원본 `ini` 는 `예·유·쿠·리·원` 으로 **옛 이름의 잔재**였다(예나·유진·사쿠라·
 * 유리·원영). 이름 교체 때 따라가지 않은 것이라 그대로 옮기면 안 된다.
 * 규칙대로 다시 계산한다 — 서지안→지, 한유빈→유, 문세라→세, 오나경→나, 백리원→리.
 *
 * 한국 이름은 성 한 글자 + 이름 두 글자가 기본이라 두 번째 글자를 쓴다.
 * 두 글자 이름이면 첫 글자로 떨어진다.
 */
export function initialOf(name: string): string {
  return name.length >= 3 ? name.slice(1, 2) : name.slice(0, 1)
}

/**
 * 피해자와의 관계 — 원본 `relKo`(산장 거주 / 아침 도착 / 불참·늦게 출발).
 *
 * **필드로 두지 않고 `presence` 에서 도출한다.** 손으로 적으면 동선을 고칠 때
 * 관계가 따라가지 않고, 그렇게 갈라진 것을 아무도 못 잡는다 — 유서 버그와 같은
 * 형태다.
 *
 * ★ 도출에 `hiddenRole` 이나 유죄를 쓰지 않는다 ★ 동선은 진술로 이미 공개된
 * 정보이므로 누설이 아니지만, 역할을 섞는 순간 칩이 정답을 가리킨다.
 */
export function relationOf(c: Case, p: Person): string {
  const offsite = new Set(c.locations.filter((l) => !l.atLodge).map((l) => l.id))
  const first = c.slots[0]?.id
  const windowSlots = new Set(c.slots.filter((s) => s.isWindow).map((s) => s.id))

  const cells = p.presence ?? []
  if (cells.some((x) => x.slot === first)) return '산장 거주'
  if (cells.some((x) => windowSlots.has(x.slot) && offsite.has(x.location)))
    return '불참·늦게 출발'
  return '아침 도착'
}
