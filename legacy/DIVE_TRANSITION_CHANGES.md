# 潜る演出のリニューアル (dive-flow-16)

「潜る」ボタンの遷移を、**モーダルが開く**印象から、**海に潜る連続した空間移動**へ作り替えた変更のまとめ。
方針: 既存の見た目・世界観は維持し、潜る遷移だけを改善。控えめ・上品 / 全体 約2秒。

対象は `legacy/` の静的プロトタイプ（公開先: `/Luminous-Tide/legacy/`）。

## 演出の3段階

1. **沈み込み（0〜約1秒）**: 海のCanvasが水平線を軸に下へ傾きながら近づき、周囲が暗くなって視線が一本の線に集約される。
2. **水面を越える（約0.98秒地点）**: 発光する水平線が画面中央へ集まり、越える瞬間に発光ブルーム→上へ抜ける。同時に下から暗さがせり上がり水中を満たす。
3. **水中でDive Logが浮かび上がる（越えた後）**: ヘッダーと記録リストが、越えたあとに静かにフェード＋浮上。移動中にUIが出ない。

## 変更ファイルと箇所

### `legacy/index.html`
- キャッシュバスターを `dive-flow-15` → `dive-flow-16` に更新（`styles.css` / `app.js` 両方）。携帯で確実に新アセットを読ませるため。

### `legacy/app.js`
- 遷移タイミング定数を変更:
  - `DIVE_REVEAL_MS` 1450 → **980**（水面を越えた瞬間に水中へ切替）
  - `DIVE_TRAVEL_MS` 2380 → **2000**（全体の所要時間）

### `legacy/styles.css`
- `#tideCanvas`: `transform-origin` を `50% 48%` → `50% 40%`（水平線を軸に）。transition を 2100/2300ms → **1500/1600ms** に短縮し、越える前に沈み切るように。
- `.is-dive-transitioning #tideCanvas`: 上へ飛ぶ `translateY(-32svh) scale(1.12)` を廃止し、**下へ傾き近づく `translateY(7svh) scale(1.16)`** ＋減光に変更。
- `.dive-transition-depth`: 背景グラデーションを強化し、越える瞬間にほぼ黒へ満ちて水中背景となじむように。
- 遷移アニメーションの尺を 2350ms → **2000ms** に統一（forward / return 各レイヤー）。canvas復帰は 1600ms。
- キーフレーム全面改訂:
  - `dive-camera-drop`: 前進のズーム（scale 1→1.06）。
  - `dive-surface-pass`: 水平線が中央へドリフト → 一本に集約 → ブルーム → 上へ抜ける。
  - `dive-depth-pass`: 暗さが下からせり上がり越えた所で満ちる。
  - 復帰側 `dive-camera-rise` / `dive-surface-return` / `dive-depth-return` / `dive-canvas-return` も対称に作り直し。
- `.dive-view`: せり上がる “モーダル開き”（`translateY(20svh) scale(1.04)`）を弱め、**`translateY(8svh) scale(1.03)`** に。
- **Dive Log コンテンツの遅延出現を新設**: `.dive-header` / `.dive-log-wrap` を初期 `opacity:0` とし、`.dive-view.is-open` 時に `transition-delay` 1050ms / 1260ms で静かにフェード＋浮上。復帰時は遅延0。

## 微調整のツマミ

- 沈む感を強く → `.is-dive-transitioning #tideCanvas` の `translateY(7svh)`
- 線が中央に集まる位置 → `@keyframes dive-surface-pass` の `38% / 54%` の `translateY`
- ブルームの強さ → 同 `54%` の `filter: brightness(2)`
- Dive Log が出るタイミング → `.dive-view.is-open .dive-header / .dive-log-wrap` の `transition-delay`

## 確認方法

mainへpush → GitHub Pages がビルド。携帯で `/Luminous-Tide/legacy/` を開き「潜る」を試す（検証は実機で）。
