import React from 'react';
import { dump, load } from 'js-yaml';
import { run } from '@engine/orchestrate.ts';
import { verify } from '@engine/verifier.ts';
import { caseToRaw } from '@engine/to-yaml.ts';
import { parseCase } from '@engine/schema.ts';
import briefRaw from '../../engine/templates/PALETTE-BRIEF.md?raw';
import proseRaw from '../../engine/templates/PROSE-BRIEF.md?raw';
import stmtRaw from '../../engine/templates/STATEMENT-BRIEF.md?raw';
/**
 * ★ 내장 세계 ★ (2026-07-29 신설)
 *
 * **저장소에 커밋돼 있는 팔레트를 앱이 그대로 읽는다.** 전에는 이 파일들이
 * 있는데도 유저에게 매번 챗봇 왕복을 시켰다 — 서식 복사 → 챗봇 → JSON 붙여넣기.
 * 팔레트는 **세계**라서 재사용 대상인데(`NEXT-ACTION` §기계를 옮기면 무엇이
 * 남나: *"세계는 남고 사건은 사라진다"*), 앱만 그걸 몰랐다.
 *
 * `?raw` 로 읽는 것은 서식 둘과 **같은 경로**다. 파싱은 붙여넣기와 한 코드로
 * 지나가게 해서 「내장이라 다르게 동작한다」가 안 생기게 한다.
 */
import paletteResidency from '../../engine/templates/palette-residency.json?raw';
import paletteMuseum from '../../engine/templates/palette-museum.json?raw';
import paletteExample from '../../engine/templates/palette-example.json?raw';

/**
 * 캠페인 생성기.
 *
 * ★ 유저가 알고 한다 ★ (2026-07-29 사용자 결정)
 * 앱이 몰래 사건을 만들어내지 않는다. 유저가 **서식을 복사해 자기 챗봇에서
 * 받아온 뒤 붙여넣는다.** 그래야 「기계가 준 것」이 아니라 **자기 세계**가 되고,
 * 실패했을 때 무엇이 잘못됐는지도 보인다(검증기 오류를 그대로 되붙이면 된다).
 *
 * 그리고 **절대 규칙 「런타임 LLM 0」을 지킨다.** 금지된 것은 앱이 LLM 을 부르는
 * 것이고, 유저가 자기 챗봇에 붙여넣는 것은 앱 밖의 일이다 — API 키도 과금도
 * 네트워크도 없다.
 *
 * ★ 엔진을 이식하지 않고 참조한다 ★ `vite.config.ts` 의 `engineResolver` 가
 * 이미 그 길을 내뒀다. 같은 판정 로직이 두 벌 있으면 반드시 갈라진다 —
 * 2026-07-24에 엔진과 프로토타입이 정확히 그렇게 14곳 어긋났다.
 */

const STORE = 'nobody-lies:generated';

/**
 * 서식에서 「복사할 부분」만 잘라낸다. 파일이 바뀌면 화면도 따라 바뀐다.
 *
 * ★ 표시가 **줄 전체**일 때만 잡는다 ★ `indexOf` 로 찾으면 서식 머리말이
 * 「아래 `⬇ 여기서부터 복사` 이후를 복사하라」고 **설명하는 문장**을 먼저 물어서
 * 머리말이 통째로 브리프에 딸려 들어간다. `PROSE-BRIEF.md` 가 실제로 그렇다
 * (2026-07-28 실측 — `{{ }}` 가 둘이어야 하는데 셋으로 세어졌다).
 * 서식에서 그 문장을 지우는 게 아니라 **읽는 쪽을 정확하게** 한다.
 */
function copyBlock(raw) {
  const s = raw.match(/^⬇ 여기서부터 복사[^\n]*\n/m);
  const e = raw.match(/^⬆ 여기까지 복사[^\n]*$/m);
  if (!s || !e) return raw;
  return raw.slice(s.index + s[0].length, e.index).trim();
}
function briefBody() { return copyBlock(briefRaw); }

/**
 * 산문이 입혀졌나. **표시를 남겨서 판단한다** — 자리표시 문장을 문자열로
 * 알아보려 하면 산문가가 비슷하게 쓰는 순간 틀린다. `_difficulty`·`_oracle` 과
 * 같은 부류의 메타다.
 */
function hasProse(c) { return Boolean(c && c._prose); }

/** `undefined` 인 키를 턴다 — YAML 에 `key: null` 이 찍히면 읽는 사람이 헷갈린다 */
function tidy(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
}

/**
 * ─────────────────────────────────────────────────────────────
 *  ② 산문가 — 진술 의뢰서를 이 사건으로 채운다 (2026-07-28)
 * ─────────────────────────────────────────────────────────────
 *
 * **서식은 한 벌이다.** 문안을 여기서 새로 쓰지 않고 `PROSE-BRIEF.md` 의 복사
 * 블록을 그대로 쓰되, 서식이 비워둔 `{{ }}` 두 자리에 이 사건의 값을 끼운다.
 * 같은 규칙이 두 벌 있으면 반드시 갈라진다 — 이 저장소가 07-24에 엔진↔프로토타입
 * 14곳으로 배운 것이다.
 *
 * ⚠ **서식이 바뀌어 `{{ }}` 가 둘이 아니면 조용히 넘어가지 않는다.** 화면에
 * 그 사실을 띄운다. 브리프가 반쯤 빈 채로 챗봇에 가는 것이 제일 비싸다.
 *
 * 「한 인물씩」이 아니라 **다섯 명을 한 번에** 받는다. 서식의 그 지침은 인물당
 * 10~14문단인 손글씨 사건을 전제한 것이고, 생성 사건은 인물당 4문단이라 다섯을
 * 합쳐도 스무 문단이다. 오히려 **말투 구분·불안 편중 금지·지문 전원/전무**가
 * 인물 사이의 규칙이라 한 번에 보는 편이 지키기 쉽다.
 */
/**
 * ─────────────────────────────────────────────────────────────
 *  ③ 진술 다시 쓰기 — **초안을 주고 살만 붙이게 한다** (2026-07-30 신설)
 * ─────────────────────────────────────────────────────────────
 *
 * `proseRequest` 와 갈라놓은 이유가 둘이다.
 *
 * ① **과업이 넓으면 가장 긴 것이 가장 얇게 나온다.** 산문 서식은 프롤로그·지문·
 *    장 서사·조사 결과문·확보 단어까지 한꺼번에 시킨다. 진술이 그중 제일 길다.
 * ② **거기서는 산문가가 논리 YAML 을 읽고 진술을 새로 쓴다** — 사실이 흐를 자리가
 *    넓다(§9-7·§9-10 이 그걸 잡으려고 있다). 여기서는 **조립 진술이 초안**이라
 *    사실이 이미 문장 안에 박혀 있다. 틀릴 자리가 좁다.
 *
 * 초안은 **엔진이 만든 그대로** 넣는다. 여기서 다시 조립하면 화면에 보이는 것과
 * 챗봇이 보는 것이 갈라진다 — 이 저장소가 여러 번 물린 「같은 값 두 곳」이다.
 */
function statementRequest(c) {
  const draft = (c.people || []).map((p) => {
    const ps = (p.statement?.paragraphs || []).map((x) => (typeof x === 'string' ? x : x?.ko || ''));
    const g = p.statement?.gesture;
    const pre = g?.pre ? (typeof g.pre === 'string' ? g.pre : g.pre.ko) : '';
    const post = g?.post ? (typeof g.post === 'string' ? g.post : g.post.ko) : '';
    return [
      `- id: ${p.id}          # ${p.name} · ${p.age}세 · ${p.job}`,
      ...(pre ? [`  # 지문(앞): ${pre}`] : []),
      '  statement:',
      '    paragraphs:',
      ...ps.map((t) => `      - ${JSON.stringify(t)}`),
      ...(post ? [`  # 지문(뒤): ${post}`] : []),
    ].join('\n');
  }).join('\n');

  // 조사로만 얻는 낱말. 진술이 먼저 말하면 조사할 이유가 사라진다 (§9-10)
  const seeds = c.seedTerms || [];
  const forbidden = (c.terms || []).map((t) => t.word).filter((w) => !seeds.includes(w));

  const 보충 = [
    '## 이 사건에 대한 보충',
    '',
    `- 시간대는 ${(c.slots || []).map((s) => s.label).join(' → ')} 입니다.`,
    '  **초안이 어느 시간대에 어디였다고 말하는지 그대로 지키세요.** 순서를 바꾸거나',
    '  시간대를 합쳐 말해도 되지만, **어디 있었는지가 달라지면 안 됩니다.**',
    '- **다섯 명을 한 번에** 써 주세요. 말투 구분·불안 편중 금지·길이 균일이 전부',
    '  인물 **사이**의 규칙이라 한 번에 봐야 지켜집니다.',
    '',
    '### ⛔ 진술에 나오면 안 되는 낱말',
    '',
    '플레이어가 **조사로 얻어야 하는 것**입니다. 진술이 먼저 말하면 조사할 이유가 사라집니다.',
    '',
    '```',
    forbidden.length ? forbidden.join(' · ') : '(없음)',
    '```',
    /**
     * ★ 씨앗은 **둘 이상**이 말해야 한다 ★ (2026-07-30 · 첫 완성본에서 발견)
     *
     * 첫 왕복 결과에서 씨앗 「보온병」을 **범인 혼자** 말했고, 그 보온병이 **흉기**
     * 였다. 사망 구간에 그걸 들고 있었다고 스스로 말한 유일한 사람이 범인이다 —
     * 07-29의 「범인만 순순히 다 말한다」와 같은 부류이고 **기계가 못 잡는다.**
     *
     * ⚠ **「범인은 말하지 마세요」로 쓸 수 없다** — 이 서식은 초안만 주므로 산문가는
     * 누가 범인인지 모른다(그리고 알려주면 더 위험하다). **둘 이상**이면 누가
     * 범인이든 모양이 안 갈린다. 산장도 씨앗을 무고한 사람이 말한다.
     */
    seeds.length ? '\n### 씨앗 낱말 — **두 사람 이상**이 말하게 하세요\n' : '',
    seeds.length ? '```' : '',
    seeds.length ? seeds.join(' · ') : '',
    seeds.length ? '```' : '',
    seeds.length
      ? '이건 **진술만 읽어도 얻어야 하는 낱말**이라 누군가는 반드시 말해야 합니다. '
        + '다만 **한 사람만 말하면 그 사람이 표시**가 됩니다 — 실제로 그렇게 나왔고, '
        + '그 하나가 범인이었습니다. 「무엇이었나」까지만 말하고 뜻은 붙이지 마세요.'
      : '',
  ].filter((x) => x !== '').join('\n');

  const body = copyBlock(stmtRaw);
  const holes = body.match(/\{\{[\s\S]*?\}\}/g) || [];
  if (holes.length !== 1) return { text: null, holes: holes.length };
  const filled = body.replace(/\{\{[\s\S]*?\}\}/, `\`\`\`yaml\npeople:\n${draft}\n\`\`\``);
  return { text: `${filled}\n\n${보충}\n`, holes: 1 };
}

function proseRequest(c) {
  const logic = dump(tidy({
    title: c.title,
    incident: tidy({ description: c.incident?.description, scene: c.incident?.scene }),
    victim_profile: c.victimProfile,
    slots: c.slots,
    locations: (c.locations || []).map((l) => tidy({ id: l.id, label: l.label })),
    culprit: c.culprit,
    people: (c.people || []).map((p) => tidy({
      id: p.id, name: p.name, age: p.age, job: p.job,
      presence: p.presence, claim: p.claim,
    })),
    // 장과 그 장을 완성했을 때 도착하는 것. 없으면 산문가가 박자를 못 본다
    chapters: (c.chapters || []).map((ch) => tidy({ order: ch.order, title: ch.title })),
    reveals: (c.reveals || [])
      .filter((r) => r.trigger?.on === 'chapterComplete')
      .map((r) => tidy({
        chapter: r.trigger.chapterOrder,
        narration: r.narration,
        addClaims: (r.addClaims || []).map((a) => tidy({ speaker: a.speaker, content: a.content })),
      })),
  }), { lineWidth: 100, noRefs: true });

  // 조사로만 얻는 단어. 진술이 먼저 말하면 조사할 이유가 사라진다
  const seeds = c.seedTerms || [];
  const forbidden = (c.terms || []).map((t) => t.word).filter((w) => !seeds.includes(w));

  /**
   * 채워 올 자리. **프롤로그가 2026-07-29에 늘었다.**
   *
   * 전에는 진술만 받았다 — 서식(`PROSE-BRIEF.md`)은 `prologue` 도 요구하는데
   * 생성기가 *"아래 자리만 채우세요"* 로 잘라내고 있었다. 그래서 생성 사건의
   * 프롤로그는 코드가 만든 뼈대 그대로였다.
   */
  const 이름 = Object.fromEntries((c.people || []).map((p) => [p.id, p.name]));
  const chRevs = (c.reveals || []).filter((r) => r.trigger?.on === 'chapterComplete');
  /**
   * ★ 진술을 뺐다 ★ (2026-07-30) — 5번(`STATEMENT-BRIEF`)이 전담한다. 여기 남겨두면
   * **같은 것을 두 번 의뢰**하게 되고, 나중에 넣은 쪽이 앞의 것을 덮는다.
   *
   * ★ 조사 층 셋을 넣었다 ★ 서식 본문은 처음부터 요구했는데 **여기가 잘라내고
   * 있었다** — 프롤로그(07-29) · 장 서사(07-29)에 이은 **셋째**다. 산장 실측으로
   * 조사 결과문 778자 · 물증 기록 438자 · 단어 note 276자이고, **플레이어가
   * 조사할 때마다 읽는 글**이다.
   *
   * ⚠ **결과문이 이미 있는 조사만 보여준다.** 빈손 조사에 결과를 만들어 오면
   * 「아무것도 없음」이 사라져 난이도가 통째로 바뀐다 — 병합도 같은 조건으로 막는다.
   */
  const actWithResult = (c.actions || []).filter((a) => a.result);
  const fill = ['prologue:', '  - "..."   # 4줄 안팎', '']
    .concat(chRevs.length ? ['reveals:'] : [])
    .concat(chRevs.map((r) => {
      const ch = (c.chapters || []).find((x) => x.order === r.trigger.chapterOrder);
      const head = `  - trigger: { on: chapterComplete, chapterOrder: ${r.trigger.chapterOrder} }   # ${ch?.title ?? ''}\n    narration: "..."`;
      const cl = (r.addClaims || []).map(
        (a) => `    addClaims:\n      - speaker: ${a.speaker}      # ${이름[a.speaker] ?? ''}\n        content: "..."`,
      );
      return [head, ...cl].join('\n');
    }))
    .concat(actWithResult.length ? ['', 'actions:'] : [])
    .concat(actWithResult.map((a) =>
      `  - id: ${a.id}          # ${a.label}\n    result:\n      title: "..."\n      body:  "..."`))
    .concat((c.evidence || []).length ? ['', 'evidence:'] : [])
    .concat((c.evidence || []).map((e) =>
      `  - id: ${e.id}          # ${e.description}\n    record: "..."`))
    .concat((c.terms || []).length ? ['', 'terms:'] : [])
    .concat((c.terms || []).map((t) => `  - word: ${t.word}\n    note: "..."`))
    .join('\n');

  const slots = c.slots || [];
  const 보충 = [
    '## 이 사건에 대한 보충',
    '',
    /**
     * ★ 진술 규칙을 전부 뺐다 ★ (2026-07-30) — 5번(`STATEMENT-BRIEF`)으로 옮겼다.
     * 여기 남겨두면 **같은 규칙이 두 의뢰서에** 있게 되고, 오늘만 그 부류에 네 번
     * 물렸다. 여기 남는 것은 **장 서사 + 조사 층** 규칙뿐이다.
     */
    '⛔ **진술(`statement`)은 이 요청 대상이 아닙니다.** 5번에서 따로 받습니다 —',
    '여기서 진술을 써 오면 5번에서 받은 것을 덮어버립니다.',
    '',
    '### 조사 층 — 플레이어가 **조사할 때마다** 읽는 글입니다',
    '',
    '`actions[].result`(조사 결과문) · `evidence[].record`(물증 카드) ·',
    '`terms[].note`(확보 단어 사전). 손으로 쓴 레퍼런스 실측으로 **결과문 15건 778자**',
    '(건당 평균 52자)인데 기계 조립은 건당 36자입니다.',
    '',
    '- **그 조사가 실제로 주는 것만** 말하세요. 안 주는 물증·단어를 언급하면 플레이어가',
    '  문장에서 보고 은행에서 못 찾습니다(검증기 §9-8 이 경고합니다).',
    '- ⛔ **판정하지 마세요.** 「수상하다」·「결정적이다」 금지. **본 것만** 적습니다.',
    '- ⛔ **결정적 단서와 레드 헤링을 같은 온도로** 쓰세요. 쓸모 있는 쪽만 길거나 힘주면',
    '  **그게 곧 정답 누설**입니다 — 이 게임에서 가장 비싼 결함입니다.',
    '- **`id`·`word` 는 그대로 두세요.** 그건 논리입니다. `title`·`body`·`record`·`note`',
    '  만 고칩니다. `gives`·`yield`·`cost` 를 써 보내도 **무시됩니다.**',
    '- 결과문이 **이미 있는 조사만** 아래 목록에 있습니다. 빈손 조사에 결과를 만들면',
    '  「아무것도 없음」이 사라져 난이도가 통째로 바뀝니다.',
    ...(chRevs.length ? [
      '',
      '### 장 완성 서사 (`reveals`)',
      '',
      '장을 완성하면 도착하는 것입니다. **`trigger` 와 `speaker` 는 그대로 두고**',
      '`narration` 과 `content` 만 고쳐 주세요 — 누가 언제 말하는가는 논리입니다.',
      '',
      '- **`narration` 은 전부 채우거나 전부 비우거나** 둘 중 하나입니다. 일부만 있으면',
      '  서사의 유무가 곧 「이 장이 중요하다」는 표시가 되어 검증기가 반려합니다.',
      '- ⛔ **서로를 봤다는 말을 쓰지 마세요.** 「그때 ○○씨가 거기 있었다」·「저 혼자',
      '  있었다」는 둘 다 사건을 망칩니다 — 하나는 범인의 거짓말을 공짜로 벗기고,',
      '  다른 하나는 그 말 자체가 거짓이 됩니다. **자기 자신에 대한 말만** 쓰세요.',
      '- ⛔ **「이제 ○○를 조사해 보자」류 금지.** 조사 추천은 이 게임에서 금지입니다.',
      '- 장 제목은 캐낸 기록의 이름입니다. **서사에서 그 이름을 되뇌지 마세요.**',
    ] : []),
    '',
    '### ⛔ 진술에 나오면 안 되는 단어',
    '',
    '플레이어가 **조사로 얻어야 하는 것**입니다. 진술이 먼저 말하면 조사할 이유가 사라집니다.',
    '',
    '```',
    forbidden.length ? forbidden.join(' · ') : '(없음)',
    '```',
    '',
    seeds.length ? `\`${seeds.join('` · `')}\` 는 씨앗 단어라 나와도 됩니다 — 단 「무엇이었나」까지만.` : '',
  ].filter((x) => x !== '').join('\n');

  const body = copyBlock(proseRaw);
  const holes = body.match(/\{\{[\s\S]*?\}\}/g) || [];
  if (holes.length !== 2) return { text: null, holes: holes.length };

  let i = 0;
  const filled = body.replace(/\{\{[\s\S]*?\}\}/g, () => (i++ === 0
    ? logic
    : `**아래 자리만 채우세요.** 나머지 항목은 이번 요청 대상이 아닙니다.\n\n\`\`\`yaml\n${fill}\n\`\`\``));

  return { text: `${filled}\n\n${보충}\n`, holes: 2 };
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
}
function saveStore(v) {
  try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* 용량 초과 — 막지 않는다 */ }
}

/**
 * 키 순서만 재귀로 정렬해 비교 가능한 꼴로 만든다.
 * **`cli.ts` 의 것과 같은 함수다** — 왕복 대조가 엔진과 앱에서 서로 다른 자를
 * 대면 대조하는 뜻이 없다.
 */
const stable = (v) => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, stable(x)]),
    );
  }
  return v;
};

/**
 * 생성 사건 → **저작 가능한 YAML.**
 *
 * ★ 왜 필요한가 ★ 생성 사건은 `localStorage` 에만 산다 — 만든 브라우저에서만
 * 보이고 다른 기계에서 홈을 열면 없다. 팔레트+seed 로 **재현**은 되지만,
 * **산문을 입히는 순간 그것은 생성물이 아니라 저작물**이라 재현으로 못 되찾는다.
 * 챗봇이 준 문장은 seed 에서 안 나온다. (`NEXT-ACTION` 표 4번 ⓑ · `to-yaml.ts`
 * 머리말이 같은 말을 한다: *"사람이 고치고 git 이 추적하는 형태로 남아야 한다"*.)
 *
 * ★ 엔진과 **같은 코드·같은 옵션**으로 쓴다 ★ `caseToRaw` 도 `dump` 옵션도
 * `cli.ts --emit --yaml` 그대로다. 여기서 YAML 을 손으로 조립하면
 * `engine/cases/` 에 커밋될 파일이 엔진이 쓰는 것과 갈라진다.
 *
 * ★ 왕복 대조까지 같이 한다 ★ 쓴 것을 `parseCase` 로 다시 읽어 원본과 대조한다.
 * 엔진이 `exit 1` 로 막는 자리다 — *"조용히 다른 사건이 되는 것이 이 저장소에서
 * 가장 비싼 결함이었다"*. 이걸 하려고 `schema.ts` 에서 `node:fs` 를 뺐다.
 */
function caseYaml(c) {
  /**
   * `_difficulty`·`_oracle`·`_prose` 는 앱이 목록 표시용으로 붙인 것이지 사건이
   * 아니다. `caseToRaw` 가 어차피 안 읽지만 **대조의 반대편**에는 없어야 한다.
   */
  const clean = Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith('_')));
  const text = dump(caseToRaw(clean), { lineWidth: 110, noRefs: true });
  const back = parseCase(load(text), `${c.id}.yaml`);
  return { text, same: JSON.stringify(stable(back)) === JSON.stringify(stable(clean)) };
}

const DIFFS = [
  { id: 'easy', ko: '쉬움', hint: '예산에 여유가 둘. 헛발질해도 된다' },
  { id: 'normal', ko: '보통', hint: '여유 하나. 권장' },
  { id: 'hard', ko: '어려움', hint: '여유 0 — 한 번의 헛발질도 허용되지 않는다' },
];

/**
 * 고를 수 있는 세계. `raw` 가 없는 둘은 특수 항목이다 —
 * `default` 는 팔레트 없이(엔진 기본 어휘), `custom` 은 챗봇에게 받아온 것.
 */
const WORLDS = [
  { id: 'residency', ko: '레지던시', hint: '입주 작가 · 창작촌', raw: paletteResidency },
  { id: 'museum', ko: '박물관', hint: '야간 순찰 · 반출 신청서', raw: paletteMuseum },
  { id: 'example', ko: '방송국', hint: '엔진에 딸린 예시', raw: paletteExample },
  { id: 'default', ko: '기본 어휘', hint: '산장풍 — 화면부터 보고 싶을 때', raw: null },
  { id: 'custom', ko: '직접 만든다', hint: '챗봇에게 받아온다', raw: null },
];

/** 유저가 붙여넣은 팔레트는 남는다 — 세계는 재사용 대상이다 */
const PALETTE_KEY = 'nobody-lies:palette';
function loadPalettePref() {
  try { return JSON.parse(localStorage.getItem(PALETTE_KEY) || 'null') || {}; } catch { return {}; }
}
function savePalettePref(v) {
  try { localStorage.setItem(PALETTE_KEY, JSON.stringify(v)); } catch { /* 용량 초과 — 막지 않는다 */ }
}

const box = {
  background: 'var(--bg-surface, #14161a)',
  border: '1px solid var(--border, #2a2e35)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '18px 20px',
};
const btn = (primary) => ({
  padding: '9px 16px',
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: 'var(--r-sm, 7px)',
  border: primary ? 'none' : '1px solid var(--border-strong, #3a4049)',
  background: primary ? 'var(--accent, #4C8DFF)' : 'transparent',
  color: primary ? '#fff' : 'var(--fg-2, #c8ccd4)',
  cursor: 'pointer',
});
const stepNo = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '22px', height: '22px', borderRadius: '50%',
  background: 'var(--accent, #4C8DFF)', color: '#fff',
  fontSize: '12px', fontWeight: 700, marginRight: '9px', flex: 'none',
};

export default function Generator() {
  const [difficulty, setDifficulty] = React.useState('normal');
  const [chapters, setChapters] = React.useState(5);
  /**
   * 사망 구간 칸 수 (1~3). **기본 1이면 전과 같은 사건이 나온다** — 엔진에서
   * 12건 diff 로 확인했다. 2 이상이면 각자 구간 안에서 두 번 움직이므로
   * 알리바이 대조가 「구간 안에 있었나」에서 조합 문제로 바뀐다.
   */
  const [deathCells, setDeathCells] = React.useState(1);
  /**
   * 고른 세계와 붙여넣은 팔레트는 **저장한다.** 안 하면 사건 하나 만들 때마다
   * 챗봇 왕복을 다시 해야 한다 — 라우트가 바뀌면 `key` 로 재마운트되므로
   * `useState('')` 는 매번 빈칸이었다(2026-07-28 §`key` 가 없으면 참조).
   */
  const [pref] = React.useState(loadPalettePref);
  const [world, setWorld] = React.useState(() => pref.world || 'residency');
  const [paletteText, setPaletteText] = React.useState(() => pref.text || '');
  const [busy, setBusy] = React.useState(false);
  const [errs, setErrs] = React.useState([]);
  const [made, setMade] = React.useState(() => Object.values(loadStore()));
  const [copied, setCopied] = React.useState('');
  // 클립보드가 막혔을 때 직접 복사할 자리. `{ what, text }`
  const [manual, setManual] = React.useState(null);
  // ② 산문 단계 — 산문을 입힐 사건 id · 챗봇이 준 YAML · 결과
  const [proseFor, setProseFor] = React.useState(null);
  const [proseText, setProseText] = React.useState('');
  /**
   * 진술(5번)과 그 밖의 산문(6번)이 **각자 자기 칸**을 갖는다 (2026-07-30).
   * 처음엔 칸 하나를 둘이 나눠 썼는데, 나란히 놓인 버튼 둘이 **동급 선택지**로
   * 읽히고 「어느 칸에 붙이지」가 새 실수거리가 됐다. 단계를 가르면 둘 다 사라진다.
   */
  const [stmtText, setStmtText] = React.useState('');
  /** `{ tag: 'stmt' | 'prose', ok, lines }` — 어느 단계의 결과인지 태그로 갈라 그린다 */
  const [proseMsg, setProseMsgRaw] = React.useState(null);
  // 내보내기 결과. `{ id, ok, line }` — 사건 행 밑에 그 행 것만 뜬다
  const [saveMsg, setSaveMsg] = React.useState(null);

  /**
   * 복사. **세 단계로 내려간다.**
   *
   * `navigator.clipboard` 는 **보안 컨텍스트에서만** 산다 — `https` 나 `localhost`.
   * 테스터에게 보내는 단일 HTML 은 `file://` 로 열리고, **안드로이드에서 받으면
   * `content://…/external_files/…`** 로 열린다. 둘 다 보안 컨텍스트가 아니라
   * 브라우저가 복사를 막는다(2026-07-29 안드로이드 실측).
   *
   *   1. clipboard API
   *   2. `execCommand('copy')`   — 옛 방식이지만 비보안 컨텍스트에서 종종 된다
   *   3. **화면에 펼쳐서 직접 복사**
   *
   * 3번이 이 고침의 핵심이다. 전에는 「직접 선택해 복사해라」라고 **말만 하고
   * 정작 선택할 것을 안 보여줬다.** 게다가 그 안내를 생성 오류 자리(`errs`)에
   * 띄워서 제목이 「만들지 못했다」로 나왔다 — 만든 적이 없는데.
   */
  const copy = (text, what) => {
    const done = () => {
      setManual(null);
      setCopied(what);
      setTimeout(() => setCopied(''), 1600);
    };
    const legacy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) return done();
      } catch { /* 아래로 내려간다 */ }
      setManual({ what, text });
    };

    /**
     * ★ **매달리는 경우**가 있다 ★ (2026-07-30 · 사용자가 「아무것도 복사가 안 된다」)
     *
     * `writeText` 는 보통 성공하거나 거부하는데, 문서에 포커스가 없거나 확장 프로그램이
     * 끼면 **둘 다 안 하고 그냥 안 돌아온다.** 그러면 `then(done, legacy)` 이 영영 안
     * 불려서 **버튼도 그대로고 폴백 상자도 안 뜬다** — 화면상 아무 일도 안 일어난다.
     * 거부는 이미 `legacy` 가 받고 있었는데 **침묵은 아무도 안 받고 있었다.**
     *
     * 그래서 시간을 건다. 먼저 도착하는 쪽이 이기고, `settled` 로 두 번 실행을 막는다.
     */
    if (navigator.clipboard?.writeText) {
      let settled = false;
      const once = (fn) => () => { if (!settled) { settled = true; fn(); } };
      const timer = setTimeout(once(legacy), 1200);
      navigator.clipboard.writeText(text).then(
        once(() => { clearTimeout(timer); done(); }),
        once(() => { clearTimeout(timer); legacy(); }),
      );
      return;
    }
    legacy();
  };

  /**
   * 클립보드가 막혔을 때 **누른 버튼 바로 밑에** 펼친다. 위쪽에 한 자리만 두면
   * 아래쪽 「오류 복사」를 눌렀을 때 안 보이는 곳에서 열린다.
   */
  const manualBox = (what, head) => (manual && manual.what === what ? (
    <div style={{
      marginTop: '12px', padding: '14px',
      border: '1px solid var(--accent, #4C8DFF)', borderRadius: 'var(--r-sm, 7px)',
    }}>
      <b style={{ fontSize: '13px' }}>{head || '클립보드를 못 쓴다 — 아래를 직접 복사해라'}</b>
      <p style={{ fontSize: '12px', color: 'var(--fg-3, #8b93a1)', margin: '6px 0 10px', lineHeight: 1.6 }}>
        다운로드한 파일로 열면 브라우저가 복사를 막는다. 칸을 눌러 <b>전체 선택 → 복사</b>.
      </p>
      <textarea readOnly value={manual.text}
        onFocus={(e) => e.target.select()} onClick={(e) => e.target.select()}
        style={{
          width: '100%', height: '200px', boxSizing: 'border-box', padding: '10px',
          background: 'var(--bg-app, #0e1013)', color: 'var(--fg-2, #c8ccd4)',
          border: '1px solid var(--border, #2a2e35)', borderRadius: 'var(--r-sm, 7px)',
          fontSize: '12px', lineHeight: 1.6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }} />
    </div>
  ) : null);

  /** 고른 세계의 팔레트 원문. `custom` 은 붙여넣은 것, `default` 는 없음 */
  const worldRaw = () => {
    if (world === 'custom') return paletteText;
    return WORLDS.find((w) => w.id === world)?.raw || '';
  };

  const generate = () => {
    setErrs([]);
    let palette;
    const raw = worldRaw();
    if (raw.trim()) {
      try {
        palette = JSON.parse(raw);
      } catch (e) {
        setErrs([`팔레트가 JSON 이 아니다 — ${e.message}`,
          '챗봇이 설명을 같이 줬다면 코드블록 안의 { … } 만 붙여넣어라.']);
        return;
      }
    }
    savePalettePref({ world, text: paletteText });
    setBusy(true);
    // 오라클 탐색이 무거워 UI 를 막는다. 「생성 중」이 먼저 그려지도록 한 틱 미룬다
    setTimeout(() => {
      try {
        /**
         * **사건 하나씩 만든다** (2026-07-29 사용자 결정).
         *
         * 전에는 「한 번에 시도할 사건」 슬라이더가 1~8 이었다. 근거는 *검증에서
         * 떨어질 수 있으니 여러 개 던진다* 였는데 **통과율이 구조적으로 100%** 라
         * 그 전제가 죽었다. 남는 건 「여덟 개 만들고 하나 고르고 일곱 개 지우기」인데
         * seed 가 무작위라 버린 것은 되찾을 수 없다. 마음에 안 들면 다시 누르면 된다.
         *
         * ⚠ 라벨을 트릭 개수로 읽는 오독이 **두 번** 났다(2026-07-29). 두 번째에
         * 손잡이를 없앴다 — **설명을 두 문단 붙여야 하는 손잡이는 손잡이가 틀린 것이다.**
         */
        // seed 는 아래 저장 키(`<사건 id>-<seed>`)에도 쓰인다 — 이름을 남긴다
        const seedBase = Math.floor(Math.random() * 100000);
        const batch = run([seedBase], { palette, chapters, deathCells, want: [difficulty] });
        if (!batch.passed.length) {
          setErrs(['검증을 통과한 사건이 없다. 아래를 챗봇에 그대로 붙여 넣고 팔레트를 고쳐 달라고 해라.',
            ...[...batch.rejections].map(([why, n]) => `${n}회 — ${why}`)]);
          setBusy(false);
          return;
        }
        const store = loadStore();
        for (const p of batch.passed) {
          /**
           * `p.case.id` 가 이미 `gen-<seed>` 다. 전에는 여기에 seed 를 **또** 붙여서
           * 사건 하나만 만들면 `gen-48897-48897` 이 됐다 — 여럿 만들던 시절
           * (seed = seedBase + i)에도 두 번째 조각은 아무것도 안 갈랐다.
           */
          const key = p.case.id;
          store[key] = { ...p.case, id: key, _difficulty: p.result.difficulty, _oracle: p.result.minActions };
        }
        saveStore(store);
        setMade(Object.values(store));
        setBusy(false);
      } catch (e) {
        setErrs([`생성 중 오류 — ${e.message}`]);
        setBusy(false);
      }
    }, 30);
  };

  /**
   * 사건을 지울 때 **진행 저장도 같이 지운다.** 저장 키가 `nobody-lies:<사건 id>`
   * 라서, 안 지우면 같은 id 로 다시 만들었을 때 옛 진행이 되살아난다.
   */
  const forget = (id) => { try { localStorage.removeItem(`nobody-lies:${id}`); } catch { /* 무시 */ } };

  const removeOne = (id) => {
    const store = loadStore();
    delete store[id];
    saveStore(store);
    forget(id);
    setMade(Object.values(store));
  };

  const clearAll = () => {
    Object.keys(loadStore()).forEach(forget);
    saveStore({});
    setMade([]);
    setProseFor(null);
    setSaveMsg(null);
  };

  /**
   * 사건을 **YAML 파일로 내려받는다.** 목적지는 `engine/cases/` 이고 거기서 커밋된다.
   *
   * ⚠ **왕복이 어긋나면 안 내려받는다.** 엔진이 `--emit --yaml` 에서 `exit 1` 로
   * 막는 자리를 앱에서도 막는다 — **반쯤 맞는 사건 파일이 저장소에 커밋되는 것이
   * 아무것도 안 나가는 것보다 나쁘다.** 조용히 다른 사건이 되는 것을 이 저장소가
   * 가장 비싸게 물렸다.
   *
   * 내려받기가 막힌 origin(`file://` · 안드로이드 `content://`)이면 **화면에 펼친다** —
   * 클립보드와 같은 규약이다(§복사는 세 단계로 내려간다). 다만 이 버튼의 자리는
   * 사실상 작업 기계다: 꺼내는 이유가 커밋이라 저장소가 있는 곳에서 누른다.
   */
  const exportOne = (c) => {
    setSaveMsg(null);
    setManual(null);
    let out;
    try {
      out = caseYaml(c);
    } catch (e) {
      setSaveMsg({ id: c.id, ok: false, line: `YAML 로 옮기지 못했다 — ${e.message}` });
      return;
    }
    if (!out.same) {
      setSaveMsg({
        id: c.id,
        ok: false,
        line: '왕복 대조 실패 — 쓴 것과 다시 읽은 것이 다르다. 내려받지 않았다',
      });
      return;
    }
    const name = `${c.id}.yaml`;
    try {
      const url = URL.createObjectURL(new Blob([out.text], { type: 'text/yaml;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      /**
       * ★ 꺼냈다는 것을 기억한다 ★ (2026-07-30)
       *
       * **산문을 입힌 사건은 저작물**인데 `localStorage` 에만 살고 작업 기계가 넷이다.
       * 안 꺼내고 브라우저를 갈면 **못 되찾는다.** 그래서 「꺼냈나」를 남겨서 목록이
       * **안 꺼낸 것을 경고**할 수 있게 한다 — 강제하는 대신 **미완료를 보이게** 한다.
       */
      const store = loadStore();
      if (store[c.id]) {
        store[c.id]._exported = true;
        saveStore(store);
        setMade(Object.values(store));
      }
      setSaveMsg({ id: c.id, ok: true, line: `${name} — engine/cases/ 에 넣고 커밋한다` });
    } catch {
      setManual({ what: `yaml:${c.id}`, text: out.text });
    }
  };

  /**
   * 받은 YAML 을 사건에 넣고 **다시 검증한다.**
   *
   * 검증기가 브라우저에서 도는 것이 이 단계의 전제다 — 통과해야만 저장한다.
   * 반려되면 오류를 그대로 보여준다. **그걸 챗봇에 되붙이는 것이 고치는 방법**이라
   * 복사 가능한 자리에 둔다(팔레트 실패 때와 같은 규약).
   */
  /**
   * `rawText` 를 받는 이유: 5번(진술)과 6번(그 밖의 산문)이 각자 자기 칸을 갖는다.
   * `tag` 는 결과 문구를 **부른 단계 아래에만** 그리려고 붙인다 — 안 그러면 한쪽에
   * 붙였는데 반대쪽에 오류가 뜬다.
   *
   * 병합 자체는 한 코드다. YAML 에 있는 키만 덮으므로 진술만 와도, 프롤로그만 와도
   * 같은 길로 지나간다 — **여기를 두 벌로 만들면 반드시 갈라진다.**
   */
  const applyProse = (rawText, tag) => {
    const setProseMsg = (m) => setProseMsgRaw(m && { ...m, tag });
    setProseMsg(null);

    /**
     * ★ 붙여넣은 것이 **답이 아니라 요청**인가 ★ (2026-07-29 밤 신설)
     *
     * 5번 절은 「산문 서식 복사」 버튼과 「받은 YAML」 칸이 **나란히** 있어서,
     * 순서를 한 번 헷갈리면 서식이 그대로 답변 칸에 들어간다. 실제로 났다.
     * 전에는 파서 말만 나왔다 — *"end of the stream or a document separator is
     * expected (6:1)"*. **무엇을 잘못했는지 알 수가 없는 말이다.**
     *
     * ⚠⚠ **그리고 이건 오류로 끝나는 게 다행인 경우였다.** 서식 안에는 우리가
     * 넣은 `\`\`\`yaml` 뼈대가 들어 있고 그 안에 `people:` 과 `paragraphs: [ ... ]`
     * 가 있다. 아래 울타리 벗기기를 **먼저** 돌리면 그 뼈대가 정상 답으로 읽혀
     * **다섯 사람의 진술이 통째로 `"..."` 로 덮인다.** 그래서 이 검사가 앞이다.
     *
     * 표시는 **우리 코드가 만드는 문구**로 잡는다 — 서식 본문이 바뀌어도 안 깨진다.
     */
    const 서식표시 = ['이 사건에 대한 보충', '아래 자리만 채우세요'];
    if (서식표시.some((m) => rawText.includes(m))) {
      setProseMsg({
        ok: false,
        lines: [
          '이건 **서식**이다 — 챗봇에 보낼 요청을 그대로 되붙였다.',
          '위 「산문 서식 복사」로 복사한 것을 챗봇에 넣고, **챗봇이 준 답**을 여기 붙여넣어라.',
        ],
      });
      return;
    }

    /**
     * 챗봇은 거의 언제나 ```` ```yaml ```` 코드블록으로 준다. 서식은 *"코드블록째
     * 붙여넣었는지 본다"* 고 말해놓고 **정작 울타리를 못 벗기고 있었다.**
     * 설명 문단이 앞뒤에 붙어 와도 이걸로 지나간다.
     *
     * 블록이 여럿이면 **우리가 찾는 키가 있는 것**을 고른다 — 챗봇이 설명용
     * 조각을 곁들이는 일이 흔하다.
     */
    // 병합이 다루는 키 전부 — 위 §허용 키 목록·아래 병합부와 **같이** 늘린다
    const WANT = /^\s*(people|prologue|reveals|actions|evidence|terms)\s*:/m;
    const blocks = [...rawText.matchAll(/```(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)```/gi)].map((m) => m[1]);
    const source = blocks.length ? (blocks.find((b) => WANT.test(b)) ?? blocks[0]) : rawText;

    let frag;
    try {
      frag = load(source);
    } catch (e) {
      setProseMsg({ ok: false, lines: ['YAML 을 읽지 못했다 — ' + e.message] });
      return;
    }
    /**
     * 뼈대를 안 채우고 그대로 보낸 경우. `paragraphs: [ ... ]` 는 YAML 로는
     * **문자열 `'...'` 한 줄**이라 조용히 통과해서 진술을 덮는다.
     */
    const 자리표시 = (v) => {
      const s = typeof v === 'string' ? v : v?.ko;
      return typeof s === 'string' && /^[.·…\s]*$/.test(s);
    };
    if (Array.isArray(frag?.people)
      && frag.people.some((p) => (p?.statement?.paragraphs ?? []).some(자리표시))) {
      setProseMsg({
        ok: false,
        lines: ['뼈대의 `...` 가 그대로 남아 있다 — 챗봇이 자리를 안 채웠거나 채운 답이 아니다.'],
      });
      return;
    }
    /**
     * ⚠ **`people:` 만 보고 반려하지 않는다.** 서식이 *"필요한 것만 남기고 나머지는
     * 지우세요"* 라고 말하므로 **프롤로그만 · 장 서사만** 받아오는 것이 정상 경로인데,
     * 전에는 그 둘을 「`people:` 목록을 못 찾았다」로 되돌려보냈다 — 서식이 시킨
     * 대로 한 사람이 틀렸다는 말을 듣는다. 셋 다 없을 때만 반려한다.
     */
    /**
     * ⚠ **허용 키 목록은 병합이 실제로 다루는 것과 같아야 한다** (2026-07-30)
     *
     * 조사 층 셋(`actions`·`evidence`·`terms`)을 병합에 더하면서 **여기와 `WANT` 를
     * 안 고쳐서**, 조사 산문만 받아 오면 *"셋 중 아무것도 없다"* 로 반려됐다.
     * 실측으로 잡았다 — 붙여넣어 봤더니 아무것도 안 들어갔다.
     *
     * **한 값이 세 곳에 있다**: `WANT`(코드블록 고르기) · 이 목록(반려 판정) ·
     * 아래 병합부. 오늘 그 부류에 다섯 번째다. **여기를 늘릴 때 셋을 같이 본다.**
     */
    const incoming = Array.isArray(frag?.people) ? frag.people : [];
    const 받은것 = incoming.length
      || Array.isArray(frag?.prologue) || Array.isArray(frag?.reveals)
      || Array.isArray(frag?.actions) || Array.isArray(frag?.evidence) || Array.isArray(frag?.terms);
    if (!받은것) {
      setProseMsg({
        ok: false,
        lines: ['`people:` · `prologue:` · `reveals:` · `actions:` · `evidence:` · `terms:` 중'
          + ' 아무것도 없다. 받은 답을 코드블록째 붙여넣었는지 본다'],
      });
      return;
    }

    const store = loadStore();
    const target = store[proseFor];
    if (!target) {
      setProseMsg({ ok: false, lines: ['사건이 없다 — 지워졌을 수 있다'] });
      return;
    }

    // 통과할 때만 저장한다. 사본에 얹어서 검증하고, 원본은 그때까지 안 건드린다
    const next = JSON.parse(JSON.stringify(target));
    const byId = Object.fromEntries((next.people || []).map((p) => [p.id, p]));
    const 넣음 = [];
    const 모름 = [];
    for (const p of incoming) {
      const t = byId[p?.id];
      if (!t) { 모름.push(String(p?.id ?? '(id 없음)')); continue; }
      /**
       * 지문도 받는다 (2026-07-29). **진술과 따로 본다** — 전에는 `paragraphs`
       * 가 없으면 `continue` 라 **지문만 고쳐 온 답이 통째로 버려졌다.**
       *
       * ⚠ **빈 값으로 덮지 않는다.** 지문은 §9-1 이 전원/전무를 오류로 강제하는데,
       * 산문가가 `pre` 만 주고 `post` 를 비워 보내면 그대로 쓸 경우 한 사람만
       * 반쪽이 된다. 준 쪽만 갈아끼우고 안 준 쪽은 코드가 넣은 것을 남긴다.
       */
      const g = p?.statement?.gesture;
      if (g && typeof g === 'object') {
        const 글 = (v) => (typeof v === 'string' ? v : v?.ko);
        const cur = t.statement?.gesture || {};
        const pre = 글(g.pre), post = 글(g.post);
        if ((pre && pre.trim()) || (post && post.trim())) {
          t.statement = Object.assign({}, t.statement, {
            gesture: {
              pre: pre && pre.trim() ? { ko: pre } : cur.pre,
              post: post && post.trim() ? { ko: post } : cur.post,
            },
          });
          넣음.push(`${t.name} 지문`);
        }
      }

      const para = p?.statement?.paragraphs;
      if (!Array.isArray(para) || !para.length) continue;
      /**
       * ⚠ **문단도 `{ko}` 로 맞춘다.** 바로 위 지문과 아래 프롤로그는 정규화하는데
       * **여기만 받은 그대로** 넣고 있었다. 앱이 두 형태를 다 렌더해서 안 드러났지만
       * **엔진 정본은 `Text`** 다 — 맨 문자열로 두면 `to-yaml.ts` 의 `txt()` 가
       * `.ko` 를 찾다가 `undefined` 를 내어 **내보낸 YAML 의 문단이 통째로 빈다.**
       *
       * 2026-07-29 내보내기를 붙이며 드러났고 **왕복 대조가 잡았다** — 같은 사건이
       * 두 표현으로 사는 것을 이 저장소가 반복해서 비싸게 물린 그 형태다.
       */
      t.statement = Object.assign({}, t.statement, {
        paragraphs: para.map((x) => (typeof x === 'string' ? { ko: x } : x)),
      });
      넣음.push(`${t.name} ${para.length}문단`);
    }
    /**
     * 프롤로그도 받는다 (2026-07-29). 서식이 원래 요구하던 자리인데 병합이 없었다.
     * **안 주면 안 건드린다** — 코드가 만든 뼈대가 그대로 남는 것이 옛 것이
     * 남는 것보다 낫다. 검증기 §9-7(b)가 조사 단어 누설을 오류로 잡으므로
     * 여기서 따로 안 본다.
     */
    const inPro = frag?.prologue;
    if (Array.isArray(inPro) && inPro.length) {
      next.prologue = inPro.map((x) => (typeof x === 'string' ? { ko: x } : x));
      넣음.push(`프롤로그 ${inPro.length}줄`);
    }

    /**
     * 장 완성 서사도 받는다 (2026-07-29).
     *
     * **서식은 처음부터 `reveals[].narration` 과 `addClaims[].content` 를 요구했는데
     * 병합이 없었다** — 2026-07-29 의 프롤로그와 **똑같은 자리의 똑같은 결함**이다
     * (서식이 요구하는 것을 생성기가 잘라내고 있었다). 한 번 더 나왔으므로
     * 다음에 서식에 자리를 늘릴 때는 **여기부터 본다.**
     *
     * ⚠ **자리는 인덱스가 아니라 장 번호와 화자 id 로 맞춘다.** 순서로 맞추면
     * 산문가가 하나를 빠뜨리는 순간 전부 밀린다 — 07-29 에 인물 자리를 인덱스로
     * 맞췄다가 색과 영문이 통째로 뒤바뀐 그 부류다.
     *
     * ⚠ **문안만 덮어쓴다.** `trigger`·`speaker`·`yield`·`actions` 는 논리라
     * 받은 값을 쓰지 않는다 — 화자가 바뀌면 다른 사람의 진술이 되고, 트리거가
     * 바뀌면 영영 안 열리는 공개가 생긴다.
     */
    const inRev = frag?.reveals;
    if (Array.isArray(inRev) && inRev.length) {
      const byCh = new Map();
      for (const r of next.reveals || [])
        if (r.trigger?.on === 'chapterComplete') byCh.set(r.trigger.chapterOrder, r);
      let 서사 = 0, 주장 = 0;
      for (const r of inRev) {
        const order = r?.trigger?.chapterOrder ?? r?.chapterOrder;
        const t = byCh.get(order);
        if (!t) continue;
        if (typeof r.narration === 'string' && r.narration.trim()) { t.narration = r.narration; 서사++; }
        for (const a of r.addClaims || []) {
          const ta = (t.addClaims || []).find((x) => x.speaker === a?.speaker);
          if (ta && typeof a.content === 'string' && a.content.trim()) { ta.content = a.content; 주장++; }
        }
      }
      if (서사) 넣음.push(`장 서사 ${서사}건`);
      if (주장) 넣음.push(`장 주장 ${주장}건`);
    }

    /**
     * ★ 조사 층 — **서식이 요구하는데 병합이 없던 세 번째 자리** ★ (2026-07-30)
     *
     * `PROSE-BRIEF.md` §채워야 할 자리는 `actions[].result` · `evidence[].record` ·
     * `terms[].note` 를 처음부터 적어뒀는데 **생성기가 잘라내고 병합도 없었다.**
     * 프롤로그(07-29) · 장 서사(07-29)와 **정확히 같은 부류의 셋째**다 —
     * 위 주석이 *"다음에 서식에 자리를 늘릴 때는 여기부터 본다"* 고 적어둔 그 자리다.
     *
     * 크기로는 진술 다음이다 — 산장 실측 조사 결과문 778자 · 물증 기록 438자 ·
     * 단어 note 276자. 플레이어가 **조사할 때마다** 읽는 글이다.
     *
     * ⚠ **문안만 덮어쓴다.** `gives`·`yield`·`cost`·`target` 은 논리다. 받은 값을
     * 쓰면 조사가 주는 물증이 바뀌어 사건이 통째로 어긋난다.
     * ⚠ **id·word 로 맞춘다** — 인덱스로 맞추면 하나 빠뜨렸을 때 전부 밀린다.
     */
    const txtOf = (v) => (typeof v === 'string' ? v : (v && typeof v.ko === 'string' ? v.ko : ''));
    const inAct = frag?.actions;
    if (Array.isArray(inAct) && inAct.length) {
      const byId = new Map((next.actions || []).map((a) => [a.id, a]));
      let n = 0;
      for (const a of inAct) {
        const t = byId.get(a?.id);
        // 결과문이 **원래 있던 조사**에만 붙인다 — 빈손 조사에 결과를 만들면 난이도가 바뀐다
        if (!t || !t.result || !a.result) continue;
        const ti = txtOf(a.result.title), bo = txtOf(a.result.body);
        if (ti.trim()) { t.result.title = { ko: ti }; }
        if (bo.trim()) { t.result.body = { ko: bo }; }
        if (ti.trim() || bo.trim()) n++;
      }
      if (n) 넣음.push(`조사 결과문 ${n}건`);
    }

    const inEv = frag?.evidence;
    if (Array.isArray(inEv) && inEv.length) {
      const byId = new Map((next.evidence || []).map((e) => [e.id, e]));
      let n = 0;
      for (const e of inEv) {
        const t = byId.get(e?.id);
        const rec = txtOf(e?.record);
        if (t && rec.trim()) { t.record = rec; n++; }
      }
      if (n) 넣음.push(`물증 기록 ${n}건`);
    }

    const inTerm = frag?.terms;
    if (Array.isArray(inTerm) && inTerm.length) {
      const byWord = new Map((next.terms || []).map((t) => [t.word, t]));
      let n = 0;
      for (const t of inTerm) {
        const tt = byWord.get(t?.word);
        const note = txtOf(t?.note);
        if (tt && note.trim()) { tt.note = { ko: note }; n++; }
      }
      if (n) 넣음.push(`단어 기록 ${n}건`);
    }

    if (!넣음.length) {
      setProseMsg({
        ok: false,
        lines: ['넣을 진술이 없었다' + (모름.length ? ` · 모르는 id: ${모름.join(', ')}` : '')],
      });
      return;
    }

    const r = verify(next);
    if (!r.ok) {
      setProseMsg({
        ok: false,
        lines: ['검증기가 반려했다 — 아래를 그대로 챗봇에 되붙이고 그 부분만 고쳐 달라고 해라',
          ...r.errors.map((e) => `오류: ${e}`)],
      });
      return;
    }

    next._prose = true;
    /**
     * ★ 내보낸 파일이 **거짓말을 하고 있었다** ★ (2026-07-30 · 첫 완성본에서 발견)
     *
     * 앱이 `_prose`(목록 표시용 메타)만 세우고 **엔진 필드 `prose.source` 는 안
     * 고쳤다.** 그래서 산문을 다 입힌 사건을 「YAML」로 꺼내도 파일에는 여전히
     * `source: template` 이 찍혀 나온다 — `engine/cases/` 에 커밋되면 나중에
     * **「이건 조립본이네」로 오독된다.** 산장은 `authored` 다.
     *
     * `_prose` 와 `prose.source` 가 **같은 사실의 두 표현**이었고 한쪽만 고쳤다 —
     * 오늘 그 부류의 여섯째다.
     */
    next.prose = { ...(next.prose || {}), source: 'authored' };
    // 산문이 바뀌었으니 **다시 꺼내야 한다** — 전에 꺼낸 파일은 이제 낡았다
    next._exported = false;
    store[proseFor] = next;
    saveStore(store);
    setMade(Object.values(store));
    // 성공한 칸만 비운다 — `tag` 없이 지우면 5번에 넣었는데 6번 칸이 비워진다
    if (tag === 'stmt') setStmtText(''); else setProseText('');
    setProseMsg({
      ok: true,
      lines: [`넣었다 — ${넣음.join(' · ')}`,
        ...(r.warnings || []).map((w) => `경고: ${w}`),
        ...(모름.length ? [`모르는 id 는 건너뛰었다: ${모름.join(', ')}`] : [])],
    });
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 80px', color: 'var(--fg, #e6e9ef)' }}>
      {/* 경로를 새로 만들지 않는다 — 해시만 비운다. `App.jsx` 의 `goRoute` 와 같은 이유:
          `content://` (안드로이드 다운로드)에서는 경로를 만드는 순간 파일을 못 찾는다 */}
      <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
        style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', textDecoration: 'none' }}>← 홈</a>

      <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '14px 0 6px' }}>캠페인 생성기</h1>
      <p style={{ fontSize: '14px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 24px', lineHeight: 1.7 }}>
        사건의 <b>논리·트릭·평면도는 이 앱이</b> 만든다. 당신이 가져올 것은 <b>세계의 어휘</b>뿐이다 —
        무대·이름·직업·물건·동기. 그건 챗봇이 잘한다.
      </p>

      {/* 1 — 설정 */}
      <section style={{ ...box, marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>1</span>사건의 크기를 고른다
        </h2>

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--fg-3, #8b93a1)', marginBottom: '7px' }}>난이도</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {DIFFS.map((d) => (
              <button key={d.id} onClick={() => setDifficulty(d.id)}
                style={{ ...btn(difficulty === d.id), textAlign: 'left', flex: '1 1 180px' }}>
                <div>{d.ko}</div>
                <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.75, marginTop: '3px' }}>{d.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <label style={{ fontSize: '13px', display: 'block' }}>
          <span style={{ color: 'var(--fg-3, #8b93a1)' }}>보고서 장 수 </span>
          <b>{chapters}</b>
          <input type="range" min="3" max="8" value={chapters} style={{ display: 'block', width: '190px', marginTop: '5px' }}
            onChange={(e) => setChapters(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: '13px', display: 'block', marginTop: '12px' }}>
          <span style={{ color: 'var(--fg-3, #8b93a1)' }}>사망 구간 칸 수 </span>
          <b>{deathCells}</b>
          <input type="range" min="1" max="3" value={deathCells} style={{ display: 'block', width: '190px', marginTop: '5px' }}
            onChange={(e) => setDeathCells(Number(e.target.value))} />
        </label>
        <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '12px 0 0', lineHeight: 1.6 }}>
          용의자는 언제나 5명이고, <b>사건은 한 번에 하나</b>씩 만들어진다. 장이 많을수록
          조사할 것이 늘고 오래 걸린다 — 3장이면 최소 4회, 8장이면 최소 9회 조사해야 풀린다.
          마음에 안 들면 다시 누르면 된다.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '8px 0 0', lineHeight: 1.6 }}>
          <b>사망 구간 칸 수</b>는 사망 추정 시간을 몇 토막으로 나눌지다. 1이면 「그 구간에
          어디 있었나」 하나만 묻고, 2 이상이면 <b>각자 구간 안에서 여러 번 움직인다</b> —
          「앞쪽엔 주방, 뒤쪽엔 세탁실」이 되어 알리바이 대조가 실제로 맞춰볼 것이 생긴다.
          진술도 그만큼 길어진다. 시간대 이름을 직접 쓰고 싶으면 세계 어휘의{' '}
          <code>times.window</code> 에 칸마다 하나씩 적는다 — 안 적으면 「(전반)·(후반)」이
          기계가 붙인 이름으로 들어간다.
        </p>
      </section>

      {/* 2 — 세계 고르기 */}
      <section style={{ ...box, marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>2</span>세계를 고른다
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 14px', lineHeight: 1.7 }}>
          <b>세계는 어휘다</b> — 장소·직업·물건·시간대 이름. 논리는 앱이 만든다.
          아래 넷은 <b>이미 들어 있어서 바로 만들 수 있다.</b> 새 세계를 원할 때만
          챗봇에게 받아온다.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {WORLDS.map((w) => (
            <button key={w.id} onClick={() => setWorld(w.id)}
              style={{ ...btn(world === w.id), textAlign: 'left', flex: '1 1 150px' }}>
              <div>{w.ko}</div>
              <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.75, marginTop: '3px' }}>{w.hint}</div>
            </button>
          ))}
        </div>
        {world !== 'custom' ? null : (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border, #2a2e35)' }}>
        <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 14px', lineHeight: 1.7 }}>
          ChatGPT · Claude · Gemini · Grok — <b>아무 데나</b> 붙여 넣으면 된다.
          이 앱은 챗봇을 부르지 않는다. 받은 답을 아래 3번에 붙여 넣어라.
          <b> 한 번 붙여 넣으면 남는다</b> — 다음에 또 안 해도 된다.
        </p>
        <button onClick={() => copy(briefBody(), 'brief')} style={btn(true)}>
          {copied === 'brief' ? '복사됐다 ✓' : '서식 복사'}
        </button>
        {manualBox('brief')}
        <textarea
          value={paletteText}
          onChange={(e) => setPaletteText(e.target.value)}
          placeholder={'챗봇이 준 JSON 을 그대로 붙여넣어라.\n비워두면 기본 어휘(산장풍)로 만든다.'}
          spellCheck={false}
          style={{
            width: '100%', minHeight: '150px', boxSizing: 'border-box', marginTop: '14px',
            background: 'var(--bg-app, #0e1013)', color: 'var(--fg-2, #c8ccd4)',
            border: '1px solid var(--border, #2a2e35)', borderRadius: 'var(--r-sm, 7px)',
            padding: '11px 13px', fontSize: '12px', lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
          }}
        />
        </div>
        )}
      </section>

      {/* 3 — 만든다 */}
      <section style={{ ...box, marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>3</span>사건을 만든다
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 14px', lineHeight: 1.7 }}>
          <b>{WORLDS.find((w) => w.id === world)?.ko}</b> ·{' '}
          {chapters}장 · {DIFFS.find((d) => d.id === difficulty)?.ko}
          {deathCells > 1 ? ` · 사망 구간 ${deathCells}칸` : ''}
          {world === 'custom' && !paletteText.trim()
            ? ' — 붙여넣은 것이 없어 기본 어휘로 만든다' : ''}
        </p>
        <button onClick={generate} disabled={busy} style={{ ...btn(true), opacity: busy ? 0.5 : 1 }}>
          {busy ? '만드는 중…' : '사건 만들기'}
        </button>
      </section>

      {/* 오류 — 그대로 챗봇에 되붙일 수 있게 */}
      {errs.length > 0 && (
        <section style={{ ...box, marginBottom: '14px', borderColor: 'var(--g-contradict, #EB5757)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: 'var(--g-contradict, #EB5757)' }}>
            만들지 못했다
          </h2>
          <pre style={{
            margin: '0 0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: '12px', lineHeight: 1.7, color: 'var(--fg-2, #c8ccd4)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>{errs.join('\n')}</pre>
          <button onClick={() => copy(errs.join('\n'), 'err')} style={btn(false)}>
            {copied === 'err' ? '복사됐다 ✓' : '오류 복사 — 챗봇에 그대로 붙여넣기'}
          </button>
          {manualBox('err')}
        </section>
      )}

      {/* 4 — 만들어진 사건 */}
      <section style={box}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>4</span>만들어진 사건
        </h2>
        {made.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--fg-4, #6b7280)', margin: 0 }}>아직 없다.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {made.map((c) => (
                <div key={c.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 10px 10px 14px',
                    background: 'var(--bg-app, #0e1013)', borderRadius: 'var(--r-sm, 7px)',
                    border: '1px solid var(--border, #2a2e35)',
                  }}>
                    {/* 경로를 새로 만들지 않는다 — `content://`(안드로이드 다운로드)에서 죽는다 */}
                    <a href={`#case=local:${encodeURIComponent(c.id)}`}
                      style={{
                        flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: '12px', textDecoration: 'none',
                        color: 'var(--fg, #e6e9ef)',
                      }}>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{c.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--fg-3, #8b93a1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>
                          {c.chapters?.length}장 · 예산 {c.budget} · 최소 {c._oracle}회 · {c._difficulty}
                          {hasProse(c) ? ' · 산문 입힘' : ' · 조립 진술'}
                        </span>
                        {/**
                          * ★ 행이 **다음에 뭘 해야 하는지**를 직접 말한다 ★ (2026-07-30 · 사용자 지적)
                          *
                          * 전에는 절 밑에 *"…더 좋게 쓰고 싶으면 …"* 이라는 **설명**만 있었다.
                          * 무엇을 했고 무엇이 남았는지는 어디에도 없었다.
                          *
                          * ⚠ **「안 꺼냈다」만 경고색이다.** 그것만 **잃을 수 있는 상태**이기
                          * 때문이다 — 조립 진술은 언제든 다시 뽑지만 **산문은 저작물**이고
                          * `localStorage` 에만 산다. 나머지를 같이 붉게 칠하면 경고가 소음이 된다.
                          */}
                        {(() => {
                          const st = !hasProse(c)
                            ? { t: '다음 · 진술 입히기', c: 'var(--accent, #4C8DFF)', b: 'transparent' }
                            : !c._exported
                              ? { t: '⚠ 아직 안 꺼냈다', c: 'var(--g-contradict, #EB5757)', b: 'rgba(235,87,87,.10)' }
                              : { t: '꺼냈다 ✓', c: 'var(--fg-4, #6b7280)', b: 'transparent' };
                          return (
                            <span style={{
                              flex: 'none', fontSize: '11px', fontWeight: 600, color: st.c,
                              background: st.b, border: '1px solid ' + (st.b === 'transparent' ? 'var(--border, #2a2e35)' : st.c),
                              borderRadius: 'var(--r-pill, 999px)', padding: '2px 8px', whiteSpace: 'nowrap',
                            }}>{st.t}</span>
                          );
                        })()}
                      </span>
                    </a>
                    <button
                      // 사건을 바꾸면 **두 칸 다** 비운다 — 한쪽만 비우면 옛 사건에 쓴 답이 남는다
                      onClick={() => { setProseFor(proseFor === c.id ? null : c.id); setProseMsgRaw(null); setProseText(''); setStmtText(''); }}
                      title="이 사건에 진술을 입힌다"
                      style={{ ...btn(false), flex: 'none', padding: '7px 11px', fontSize: '12px' }}>
                      {proseFor === c.id ? '닫기' : '산문'}
                    </button>
                    {/* 이 사건을 기계 밖으로 꺼내는 유일한 길 — `localStorage` 는 이 브라우저에만 산다 */}
                    <button onClick={() => exportOne(c)}
                      title="YAML 로 내려받는다 — engine/cases/ 에 넣고 커밋한다"
                      style={{ ...btn(false), flex: 'none', padding: '7px 11px', fontSize: '12px' }}>
                      YAML
                    </button>
                    {/* 사건 하나만 지운다. 진행 저장도 같이 지운다 — 안 지우면
                        같은 이름으로 다시 만들었을 때 옛 진행이 되살아난다 */}
                    <button onClick={() => removeOne(c.id)} title="이 사건 지우기"
                      style={{
                        flex: 'none', width: '30px', height: '30px', lineHeight: 1,
                        borderRadius: 'var(--r-sm, 7px)', cursor: 'pointer',
                        border: '1px solid var(--border-strong, #3a4049)',
                        background: 'transparent', color: 'var(--fg-3, #8b93a1)', fontSize: '15px',
                      }}>×</button>
                  </div>
                  {saveMsg && saveMsg.id === c.id && (
                    <p style={{
                      margin: '7px 0 0', fontSize: '12px', lineHeight: 1.6,
                      color: saveMsg.ok ? 'var(--fg-3, #8b93a1)' : 'var(--danger, #ef4444)',
                    }}>{saveMsg.line}</p>
                  )}
                  {manualBox(`yaml:${c.id}`, '내려받기가 막혔다 — 아래를 복사해 저장해라')}
                </div>
              ))}
            </div>
            <button onClick={clearAll} style={{ ...btn(false), marginTop: '14px' }}>전부 지우기</button>
          </>
        )}
        {/**
          * ★ 설명만 있고 **다음에 뭘 하라는 말이 없었다** ★ (2026-07-30 · 사용자 지적)
          *
          * 여기 있던 두 문단은 *"…더 좋게 쓰고 싶으면"* · *"…산문을 입혔으면"* 처럼
          * **조건문**이었다. 읽고 나면 무엇이 남았는지를 여전히 모른다.
          * 명령형 세 줄로 바꾸고, **어디까지 왔는지는 행의 칩**이 말한다.
          *
          * ⚠ **강제하지 않는 이유.** 산문은 **외부 챗봇**이 있어야 하고, 조립 진술로도
          * 사건은 끝까지 플레이된다(검증기가 유일 해를 보증). 막으면 챗봇이 없는
          * 사람은 아예 못 논다. 대신 **미완료를 보이게** 한다 —
          * 조용한 탈락을 없앨 때와 같은 방법이다.
          */}
        {made.length > 0 && (
          <div style={{
            marginTop: '16px', padding: '13px 15px', borderRadius: 'var(--r-sm, 7px)',
            background: 'var(--bg-app, #0e1013)', border: '1px solid var(--border, #2a2e35)',
          }}>
            <b style={{ fontSize: '13px' }}>여기서부터 할 일</b>
            <ol style={{ margin: '9px 0 0', paddingLeft: '18px', fontSize: '12px', lineHeight: 1.85, color: 'var(--fg-3, #8b93a1)' }}>
              <li><b>지금 바로 놀아도 된다</b> — 제목을 누르면 열린다. 조립 진술로도 끝까지 플레이된다.</li>
              <li><b>행의 「산문」 → 5번에서 진술을 두껍게 쓴다.</b> 읽는 맛의 격차가 여기서 가장 크다
                (조립은 문단당 27자, 손으로 쓴 레퍼런스는 100~170자). <b>챗봇이 필요하다.</b></li>
              <li><b>산문을 입혔으면 행의 「YAML」로 꺼낸다.</b> 그때부터 저작물이라
                <b style={{ color: 'var(--g-contradict, #EB5757)' }}> 안 꺼내면 못 되찾는다</b> —
                만든 사건은 <b>이 브라우저에만</b> 남고 작업 기계는 넷이다.
                꺼낸 파일은 <code>engine/cases/</code> 에 넣고 커밋한다.</li>
            </ol>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--fg-4, #6b7280)', lineHeight: 1.6 }}>
              어디까지 왔는지는 <b>행 오른쪽 칩</b>이 말한다 — 「다음 · 진술 입히기」 →
              「⚠ 아직 안 꺼냈다」 → 「꺼냈다 ✓」.
            </p>
          </div>
        )}
      </section>

      {/* 5 — 산문 입히기. 4에서 사건을 고르면 열린다 */}
      {proseFor && (() => {
        const c = made.find((x) => x.id === proseFor);
        if (!c) return null;
        const req = proseRequest(c);
        const stmtReq = statementRequest(c);
        /**
         * ★ 5·6으로 갈랐다 ★ (2026-07-30 · 사용자 지적)
         *
         * 전에는 한 절 안에 버튼 둘이 나란히 있었다. 그러면 **동급 선택지**로 읽히는데
         * 실제로는 성격도 빈도도 다르다 — 진술은 **본선**(사건마다 · 읽는 맛의 격차가
         * 여기서 가장 크다)이고 그 밖의 산문은 **선택**이다. 「(그 밖의 산문)」이라는
         * 꼬리표로 때우고 있었다.
         *
         * 칸을 하나로 묶었던 이유(「어디에 붙이지」가 헷갈린다)는 **단계를 가르면
         * 오히려 사라진다** — 각 칸이 자기 단계 안에 있기 때문이다.
         */
        /**
         * ⚠ **`what` 이 있는 이유** (2026-07-30 · 사용자가 헷갈렸다)
         *
         * 5·6을 한 함수로 묶으면서 버튼 이름을 둘 다 **그냥 「서식 복사」**로 뭉갰다.
         * 화면에 같은 이름의 버튼이 둘이고, 받는 칸 설명은 「받은 YAML 을 그대로
         * 붙여넣어라」뿐이라 **누구한테 받은 것인지**를 안 말한다. 게다가 4번에도
         * 「YAML」 버튼이 있는데 **그건 반대 방향**(꺼내기)이다. 셋이 섞였다.
         *
         * 이름을 되돌리고 **①②로 순서를 박는다.**
         */
        const briefStep = (n, title, lead, brief, tag, text, setText, note, what) => (
          <section style={{ ...box, marginTop: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center' }}>
              <span style={stepNo}>{n}</span>{title}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 16px', lineHeight: 1.7 }}>
              {lead}
            </p>

            {brief.text === null ? (
              <p style={{ fontSize: '13px', color: 'var(--g-contradict, #EB5757)', margin: 0, lineHeight: 1.7 }}>
                <b>서식을 채울 수 없다.</b> <code>{'{{ }}'}</code> 자리 수가 안 맞는다
                ({brief.holes}개). 서식이 바뀌었다 — 고치기 전에는 브리프가 반쯤 빈 채로 나간다.
              </p>
            ) : (
              <>
                <button onClick={() => copy(brief.text, tag)} style={btn(true)}>
                  {copied === tag ? '복사됐다 ✓ — 챗봇에 붙여넣어라' : `① ${what} 서식 복사`}
                </button>
                {manualBox(tag)}
                {note && (
                  <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '9px 0 0', lineHeight: 1.7 }}>
                    {note}
                  </p>
                )}

                <div style={{ fontSize: '12px', color: 'var(--fg-3, #8b93a1)', margin: '18px 0 7px' }}>
                  ② <b>챗봇이 준 답</b>을 여기 붙여넣어라
                  <span style={{ color: 'var(--fg-4, #6b7280)' }}>
                    {' '}— 4번의 「YAML」은 <b>반대 방향</b>이다(완성된 사건을 파일로 꺼내는 버튼).
                    여기 붙일 것이 아니다.
                  </span>
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={'people:\n  - id: p1\n    statement:\n      paragraphs:\n        - …'}
                  style={{
                    width: '100%', height: '150px', boxSizing: 'border-box',
                    background: 'var(--bg-app, #0e1013)', color: 'var(--fg, #e6e9ef)',
                    border: '1px solid var(--border, #2a2e35)', borderRadius: 'var(--r-sm, 7px)',
                    padding: '11px 13px', fontSize: '12px', lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
                  }} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => applyProse(text, tag)} disabled={!text.trim()}
                    style={{ ...btn(true), opacity: text.trim() ? 1 : 0.5 }}>사건에 넣기</button>
                  <span style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)' }}>
                    검증기를 통과해야만 저장된다
                  </span>
                </div>
              </>
            )}

            {proseMsg && proseMsg.tag === tag && (
              <div style={{
                marginTop: '14px', padding: '12px 14px', borderRadius: 'var(--r-sm, 7px)',
                border: '1px solid ' + (proseMsg.ok ? 'var(--accent, #4C8DFF)' : 'var(--g-contradict, #EB5757)'),
              }}>
                <pre style={{
                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontSize: '12px', lineHeight: 1.7, color: 'var(--fg-2, #c8ccd4)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>{proseMsg.lines.join('\n')}</pre>
                {proseMsg.ok ? null : (
                  <>
                    <button onClick={() => copy(proseMsg.lines.join('\n'), tag + 'Err')}
                      style={{ ...btn(false), marginTop: '11px' }}>
                      {copied === tag + 'Err' ? '복사됐다 ✓' : '오류 복사 — 챗봇에 그대로 붙여넣기'}
                    </button>
                    {manualBox(tag + 'Err')}
                  </>
                )}
              </div>
            )}
          </section>
        );

        return (
          <>
            {briefStep(5, '진술을 두껍게 쓴다', (
              <><b>{c.title}</b> — 지금 진술을 <b>초안으로 주고 살만 붙이게</b> 한다.
                레퍼런스(산장 살인사건)의 실제 진술이 두께 기준으로 함께 들어간다.
                <b> 이 앱은 챗봇을 부르지 않는다.</b></>
            ), stmtReq, 'stmt', stmtText, setStmtText,
              <>사실은 초안에 박혀 있어서 <b>바뀔 자리가 좁다</b> — 누가·언제·어디는 그대로 두고 결만 입힌다.</>,
              '진술')}

            {briefStep(6, '그 밖의 산문 (선택)', (
              <>프롤로그 · 장 완성 서사 · 조사 결과문 · 확보 단어 기록.
                <b> 진술이 아니다</b> — 진술은 5번에서 한다. 안 해도 사건은 끝까지 플레이된다.</>
            ), req, 'prose', proseText, setProseText, null, '산문')}
          </>
        );
      })()}
    </div>
  );
}
