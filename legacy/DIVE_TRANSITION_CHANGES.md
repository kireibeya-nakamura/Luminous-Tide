# 潜る演出のリニューアル (dive-flow-17)

「潜る」ボタンの遷移を、**海画面の上にモーダルを重ねる**方式から、
**一枚の縦長の世界をカメラが下降して下の層へ移動する**方式へ作り替えた変更のまとめ。

方針: 既存の見た目・世界観は維持し、潜る遷移だけを改善。控えめ・上品 / 全体 約1.9秒。
対象は `legacy/` の静的プロトタイプ（公開先: `/Luminous-Tide/legacy/`）。

## 設計の考え方（dive-flow-16 からの転換）

16では水中レイヤーを海画面の上に **フェードイン（重ね表示）** していたため、本質的に
「画面の差し替え＝ポップアップ」に近い見え方だった。17では発想を変え、

- **海（上の層）** … 上方向へ抜けていく（カメラが下降して通り過ぎる）
- **水中（下の層）** … 画面の下に積まれており、下からせり上がってくる

この2層を **同じ尺・同じイージングで連動**させ、境界の発光ラインが画面中央を通過した
瞬間が「水面を越える」。フェードによる差し替えをやめ、**縦方向の連続移動**にしたことで
「潜航して下の層に移動した」体感を狙う。

## 演出の3段階

1. **前進しながら下降（0〜約0.9秒）**: 海Canvasが軽く前進ズーム（scale 1.2）しつつ上方向へ抜ける。同時に水中レイヤーが下からせり上がる。上部に海・下部に水・境界に水面のラインという構図で水面に近づく。
2. **水面を越える（約0.9秒地点）**: 2層が中央で出会い、中央の発光ラインが一本に集約して一瞬フレア（`dive-cross-flash`）。これを越えると画面は水中側に入る。
3. **水中でDive Logが浮かび上がる（越えた後）**: ヘッダーと記録リストが、越えたあとに `transition-delay` で静かにフェード＋浮上。移動中はUIを出さない。

## 変更ファイルと箇所

### `legacy/index.html`
- `.dive-transition` 内の旧要素（`-surface` / `-depth`）を撤去し、空の単一オーバーレイに簡素化。
- キャッシュバスターを `dive-flow-16` → `dive-flow-17`（`styles.css` / `app.js`）。

### `legacy/app.js`
- 定数を整理: `DIVE_REVEAL_MS` を廃止、`DIVE_TRAVEL_MS` を **1900** に。`diveRevealTimer` も削除。
- `openDiveView()`: 押した瞬間に `is-diving` + `is-dive-transitioning` を付与し、**同時に**水中ビューを `is-open`。上の層と下の層を最初から連動して動かす（フェード切替の段階分けを廃止）。
- `closeDiveView()`: `is-open` を外して水中レイヤーを下へ沈め、海Canvasを戻す（浮上）。

### `legacy/styles.css`
- `#tideCanvas`: dive時に **`translateY(-104svh) scale(1.2)`** で上方向へ抜ける（旧: 上に少し動くだけ）。transition と復帰アニメを 1800ms / 共通イージング `cubic-bezier(0.45,0.05,0.3,1)` に統一。
- `.dive-view`: **画面下（`translateY(104svh)`）に常駐し、`is-open` で `translateY(0)` までせり上がる**実レイヤーに変更。フェード（opacity 0→1）依存を廃止。
- `.dive-transition`: 旧オーバーレイ群を撤去し、**中央の一本の発光ライン**に単純化。`dive-cross-flash` で越える瞬間だけフレア。
- intro / record-fab / dive-fab: dive時に **上方向へ退避（`translateY(-46svh)`）** し、世界と一緒に上へ抜ける（単なるフェード退場をやめる）。
- Dive Log コンテンツ（`.dive-header` / `.dive-log-wrap`）: `is-open` 時に `transition-delay` 1150ms / 1320ms で、水中に入った後に浮上。
- 不要キーフレーム（`dive-camera-drop` / `dive-surface-pass` / `dive-depth-pass` ほか）を削除し、`dive-cross-flash` を追加。`dive-canvas-return` を新Canvas位置に合わせて更新。
- モバイル幅の `.record-fab` 退避量を `-46svh` に統一。

## 微調整のツマミ

- 上の層が抜ける量・前進感 → `.is-dive-transitioning #tideCanvas` の `translateY(-104svh)` / `scale(1.2)`
- 下降の速さ・全体尺 → 各 `1800ms` と `app.js` の `DIVE_TRAVEL_MS`（連動させること）
- 越える瞬間のフレアの出るタイミング → `@keyframes dive-cross-flash` の `34% / 50% / 64%`
- Dive Log が出るタイミング → `.dive-view.is-open .dive-header / .dive-log-wrap` の `transition-delay`

## 確認方法

mainへpush → GitHub Pages がビルド。携帯で `/Luminous-Tide/legacy/` を開き「潜る」を試す（検証は実機で）。
