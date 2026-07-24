# DC 툴 동기화 changeset — 데이터 수정 (2026-07-24)

> **왜 이 파일이 있나.** 리포의 `추리게임.dc.html`(소스)에는 아래 데이터 수정이
> 들어갔지만 **DC 저작 툴(마스터)에는 안 들어갔다.** 그래서 DC 툴에서 뽑은 export
> 는 이 수정들이 빠진 stale 상태다. 아래를 **DC 툴에서** 적용해야(재export 시
> 덮어써지지 않게) 플레이테스트 빌드가 올바른 사건을 담는다.
>
> 엔진(TypeScript)은 이미 전부 반영·검증 완료 — 이건 프로토타입 쪽 미러링일 뿐이다.
> 적용 방법: DC 툴의 `dc_js_str_replace`(로직) 사용. `추리게임.dc.html` 대상.

---

## 1. 4장 협박대상 = 조유리 (구: 김채원) + 공범 라벨 폐기

**b15 정답 교체**
```
- b15: { kind: 'vTarget', src: 'person', ans: '김채원', par: null },
+ b15: { kind: 'vTarget', src: 'person', ans: '조유리', par: '을/를' },
```

**4장 서사 문장틀** (문장 자체가 "협박"을 안 쓰고 "입막음"을 물어서 조유리를
넣으면 서사가 깨졌다 → 문장을 고침)
```
- ...마약 유통망 {b14}의 것이었다. 조직은 {b15}의 입을 막으려 했고, 며칠 전 {b16} 그 실체를 캐묻기 시작한 참이었다.
+ ...마약 유통망 {b14}의 것이었다. 조직은 {b15} 약물로 붙들어 두고 있었고, 며칠 전 {b16} 그 실체를 캐묻기 시작한 참이었다.
```
(코드상 `{ text: '의 것이었다. 조직은 ' }, { b: 'b15' }, { text: '의 입을 막으려 했고, 며칠 전 ' }`
→ `{ text: '의 것이었다. 조직은 ' }, { b: 'b15' }, { text: ' 약물로 붙들어 두고 있었고, 며칠 전 ' }`)

**공범 라벨(`vAccomplice`) 4곳 제거** — 라벨 존재가 "범인 말고 한 명 더"를 조사
0회에 누설. 진실세계 accomplice 역할은 유지, 공란 라벨만 폐기.
- ko 라벨 사전: `vStaging: '위장물', vAccomplice: '공범', vLastSeen:` → `vStaging: '위장물', vLastSeen:`
- en 라벨 사전: `Staging: 'Staging', vAccomplice: 'Accomplice', vLastSeen:` → `... vLastSeen:`
- `CAT`: 끝의 `vTarget: 'susp', vAccomplice: 'susp' }` → `vTarget: 'susp' }`
- `catL`: 끝의 `vTarget: '협박대상', vAccomplice: '공범' }` → `vTarget: '협박대상' }`

---

## 2. 대포폰 동의어 해소 — 한 물건이 둘로 쪼개져 있었다

`대포폰`(짧은 이름)과 `별채 대포폰`은 같은 물건인데 후보에 둘 다 떠서 짧은 이름
고른 플레이어가 오답 처리됐다. `별채 대포폰`으로 통일.

**COLLECTED_POOL** — `대포폰` 제거
```
- [..., '유서', '대포폰', '김선생', ...]
+ [..., '유서', '김선생', ...]
```
**아이콘 사전** — `'대포폰': 'M5 2.5h6v11H5z M7 12h2',` 줄 삭제

**TERM_INFO** — `'대포폰': {...}` 줄 삭제. `별채 대포폰` 서술을 실물에 맞춤:
```
'별채 대포폰': { fk: '별채 수색', dk: '가입자 정보가 없었고, 저장된 번호는 하나뿐이었다.', fe: 'Annex search', de: 'No subscriber on record; only one number was saved.' },
```
(구 서술 "별채 안쪽에 놓여 있던 또 다른 선불폰" = 존재하지 않는 두 번째 폰이었음)

**조사 결과 카드** — 발견 위치 통일 (엔진 `e_burner.foundAt`)
```
- dKo: '별채 서랍에서 발신 전용 대포폰. ...'  dEn: 'A burner phone in the annex drawer, ...'
+ dKo: '별채 게임기 뒤에서 발신 전용 대포폰. ...'  dEn: 'A burner phone behind the annex game console, ...'
```

---

## 3. 확보 단어 획득 그래프 — 엔진에 맞춤

별채 수색이 한 번에 3단어(별채폰+김선생+마약)를 줘서 엔진보다 쉬웠고, 원영
소지품 조사는 확보 단어를 하나도 안 줘 헛돌았다. 폭로 임박은 4장 완료 무료
공개라 예산 경제가 무너졌다.

**TERM_MAP 재구성**
```
- TERM_MAP = { 'autopsy:body': ['일산화탄소 중독'], 'search:annex': ['대포폰', '별채 대포폰', '김선생', '마약'], 'belongings:sakura': ['유서'], 'belongings:yuri': ['치정'] };
+ TERM_MAP = { 'autopsy:body': ['일산화탄소 중독'], 'search:annex': ['별채 대포폰', '김선생'], 'belongings:wonyoung': ['김선생', '마약', '폭로 임박'], 'belongings:sakura': ['유서'], 'belongings:yuri': ['치정'] };
```
- `search:annex`: `마약`·`대포폰` 제거 → `[별채 대포폰, 김선생]` (엔진 e_burner 일치)
- `belongings:wonyoung` 신설 → `[김선생, 마약, 폭로 임박]` (엔진 e_wy_text 완전 일치)

**REVEALS.s4** — `폭로 임박` 무료 공개 제거 (유리 진술 statement 는 유지)
```
- s4: { yield: 'path', terms: ['폭로 임박'], statements: [...] },
+ s4: { yield: 'path', statements: [...] },
```

---

## 참고 — 슬롯/장소/진술 격자는 프로토타입이 이미 맞다

엔진에 새로 넣은 4슬롯(t0~t3)·locations(scene·offsite)·presence/claim 도출 모델은
프로토타입의 `LOCATIONS`(scene:true·offsite:true)·`CLAIMS`/`CLAIM_LOC` 와 이미 일치한다
(엔진 데이터를 프로토타입에서 역설계했으므로). 프로토타입 쪽 수정 불필요.
