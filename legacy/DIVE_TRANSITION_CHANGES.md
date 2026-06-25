# 潜る演出のリニューアル (dive-flow-18)

「潜る」演出を **DOMの複数レイヤーの動き** から、**Canvas（実際の海が描かれている場所）の中で起こす演出** へ全面的に作り替えた変更のまとめ。
対象は `legacy/` の静的プロトタイプ（公開先: `/Luminous-Tide/legacy/`）。

## なぜ作り替えたか（16/17 の失敗）

16・17では、水中ビュー（ヘッダー・ログカード・光の帯・水面の帯）という**別々のDOM要素**を
動かして潜航を表現していた。その結果、

- 箱が個別にフェード／移動するため「2〜3個のポップアップがバラバラに出る」見え方になる
- ログカードの `backdrop-filter: blur` が動きながら再描画され「カクカク」する

という問題が解消できなかった。**スペクタクルをDOMからCanvasへ移す**ことで根本解決する。

## 新しい演出（Canvas主導）

1. **集約**: 「潜る」を押すと `diveProgress`(0→1) が立ち上がり、
   - 夜光虫（粒子）が水平線（`surfaceY`）へ吸い寄せられて集まる
   - 波の振幅（`surfaceAmp`）が 0 に近づき、水平線が**一本のまっすぐな線**になる
   - 発光ラインの輝度・太さ（`diveBoost`）が増し、一本の明るい線として際立つ
2. **通過**: Canvas全体をその線へズーム＋上方向へ送り（カメラが沈んで線を越える）、
   暗い水中色のシールを被せて「水の断面を越えて水中に入った」状態にする
3. **Dive Log**: 線を越えたあと（約1秒後）に、水中画面が **1枚として静かにフェードイン**。
   要素ごとの遅延・スライド・blur を一切使わないので、ポップアップ感もカクつきも出ない。

## 変更ファイルと箇所

### `legacy/app.js`
- `diveProgress` / `diveTarget` を追加し、`frame()` 内で毎フレーム補間。
- `frame()`: `diveProgress` に応じて Canvas にカメラ変換（線へズーム＋上方向へ送る）を適用し、最後に水中色のシール（暗転）を重ねる。
- `waterBounds()`: `surfaceAmp` を `(1 - diveProgress*0.92)` 倍し、潜るほど波が消えて一本の線に。
- `updateParticles()`: 潜行中は各粒子を `surfaceY`（線）へ引き寄せて集約。水面での跳ね返しは `diveProgress<0.35` の時だけ。
- `drawWaterBase()`: `diveBoost = 1 + diveProgress*3.4` で水平線の輝度・shadow・太さを増幅。
- `openDiveView()` / `closeDiveView()`: クラスの重ね合わせをやめ、`diveTarget` で Canvas潜航を駆動。`DIVE_REVEAL_MS`(1000ms) 後に Dive Log を `is-open` で1枚フェード。戻りは `DIVE_RETURN_MS`(900ms)。

### `legacy/styles.css`
- `#tideCanvas` の dive用CSS変換（`translateY(-104svh)` 等）を**廃止**（潜航はCanvas内で描画）。
- 上UI（intro / record-fab / dive-fab）は dive中に**透明化するだけ**（移動なし）。
- 旧クロスフラッシュ用の `.dive-transition` を `display:none` 化（不要）。
- `.dive-view`: スライド／scale／子要素ごとの遅延フェードを**全廃**し、**単純な opacity フェード1枚**に。
- `.dive-log-item` / `.dive-close` から `backdrop-filter: blur` を**除去**（カクつきの主因）。背景は不透明寄りのrgbaへ。
- 不要キーフレーム（`dive-cross-flash` / `dive-canvas-return`）を削除。

### `legacy/index.html`
- キャッシュバスターを `dive-flow-17` → `dive-flow-18`。

## 微調整のツマミ

- 集約の速さ・全体尺 → `app.js` `frame()` の `dt * 3.4`（`diveProgress` の補間速度）
- 線への吸い寄せの強さ → `updateParticles()` の `pull * 0.16`
- 線の明るさ → `drawWaterBase()` の `diveBoost = 1 + diveProgress * 3.4`
- カメラの沈み込み量・ズーム → `frame()` の `ease * height * 0.5` と `ease * 0.42`
- 暗転（水中入り）のタイミング → `frame()` の `(diveProgress - 0.3) / 0.6`
- Dive Log が出る間合い → `app.js` の `DIVE_REVEAL_MS`

## 確認方法

mainへpush → GitHub Pages がビルド。携帯で `/Luminous-Tide/legacy/` を開き「潜る」を試す（検証は実機で）。
