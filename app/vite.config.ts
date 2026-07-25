import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const engineSrc = fileURLToPath(new URL('../engine/src', import.meta.url))

/**
 * 엔진 소스를 그대로 import 하기 위한 해석기.
 *
 * `engine/` 은 tsx 로 도는 ESM 이라 상대 경로를 `./types.js` 로 쓴다. 브라우저 번들러는
 * 그 `.js` 를 실제 파일로 찾지 못하므로 **엔진 안에서 시작된 import 에 한해** `.ts` 로
 * 되돌린다. 범위를 엔진으로 좁혔으므로 앱·node_modules 의 정상적인 `.js` import 는
 * 건드리지 않는다.
 *
 * 왜 복사(이식)하지 않고 참조하는가 — `HANDOFF-TO-CODE.md` §4 는 "검증기에서 이식"
 * 이라고 적었지만, 같은 판정 로직이 두 벌 있으면 **반드시 갈라진다.** 2026-07-24에
 * 엔진과 프로토타입이 정확히 그렇게 14곳 어긋났다. 런타임에 필요한 셋(`types`·
 * `deriver`·`verifier` 의 `deriveFacts`/`deriveTerms`)은 순수 함수라 브라우저에서 돌고,
 * Node 의존이 있는 `schema.ts` 는 빌드 타임에만 쓰이므로 번들에 들어오지 않는다.
 */
function engineResolver(): Plugin {
  return {
    name: 'nobody-lies:engine-js-to-ts',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !importer.startsWith(engineSrc)) return null
      if (!source.startsWith('.') || !source.endsWith('.js')) return null
      return this.resolve(source.slice(0, -3) + '.ts', importer, { skipSelf: true })
    },
  }
}

export default defineConfig({
  plugins: [engineResolver(), react()],
  resolve: {
    alias: {
      '@engine': engineSrc,
    },
  },
  // 기본은 3000. 이 저장소는 병렬 세션이 전제라(기계 3대) 포트가 겹칠 때
  // PORT 로 비켜설 수 있어야 한다
  server: { port: Number(process.env.PORT) || 3000 },
})
