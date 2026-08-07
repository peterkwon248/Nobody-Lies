/**
 * ─────────────────────────────────────────────────────────────────────
 *  조사(助詞) 해결기 — 문장을 만드는 쪽마다 필요하다
 * ─────────────────────────────────────────────────────────────────────
 *
 * `epilogue.ts` 에 있던 것을 그대로 뽑았다. 그 파일 주석이 이렇게 적어뒀다:
 *
 * > 앱에는 `particle()`·`batchim()` 이 진작 있는데 엔진에는 없어서, 문장틀이
 * > 엔진으로 내려온 순간 같은 결함이 재발했다. **문장을 만드는 쪽마다 이것이 필요하다.**
 *
 * ★ **진술 문장틀이 세 번째 소비자다** (2026-08-07 · voice 프로필). 그 예측이 맞았고,
 * 세 번째가 오는 순간 뽑는 것이 §one-value-two-places 의 처방이다.
 *
 * ⛳ **아직 안 옮긴 중복이 남아 있다** — `generate.ts` 에 `0xac00` 이 다섯 벌 더 있다
 * (`을/를` :1834 · `이/가` :2527 · `은/는` :2575 · :2226 · :2230). 진술 경로 밖이라
 * 이번 배치에서는 손대지 않는다. **옮길 때 여기로 온다.**
 */

/** 종성 인덱스. 0이면 받침 없음 */
export const jongseong = (w: string): number => {
  const s = (w || '').trim()
  if (!s) return 0
  const ch = s.charCodeAt(s.length - 1)
  if (ch < 0xac00 || ch > 0xd7a3) return 0
  return (ch - 0xac00) % 28
}

export const hasBatchim = (w: string): boolean => jongseong(w) > 0

/** ㄹ 받침. 종성 인덱스 8 */
export const RIEUL = 8

/**
 * `{값|을/를}` 꼴을 받침에 맞춰 고른다. 앞쪽이 받침 있을 때 쓰는 조사가 앞이다.
 * 값 자리는 `{키}`, 조사는 `{키|은/는}` 처럼 쓴다.
 *
 * ★ **`{^키|A/B}` — 조사만.** 값은 안 찍고 조사만 고른다. `「{label}」{^label|이라고/라고}`
 * 처럼 **값과 조사 사이에 따옴표가 끼는** 자리에 필요하다. 이게 없으면 문안이
 * `「{label}」{이라고/라고}` 로 적히는데, 키가 `\w+` 라 한글 조사는 매치가 안 돼
 * **치환이 안 된 채 화면에 나간다**(`cand-check §3` 이 그 부류를 문다).
 *
 * ⛔ **값이 팔레트에서 오므로 끝 글자를 코드가 모른다.** 진술 문장틀에서 「…로/으로」를
 * 손으로 쓰면 안 되는 이유가 이것이다 — `{place}{^place|으로/로}` 로 선언한다.
 */
export const fill = (tpl: string, vals: Record<string, string>) =>
  tpl.replace(/\{(\^?)(\w+)(?:\|([^/}]+)\/([^}]+))?\}/g, (_, only, k, withB, withoutB) => {
    const v = vals[k] ?? ''
    if (withB === undefined) return only ? '' : v
    /**
     * ★ **ㄹ 받침 예외** ★ 「으」로 시작하는 조사(으로 · 으로서 · 으며)는 **ㄹ 받침
     * 뒤에서 「으」가 빠진다** — 「홀으로」가 아니라 「홀로」다. 받침 유무만 보면
     * 이것을 놓친다: 초안 문안을 그대로 넣었더니 생성 6건 중 넷이 「홀으로」,
     * 손저작 하나가 「1층 화장실으로」였다.
     *
     * ⛳ **꼴로 알아낸다** — `withB` 가 「으」+`withoutB` 면 그 부류다. 이라고/라고
     * 처럼 「이」가 빠지는 짝에는 이 예외가 없으므로 건드리면 안 된다.
     */
    const j = jongseong(v)
    const dropsEu = withB.startsWith('으') && withB.slice(1) === withoutB
    const particle = j > 0 && !(dropsEu && j === RIEUL) ? withB : withoutB
    return only ? particle : v + particle
  })
