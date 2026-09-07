# 設計メモ — 清川 リモコン対訳RAGの追加（2026-09-07）

- 状態: 発注者承認済み（yah-os 物件カードスレッドからの持ち込み・2026-09-07）
- 種別: 小規模追加（RAG文書2件＋seedスクリプト1本＋画像の非公開保管）。コード変更なし・再デプロイ不要

## 何を足すか

宿泊者向けに作成した3機器のリモコン操作ガイド（日英中韓）をRAG化する。
既存の「エアコン対訳」（kiyokawa_signage.md → RAG）と同じ型——リモコンは日本語表記のため対訳が価値。

1. **給湯リモコン**（浴室 Rinnai BC-155V(A)／キッチン MC-155V(A)）
   - 自動=Auto fill=自动注水=자동 물받기（1回押すと湯張り→保温）・おいだき・たし湯/たし水・優先 ほか
2. **浴室乾燥機**（MAX DRYFAN UFD-112A）
   - 24時間換気は消さない（緑ランプ=正常）・乾燥=洗濯物・停止の対象

訳語は 2026-09-07 に独立エージェントで審査済み（自动放水→自动注水 等の是正を反映）。

## 正本と重複しないことの確認（CLAUDE.md 手書きRAG原則）

- 機器の操作方法は property_facts にもサイトにも無い＝「他に正本が無い知識」に該当
- 数値（温度の推奨値等）は書かない。Wi-Fi・暗証番号は含まれない

## 置き場

- 原稿: docs/rag_sources/kiyokawa_remotes.md
- 投入: functions/scripts/seed_rag_kiyokawa_remotes.mjs（固定ID upsert・--write で投入）
- 画像原本（3機器×3言語のJPEG）: gs://yah-homes.firebasestorage.app/chat-rag-sources/kiyokawa/remotes/ に非公開保管
  （編集用SVGと印刷用の正本は yah-os 側 gs://yah-homes-os-archive/properties/kiyokawa/guest/）

## 実行（ユーザー）

    cd functions && node scripts/seed_rag_kiyokawa_remotes.mjs          # 下見
    cd functions && node scripts/seed_rag_kiyokawa_remotes.mjs --write  # 投入（onRagDocumentWritten が自動Embedding）

投入後は管理画面で isActive を確認し、SIMで「お風呂の入れ方」「換気扇を止めていい？」等を回帰確認。
