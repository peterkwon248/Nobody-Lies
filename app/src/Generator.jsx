import React from 'react';
import { dump, load } from 'js-yaml';
import { run } from '@engine/orchestrate.ts';
import { verify } from '@engine/verifier.ts';
import briefRaw from '../../engine/templates/PALETTE-BRIEF.md?raw';
import proseRaw from '../../engine/templates/PROSE-BRIEF.md?raw';
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
  const fill = ['prologue:', '  - "..."   # 4줄 안팎', '', 'people:']
    .concat((c.people || []).map((p) => `  - id: ${p.id}          # ${p.name}\n    statement:\n      paragraphs: [ ... ]`))
    .join('\n');

  const slots = c.slots || [];
  const 보충 = [
    '## 이 사건에 대한 보충',
    '',
    `- **문단 수는 인물당 ${Math.max(3, slots.length)}~${slots.length + 3}문단.** 시간대가 ${slots.length}개이고,`,
    '  각 시간대에 어디 있었는지가 드러나기만 하면 문단을 묶어도 됩니다.',
    '  **다섯 사람의 길이가 서로 비슷해야 합니다** — 한쪽이 길면 그게 유용도 표시입니다.',
    '- **지문(`gesture`)은 넣지 마세요.** 이번엔 진술 원문만 받습니다.',
    '- **`claim` 이 `presence` 와 다른 사람이 범인**입니다. 거짓말은 `claim` 이 말하는',
    '  그대로만 하세요 — 더 꾸미면 새 사실이 됩니다.',
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
  const [proseMsg, setProseMsg] = React.useState(null);

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

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
      return;
    }
    legacy();
  };

  /**
   * 클립보드가 막혔을 때 **누른 버튼 바로 밑에** 펼친다. 위쪽에 한 자리만 두면
   * 아래쪽 「오류 복사」를 눌렀을 때 안 보이는 곳에서 열린다.
   */
  const manualBox = (what) => (manual && manual.what === what ? (
    <div style={{
      marginTop: '12px', padding: '14px',
      border: '1px solid var(--accent, #4C8DFF)', borderRadius: 'var(--r-sm, 7px)',
    }}>
      <b style={{ fontSize: '13px' }}>클립보드를 못 쓴다 — 아래를 직접 복사해라</b>
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
        const batch = run([seedBase], { palette, chapters, want: [difficulty] });
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
  };

  /**
   * 받은 YAML 을 사건에 넣고 **다시 검증한다.**
   *
   * 검증기가 브라우저에서 도는 것이 이 단계의 전제다 — 통과해야만 저장한다.
   * 반려되면 오류를 그대로 보여준다. **그걸 챗봇에 되붙이는 것이 고치는 방법**이라
   * 복사 가능한 자리에 둔다(팔레트 실패 때와 같은 규약).
   */
  const applyProse = () => {
    setProseMsg(null);
    let frag;
    try {
      frag = load(proseText);
    } catch (e) {
      setProseMsg({ ok: false, lines: ['YAML 을 읽지 못했다 — ' + e.message] });
      return;
    }
    const incoming = frag?.people;
    if (!Array.isArray(incoming) || !incoming.length) {
      setProseMsg({ ok: false, lines: ['`people:` 목록을 못 찾았다. 받은 답을 코드블록째 붙여넣었는지 본다'] });
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
      const para = p?.statement?.paragraphs;
      if (!Array.isArray(para) || !para.length) continue;
      t.statement = Object.assign({}, t.statement, { paragraphs: para });
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
    store[proseFor] = next;
    saveStore(store);
    setMade(Object.values(store));
    setProseText('');
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
        <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '12px 0 0', lineHeight: 1.6 }}>
          용의자는 언제나 5명이고, <b>사건은 한 번에 하나</b>씩 만들어진다. 장이 많을수록
          조사할 것이 늘고 오래 걸린다 — 3장이면 최소 4회, 8장이면 최소 9회 조사해야 풀린다.
          마음에 안 들면 다시 누르면 된다.
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
                <div key={c.id} style={{
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
                    <span style={{ fontSize: '11px', color: 'var(--fg-3, #8b93a1)' }}>
                      {c.chapters?.length}장 · 예산 {c.budget} · 최소 {c._oracle}회 · {c._difficulty}
                      {hasProse(c) ? ' · 산문 입힘' : ' · 조립 진술'}
                    </span>
                  </a>
                  <button
                    onClick={() => { setProseFor(proseFor === c.id ? null : c.id); setProseMsg(null); setProseText(''); }}
                    title="이 사건에 진술을 입힌다"
                    style={{ ...btn(false), flex: 'none', padding: '7px 11px', fontSize: '12px' }}>
                    {proseFor === c.id ? '닫기' : '산문'}
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
              ))}
            </div>
            <button onClick={clearAll} style={{ ...btn(false), marginTop: '14px' }}>전부 지우기</button>
          </>
        )}
        <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '14px 0 0', lineHeight: 1.6 }}>
          갓 만든 사건도 <b>진술이 읽힌다</b> — 사람마다 말버릇이 다르고, 각자
          <b> 사건과 무관한 비밀 하나</b>를 감춘다(제목이 곧 그 규칙이다). 세계의
          어휘로 조립한 것이라 <b>말맛은 챗봇 산문만 못하다</b> — 더 좋게 쓰고 싶으면
          행의 <b>「산문」</b>을 눌러 5번에서 덮어쓴다.
        </p>
      </section>

      {/* 5 — 산문 입히기. 4에서 사건을 고르면 열린다 */}
      {proseFor && (() => {
        const c = made.find((x) => x.id === proseFor);
        if (!c) return null;
        const req = proseRequest(c);
        return (
          <section style={{ ...box, marginTop: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', display: 'flex', alignItems: 'center' }}>
              <span style={stepNo}>5</span>진술을 입힌다
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 16px', lineHeight: 1.7 }}>
              <b>{c.title}</b> — 2번과 같은 방식이다. 서식을 복사해 챗봇에게 주고, 받은 답을
              아래에 붙여 넣는다. <b>이 앱은 챗봇을 부르지 않는다.</b>
            </p>

            {req.text === null ? (
              <p style={{ fontSize: '13px', color: 'var(--g-contradict, #EB5757)', margin: 0, lineHeight: 1.7 }}>
                <b>서식을 채울 수 없다.</b> <code>PROSE-BRIEF.md</code> 의 <code>{'{{ }}'}</code> 자리가
                둘이어야 하는데 {req.holes}개다. 서식이 바뀌었다 — 고치기 전에는 브리프가
                반쯤 빈 채로 나간다.
              </p>
            ) : (
              <>
                <button onClick={() => copy(req.text, 'prose')} style={btn(true)}>
                  {copied === 'prose' ? '복사됐다 ✓' : '산문 서식 복사'}
                </button>
                {manualBox('prose')}

                <div style={{ fontSize: '12px', color: 'var(--fg-3, #8b93a1)', margin: '18px 0 7px' }}>
                  받은 YAML 을 그대로 붙여넣어라
                </div>
                <textarea value={proseText} onChange={(e) => setProseText(e.target.value)}
                  placeholder={'people:\n  - id: p1\n    statement:\n      paragraphs:\n        - …'}
                  style={{
                    width: '100%', height: '150px', boxSizing: 'border-box',
                    background: 'var(--bg-app, #0e1013)', color: 'var(--fg, #e6e9ef)',
                    border: '1px solid var(--border, #2a2e35)', borderRadius: 'var(--r-sm, 7px)',
                    padding: '11px 13px', fontSize: '12px', lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
                  }} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={applyProse} disabled={!proseText.trim()}
                    style={{ ...btn(true), opacity: proseText.trim() ? 1 : 0.5 }}>사건에 넣기</button>
                  <span style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)' }}>
                    검증기를 통과해야만 저장된다
                  </span>
                </div>
              </>
            )}

            {proseMsg && (
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
                    <button onClick={() => copy(proseMsg.lines.join('\n'), 'proseErr')}
                      style={{ ...btn(false), marginTop: '11px' }}>
                      {copied === 'proseErr' ? '복사됐다 ✓' : '오류 복사 — 챗봇에 그대로 붙여넣기'}
                    </button>
                    {manualBox('proseErr')}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}
