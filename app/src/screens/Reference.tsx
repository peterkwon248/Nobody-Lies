import { StatusIcon } from '../components/StatusIcon'

/**
 * 표기 안내 — 프로토타입 746~821행 · `buildRef()`(2753~2811행).
 *
 * **맨 마지막에 옮겼다.** 완성된 게임 전체의 범례라, 설명 대상 화면이 다 서기
 * 전에 옮기면 절반이 거짓말이 된다.
 *
 * ★ 견본은 사건과 무관하다 ★ 「장소 갑」·「증인 A」처럼 실제 사건에 없는 말만
 * 쓴다. 범례가 실제 인물·장소를 예로 들면 그 자체가 힌트가 된다.
 *
 * ⚠ **원본에서 빼고 옮긴 것 셋** — 전부 「없는 것을 설명하지 않는다」는 이유다.
 * 범례가 없는 기능을 설명하면 그게 곧 거짓말이고, 이 게임에서 가장 하면 안 되는 일이다.
 *   · `sounds` 4항목 — 소리가 아직 하나도 없다
 *   · 「도착 신호 · 안 읽음」 — 사이드바 안 읽음 점이 없다
 *   · 「보드 모드 · 심증판」 — 공란 슬롯에 카드를 끄는 방식은 앱에 없다
 * 남은 12항목은 전부 실재하는 화면을 설명한다. `DC-SYNC-CHANGESET.md` 9번.
 */

const MARK = {
  확인: { color: 'var(--g-confirm)', tint: 'rgba(76, 183, 130, .1)', wash: 'rgba(76, 183, 130, .16)', icon: '✓', desc: '진술이 물증과 일치.' },
  의심: { color: 'var(--g-suspect)', tint: 'rgba(242, 201, 76, .1)', wash: 'rgba(242, 201, 76, .16)', icon: '?', desc: '검토 필요.' },
  모순: { color: 'var(--g-contradict)', tint: 'rgba(235, 87, 87, .1)', wash: 'rgba(235, 87, 87, .16)', icon: '≠', desc: '진술이 물증과 충돌.' },
} as const

const CELLS: { kind: keyof typeof MARK; sample: string }[] = [
  { kind: '확인', sample: '장소 갑 · 도착' },
  { kind: '의심', sample: '장소 을 · 미상' },
  { kind: '모순', sample: '장소 병 · 모순' },
]

const ANNS: { kind: keyof typeof MARK; sample: string }[] = [
  { kind: '확인', sample: '“…계속 그 자리에 있었습니다.”' },
  { kind: '의심', sample: '“아마 몇 분 거리였을 거예요.”' },
  { kind: '모순', sample: '“돌아와서 바로 잠들었어요.”' },
]

const SECTIONS = [
  {
    status: 'backlog' as const, title: '잠김', chip: '잠김', done: false, dim: true,
    desc: '앞 항을 완성해야 열린다. 항 번호만 보이고 제목·공란 라벨·본문은 가려진다.',
  },
  {
    status: 'progress' as const, title: '열림', chip: '미완성', done: false, strong: true,
    desc: '현재 채우는 항. 공란을 눌러 입력하며, 완성 전까지 자유롭게 수정한다.',
  },
  {
    status: 'done' as const, title: '완성', chip: '완성', done: true,
    desc: '공란을 모두 채우면 자동으로 완성·잠기고 접힌다. 정답 여부는 알리지 않으며, '
      + '연동 정보가 공개된다. 항당 1회 재개봉해 다시 편집할 수 있고, 이미 공개된 정보는 회수되지 않는다.',
  },
]

const REVEALS = [
  { title: '장 완성 직후', desc: '장을 완성하면 관련 정보가 영구 공개된다. 토스트로 사라지지 않는다.' },
  { title: '추가 진술', desc: '용의자 진술에 문단이 추가되고, 어느 장에서 나왔는지 표시된다. 자기 비밀은 다루지 않는다.' },
  { title: '시간축 축소', desc: '사망 추정 구간이 좁혀지고, 이전 범위가 함께 표시된다.' },
  { title: '조사 대상 추가', desc: '조사 패널에 새 대상이 배너로 공개된다.' },
]

/** 원본 `newStates` 14 중 실재하는 12 (위 주석 참조) */
const STATES = [
  { title: '정보 층위 · 확정', desc: '브리핑·확보 물증. 반박 불가한 사실. 실선·채움, 초록 실선 바로 표시. 모순 판정의 유일한 기준.' },
  { title: '정보 층위 · 주장', desc: '용의자 진술. 참일 수도 거짓일 수도. 따옴표·기울임·인물색 바로 표시. 미확정.' },
  { title: '정보 층위 · 판단', desc: '내가 채운 공란. 입력 필드로 표시. 최종 제출 전까지 자유 수정.' },
  { title: '장 · 자동 완성', desc: '장 확인 버튼 없음. 공란을 모두 채우면 자동 완성되고 연동 정보가 공개됨. 채점은 하지 않음.' },
  { title: '최종 제출 · 확인', desc: '아무 때나 제출 가능. 제출 후에만 채점되며 되돌릴 수 없음. 미채움 공란 개수를 경고.' },
  { title: '관계 그래프 · 알리바이 대조', desc: '두 용의자 노드를 선택하면 대조 바가 뜨고, 실행하면 조사 1회로 관계가 드러남.' },
  { title: '평면도 · 시간대별', desc: '시간대를 바꾸면 각 인물의 주장 위치가 점으로 이동. 판정하지 않음.' },
  { title: '평면도 · 미공개 장소', desc: '별채는 1장 완성 전까지 지도에 나타나지 않음.' },
  { title: '정독 · 하이라이트', desc: '드래그 선택 → 확인·의심·모순 색 적용. 인용·복사 가능.' },
  { title: '현장 · 공간 조사', desc: '공간·고정물·시신을 눌러 조사. 미조사(회색)/빈손(초록 테두리)/물증 발견(청록)으로 구분.' },
  { title: '용의자 · 조사 버튼', desc: '카드에서 소지품 검사·통화내역 실행. 사용 가능 / 잔여 부족 / 조사 완료 3상태.' },
  { title: '관계 그래프 · 재구성', desc: '빈 상태에서 시작해 조사·장 완성으로 숨은 관계가 드러남. 추측 관계는 그리지 않음.' },
]

export function Reference() {
  return (
    <div className="nl-ref">
      <div className="v-body nl-ref-intro">
        이 게임에서 쓰는 기호와 상태의 읽는 법입니다. 예시는 실제 사건과 무관한 견본이며,
        정답을 담고 있지 않습니다.
      </div>

      <Cap>공란 상태</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        <div className="nl-ref-card">
          <div className="nl-ref-sample">증인은 <span className="nl-ref-blank-empty">장소</span>에서</div>
          <div className="v-ui nl-ref-t">비어 있음</div>
          <div className="v-meta nl-ref-d">미입력. 후보 유형만 힌트로 표시.</div>
        </div>
        <div className="nl-ref-card">
          <div className="nl-ref-sample">함께 온 <span className="nl-ref-blank-fill">증인 A와</span></div>
          <div className="v-ui nl-ref-t">채움</div>
          <div className="v-meta nl-ref-d">값을 입력함. 최종 제출 전까지 자유롭게 지우거나 바꿀 수 있음.</div>
        </div>
      </div>

      <Cap>장 상태</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className={`nl-ref-card${s.dim ? ' nl-ref-card-dim' : ''}${s.strong ? ' nl-ref-card-strong' : ''}${s.done ? ' nl-ref-card-done' : ''}`}
          >
            <div className="nl-ref-sec-head">
              <StatusIcon status={s.status === 'done' ? 'done' : 'progress'} size={16} />
              <span className="v-ui" style={{ color: 'var(--fg)' }}>{s.title}</span>
              <span className="nl-fs-spacer" />
              <span className={s.done ? 'nl-ref-chip nl-ref-chip-done' : 'nl-ref-chip'}>{s.chip}</span>
            </div>
            <div className="v-meta nl-ref-d">{s.desc}</div>
          </div>
        ))}
      </div>

      <Cap>셀 마킹</Cap>
      <div className="nl-ref-grid nl-ref-grid-narrow">
        {CELLS.map((cm) => {
          const m = MARK[cm.kind]
          return (
            <div key={cm.kind} className="nl-ref-card nl-ref-card-flush">
              <div className="nl-ref-cell" style={{ background: m.tint, boxShadow: `inset 3px 0 0 ${m.color}` }}>
                <span className="nl-ref-cell-icon" style={{ color: m.color }}>{m.icon}</span>
                <span className="nl-ref-cell-sample">{cm.sample}</span>
              </div>
              <div className="nl-ref-cell-body">
                <div className="v-ui nl-ref-t">{cm.kind}</div>
                <div className="v-meta nl-ref-d">{m.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      <Cap>주석 하이라이트</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        {ANNS.map((an) => {
          const m = MARK[an.kind]
          return (
            <div key={an.kind} className="nl-ref-card">
              <div className="nl-ref-ann">
                <span
                  className="nl-ref-ann-sample"
                  style={{ background: m.wash, boxShadow: `inset 0 -1.5px 0 ${m.color}` }}
                >
                  {an.sample}
                </span>
              </div>
              <div className="v-ui nl-ref-t">{an.kind}</div>
              <div className="v-meta nl-ref-d">{m.desc}</div>
            </div>
          )
        })}
      </div>

      <Cap>프로필 슬롯</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        <div className="nl-ref-card">
          <div className="nl-ref-slot">
            <span className="v-meta nl-ref-slot-k">동기</span>
            <span className="nl-ref-slot-dash" />
            <span className="v-micro" style={{ color: 'var(--fg-4)' }}>미확인</span>
          </div>
          <div className="v-ui nl-ref-t">미확인</div>
          <div className="v-meta nl-ref-d">조사로 아직 채우지 못한 슬롯. 점선으로만 표시.</div>
        </div>
        <div className="nl-ref-card">
          <div className="nl-ref-slot">
            <span className="v-meta nl-ref-slot-k">동기</span>
            <span className="v-meta" style={{ color: 'var(--fg-2)', flex: 1 }}>표본 항목</span>
            <span className="nl-ref-new">신규</span>
          </div>
          <div className="v-ui nl-ref-t">확인</div>
          <div className="v-meta nl-ref-d">조사로 확보한 단서가 슬롯을 채움. 신규는 배지로 표시.</div>
        </div>
      </div>

      <Cap>장 완성 공개</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        {REVEALS.map((r) => (
          <div key={r.title} className="nl-ref-card nl-ref-card-reveal">
            <div className="v-ui nl-ref-t">{r.title}</div>
            <div className="v-meta nl-ref-d">{r.desc}</div>
          </div>
        ))}
      </div>

      <Cap>추가 화면 상태</Cap>
      <div className="nl-ref-grid nl-ref-grid-wide">
        {STATES.map((s) => (
          <div key={s.title} className="nl-ref-card">
            <div className="v-ui nl-ref-t">{s.title}</div>
            <div className="v-meta nl-ref-d">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Cap({ children }: { children: React.ReactNode }) {
  return <div className="v-caption nl-ref-cap">{children}</div>
}
