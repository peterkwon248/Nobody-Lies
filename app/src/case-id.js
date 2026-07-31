/**
 * 사건 id 규칙 — **한 곳에만 둔다.**
 *
 * `main.jsx` 의 `caseName()` 이 라우팅 값을 이 집합으로 거른다. 거기서 걸리면
 * 앱은 **조용히 산장으로 되돌아간다**(경고도 안 뜬다). 그래서 들여오기가 같은
 * 규칙을 문에서 쓰지 않으면 **저장은 됐는데 안 열리는 사건**이 생긴다 —
 * 유저에게는 「들여왔다」고 말해놓고 제목을 누르면 산장이 열린다.
 *
 * ⚠ `parseCase` 는 id 가 **있는지만** 본다. 문자 집합은 안 본다 — 그쪽은 엔진이고
 * 엔진에는 URL 이 없다. 라우팅 제약은 앱의 것이므로 앱이 지킨다.
 *
 * 이 저장소가 가장 많이 재발한 부류가 **「한 값이 여러 곳에 있는데 한 곳만 고쳤다」**다.
 * 정규식을 양쪽에 베껴 두면 그 부류가 하나 더 생긴다.
 */
export const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * ⚠ **`__proto__` 는 위 정규식을 통과한다** (밑줄이 허용 문자다).
 *
 * 사건 저장소는 `{ id: 사건 }` 꼴의 **평범한 객체**라 `store['__proto__'] = c` 는
 * 칸을 만드는 대신 **프로토타입을 갈아끼운다**. 반대로 읽는 쪽
 * (`main.jsx` 의 `all[name]`)은 `Object.prototype` 을 **truthy 한 사건**으로 받아간다.
 * 둘 다 예외가 안 나서 조용하다.
 *
 * 남의 파일이 이 문을 지나므로 이름으로 막는다.
 */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

export function isRoutableId(id) {
  return typeof id === 'string' && CASE_ID_RE.test(id) && !RESERVED.has(id);
}

/**
 * 이미 있는 id 면 `-2`, `-3` … 으로 비켜난다. **덮어쓰지 않는다.**
 *
 * 덮어쓰기는 이 저장소가 가장 비싸게 물린 부류다 — *"조용히 다른 사건이 되는 것이
 * 아무것도 안 나가는 것보다 나쁘다"*(`exportOne` 머리말). 산문을 입힌 사건은
 * **저작물**이라 되찾을 수 없다.
 *
 * 진행 저장 키가 `nobody-lies:<사건 id>` 라서 새 id 는 **옛 진행도 안 물려받는다** —
 * 이것도 덮어쓰기보다 나은 쪽이다.
 */
export function freshCaseId(base, taken) {
  if (!taken(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const id = `${base}-${n}`;
    if (!taken(id)) return id;
  }
  return `${base}-${Date.now()}`;
}
