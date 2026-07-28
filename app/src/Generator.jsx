import React from 'react';
import { run } from '@engine/orchestrate.ts';
import briefRaw from '../../engine/templates/PALETTE-BRIEF.md?raw';

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

/** 서식에서 「복사할 부분」만 잘라낸다. 파일이 바뀌면 화면도 따라 바뀐다 */
function briefBody() {
  const a = briefRaw.indexOf('⬇ 여기서부터 복사');
  const b = briefRaw.indexOf('⬆ 여기까지 복사');
  if (a < 0 || b < 0) return briefRaw;
  return briefRaw.slice(a + '⬇ 여기서부터 복사'.length, b).trim();
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
  const [count, setCount] = React.useState(3);
  const [paletteText, setPaletteText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [errs, setErrs] = React.useState([]);
  const [made, setMade] = React.useState(() => Object.values(loadStore()));
  const [copied, setCopied] = React.useState('');

  const copy = (text, what) => {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(what); setTimeout(() => setCopied(''), 1600); },
      () => setErrs(['클립보드를 쓸 수 없다 — 직접 선택해 복사해라']),
    );
  };

  const generate = () => {
    setErrs([]);
    let palette;
    if (paletteText.trim()) {
      try {
        palette = JSON.parse(paletteText);
      } catch (e) {
        setErrs([`팔레트가 JSON 이 아니다 — ${e.message}`,
          '챗봇이 설명을 같이 줬다면 코드블록 안의 { … } 만 붙여넣어라.']);
        return;
      }
    }
    setBusy(true);
    // 오라클 탐색이 무거워 UI 를 막는다. 「생성 중」이 먼저 그려지도록 한 틱 미룬다
    setTimeout(() => {
      try {
        const seedBase = Math.floor(Math.random() * 100000);
        const seeds = Array.from({ length: count }, (_, i) => seedBase + i);
        const batch = run(seeds, { palette, chapters, want: [difficulty] });
        if (!batch.passed.length) {
          setErrs(['검증을 통과한 사건이 없다. 아래를 챗봇에 그대로 붙여 넣고 팔레트를 고쳐 달라고 해라.',
            ...[...batch.rejections].map(([why, n]) => `${n}회 — ${why}`)]);
          setBusy(false);
          return;
        }
        const store = loadStore();
        for (const p of batch.passed) {
          const key = `${p.case.id}-${seedBase}`;
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
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 80px', color: 'var(--fg, #e6e9ef)' }}>
      <a href="/" style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', textDecoration: 'none' }}>← 홈</a>

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

        <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px' }}>
            <span style={{ color: 'var(--fg-3, #8b93a1)' }}>보고서 장 수 </span>
            <b>{chapters}</b>
            <input type="range" min="3" max="8" value={chapters} style={{ display: 'block', width: '190px', marginTop: '5px' }}
              onChange={(e) => setChapters(Number(e.target.value))} />
          </label>
          <label style={{ fontSize: '13px' }}>
            <span style={{ color: 'var(--fg-3, #8b93a1)' }}>한 번에 만들 사건 </span>
            <b>{count}</b>
            <input type="range" min="1" max="8" value={count} style={{ display: 'block', width: '190px', marginTop: '5px' }}
              onChange={(e) => setCount(Number(e.target.value))} />
          </label>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)', margin: '12px 0 0', lineHeight: 1.6 }}>
          용의자는 언제나 5명이다. 장이 많을수록 조사할 것이 늘고 오래 걸린다 —
          3장이면 최소 4회, 8장이면 최소 9회 조사해야 풀린다.
        </p>
      </section>

      {/* 2 — 서식 복사 */}
      <section style={{ ...box, marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>2</span>서식을 복사해 챗봇에게 준다
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--fg-3, #8b93a1)', margin: '0 0 14px', lineHeight: 1.7 }}>
          ChatGPT · Claude · Gemini · Grok — <b>아무 데나</b> 붙여 넣으면 된다.
          이 앱은 챗봇을 부르지 않는다. 받은 답을 아래 3번에 붙여 넣어라.
        </p>
        <button onClick={() => copy(briefBody(), 'brief')} style={btn(true)}>
          {copied === 'brief' ? '복사됐다 ✓' : '서식 복사'}
        </button>
      </section>

      {/* 3 — 붙여넣기 */}
      <section style={{ ...box, marginBottom: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center' }}>
          <span style={stepNo}>3</span>받은 답을 붙여 넣는다
        </h2>
        <textarea
          value={paletteText}
          onChange={(e) => setPaletteText(e.target.value)}
          placeholder={'챗봇이 준 JSON 을 그대로 붙여넣어라.\n비워두면 기본 어휘(산장풍)로 만든다 — 어떤 화면인지 먼저 보고 싶을 때 쓴다.'}
          spellCheck={false}
          style={{
            width: '100%', minHeight: '150px', boxSizing: 'border-box',
            background: 'var(--bg-app, #0e1013)', color: 'var(--fg-2, #c8ccd4)',
            border: '1px solid var(--border, #2a2e35)', borderRadius: 'var(--r-sm, 7px)',
            padding: '11px 13px', fontSize: '12px', lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical',
          }}
        />
        <div style={{ marginTop: '12px', display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={generate} disabled={busy} style={{ ...btn(true), opacity: busy ? 0.5 : 1 }}>
            {busy ? '만드는 중…' : '캠페인 생성'}
          </button>
          {paletteText.trim() ? null : (
            <span style={{ fontSize: '12px', color: 'var(--fg-4, #6b7280)' }}>비워둔 채로 눌러도 된다</span>
          )}
        </div>
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
                  <a href={`/?case=local:${encodeURIComponent(c.id)}`}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', gap: '12px', textDecoration: 'none',
                      color: 'var(--fg, #e6e9ef)',
                    }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{c.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--fg-3, #8b93a1)' }}>
                      {c.chapters?.length}장 · 예산 {c.budget} · 최소 {c._oracle}회 · {c._difficulty}
                    </span>
                  </a>
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
          <b>진술은 아직 자리표시다</b>(「폐관 준비에는 그곳에 없었습니다」). 논리·어휘·평면도는
          진짜지만 읽을 문장이 아직 없다 — 산문가가 채울 자리다.
        </p>
      </section>
    </div>
  );
}
