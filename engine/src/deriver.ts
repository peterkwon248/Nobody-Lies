import type { Person, PresenceCell, SlotId } from './types.js'

/**
 * 진술 도출.
 *
 * 무고한 사람은 거짓말하지 않는다 — 자기 위치를 진실 그대로 진술한다.
 * 따라서 claim 오버라이드가 없으면 진술은 presence 에서 그대로 도출된다.
 * 손으로 claim 을 쓰지 않는 한 무고한 자의 진술에 거짓이 섞일 수 없다.
 *
 * 범인만 claim 을 선언한다 — presence(진실)와 다른 위치를 말하는 알리바이 거짓말.
 */

/** 한 인물이 진술하는 위치 격자. 무고 → presence, 범인 → claim */
export function claimGrid(p: Person): PresenceCell[] {
  return p.claim ?? p.presence
}

/** 진실만 말하는가 = claim 오버라이드가 없다 = presence 를 그대로 진술한다 */
export function tellsTruth(p: Person): boolean {
  return !p.claim
}

/** 특정 슬롯에서 진술하는 위치 (없으면 undefined = 미확인) */
export function claimedLocationAt(p: Person, slot: string): string | undefined {
  return claimGrid(p).find((c) => c.slot === slot)?.location
}

/** 특정 슬롯의 진실 위치 (없으면 undefined) */
export function trueLocationAt(p: Person, slot: string): string | undefined {
  return p.presence.find((c) => c.slot === slot)?.location
}

/**
 * 진술이 실제 동선과 어긋나는 슬롯.
 *
 * 무고한 자에게서 하나라도 나오면 "무고한 사람은 거짓말하지 않는다"가 깨진 것이고,
 * 범인에게서 하나도 안 나오면 잡아낼 거짓말이 없는 것이다. 검증기가 양쪽을 본다.
 */
export function divergentSlots(p: Person): SlotId[] {
  const truth = new Map(p.presence.map((c) => [c.slot, c.location]))
  const said = new Map(claimGrid(p).map((c) => [c.slot, c.location]))
  const slots = new Set([...truth.keys(), ...said.keys()])
  return [...slots].filter((s) => truth.get(s) !== said.get(s))
}
