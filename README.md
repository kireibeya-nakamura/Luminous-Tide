# Luminous Tide Prototype

努力時間の記録に応じて、夜光虫のように光る水面が育つWebプロトタイプです。

## 開き方

PCで直接見る場合は `index.html` をブラウザで開きます。

スマホから同じLAN内で見る場合は、PowerShellでこのフォルダを開いてから以下を実行します。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve-static.ps1 -Root . -Port 8787
```

起動後、PCのIPアドレスを使ってスマホから開きます。

```text
http://<PCのIPアドレス>:8787/
```

## 現在できること

- 努力時間とカテゴリを記録する
- 今日、合計、継続日数を表示する
- 記録量に応じて水面の光量、粒子密度、水面スケールが変わる
- ホバーで光が集まる
- ドラッグで水を混ぜるような流れが出る
- クリック / タップで波紋と発光粒子が出る
- スマホの傾き入力に対応するボタンがある

## ファイル構成

- `index.html`: 画面構造
- `styles.css`: UIとレイアウト
- `app.js`: Canvas描画、記録保存、インタラクション
- `serve-static.ps1`: スマホ確認用の簡易ローカルサーバー
- `CLAUDE_BRIEF.md`: 他AIや共同編集者へ渡すための企画・実装メモ

## GitHub Pagesで公開する場合

1. GitHubで新しいリポジトリを作る
2. このフォルダをGitHubへpushする
3. GitHubのリポジトリ画面で `Settings` -> `Pages` を開く
4. `Build and deployment` のSourceを `Deploy from a branch` にする
5. Branchを `main`、Folderを `/root` にする
6. 表示されたURLを開く

GitHub Pagesに置けば、PCのローカルサーバーを起動しなくてもスマホやClaudeから同じURLを参照できます。
