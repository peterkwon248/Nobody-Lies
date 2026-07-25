import type { Particle } from '@engine/types'

/**
 * 한국어 조사 선택.
 *
 * `이/가` 같은 쌍에서 어느 쪽을 쓸지는 **앞말의 받침**이 정한다. 답을 플레이어가
 * 넣으므로 저작 시점에는 알 수 없고, 렌더 시점에 고른다.
 * (`HANDOFF-TO-CODE.md` §코드가 담당 — "한국어 조사 처리")
 *
 * 공란이 비어 있으면 조사를 붙이지 않는다. 빈칸 뒤에 `이` 나 `가` 가 미리 떠 있으면
 * **그 자체가 답의 받침을 알려주는 힌트가 된다** — 게임이 침묵해야 하는 자리다.
 */

/** 한글 음절의 받침 유무. 한글이 아니면(숫자·라틴) 받침 있음으로 본다 */
function hasFinal(word: string): boolean {
  const ch = word.trim().slice(-1)
  if (!ch) return false
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  // 라틴 숫자·문자는 읽는 소리로 갈리지만 v1 사건에 등장하지 않는다.
  // 등장하게 되면 여기에 예외표를 둔다 — 지금 추측으로 채우지 않는다
  return true
}

/** `(으)로` 는 ㄹ 받침에서 `로` 가 된다 */
function endsWithRieul(word: string): boolean {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 === 8
}

export function josa(word: string, particle: Particle | undefined): string {
  if (!particle || !word.trim()) return ''
  const [withFinal, withoutFinal] = particle.split('/') as [string, string]

  if (particle === '(으)로') return endsWithRieul(word) || !hasFinal(word) ? '로' : '으로'
  return hasFinal(word) ? withFinal : withoutFinal
}
