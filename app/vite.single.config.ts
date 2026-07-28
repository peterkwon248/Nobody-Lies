import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

/**
 * 테스터용 **단일 HTML** 빌드.
 *
 * 평소 빌드(`dist/`)는 서버가 있다고 가정한다 — JS·CSS·사건 JSON·디자인 시스템
 * 번들이 따로 떨어져 있고 절대 경로(`/assets/…`·`/cases/…`)로 서로를 찾는다.
 * 테스터에게는 **파일 하나**를 보내야 하므로 그 전제를 전부 없앤다.
 *
 *   base './'                   절대 경로를 상대 경로로
 *   publicDir false             `public/` 을 복사하지 않는다 — 조립기가 직접 인라인한다
 *   inlineDynamicImports        `import('./Generator.jsx')` 를 한 파일 안으로
 *                               (별도 청크로 나가면 `file://` 에서 못 받는다)
 *   cssCodeSplit false          CSS 한 장으로
 *   assetsInlineLimit 무제한     남는 에셋은 data URI 로
 *
 * 남는 둘 — `_ds_bundle.js`(런타임 `<script src>`)와 사건 JSON(런타임 `fetch`) —
 * 은 번들러가 모르는 자리라 `scripts/bundle-single.mjs` 가 심을 조각으로 처리한다.
 */
export default mergeConfig(
  base,
  defineConfig({
    base: './',
    publicDir: false,
    build: {
      outDir: 'dist-single',
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      // 테스터용이라 읽을 일이 없다. 조립 결과가 그만큼 작아진다
      sourcemap: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'app.js',
          assetFileNames: 'app.[ext]',
        },
      },
    },
  }),
)
