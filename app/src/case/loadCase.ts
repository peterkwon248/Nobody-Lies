import type { Case } from '@engine/types'

/**
 * 사건 로드.
 *
 * `Case` 는 **불변**이다 (`HANDOFF-TO-CODE.md` §1). 그래서 사건은 코드가 아니라
 * 정적 파일이고, 서버 없이 CDN 에서 받아온다. 빌드 타임에 `engine` 이 YAML 을
 * 검증한 뒤 방출한 것만 여기 도달한다 — 앱은 사건의 논리를 다시 검사하지 않는다.
 */
export async function loadCase(id: string): Promise<Case> {
  const res = await fetch(`${import.meta.env.BASE_URL}cases/${id}.json`)
  if (!res.ok) throw new Error(`사건 '${id}' 를 불러오지 못했다 (${res.status})`)
  return (await res.json()) as Case
}

/** 한국어 표시용. `en` 은 번역이 붙은 뒤에 쓴다 */
export function ko(t: { ko: string; en?: string } | undefined): string {
  return t?.ko ?? ''
}
