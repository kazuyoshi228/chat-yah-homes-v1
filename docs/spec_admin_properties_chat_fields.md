# 仕様書：admin/properties「chat用情報」セクション（yah.homes 本体側の実装用）

対象: `yah.homes/admin/properties` の編集画面（**「受付の上限」セクションの下**に新設）
保存先: `(default)/property_facts/{propertyId}` （既存ドキュメントに**フラットにフィールド追加**）
作成日: 2026-08-17 ／ chat側実装: 済み（フィールドが生えれば自動でチャットに注入されます）

## チャット側の読み取り仕様（前提）

- チャットAIは応答のたびに `property_facts/{facilityId}` を **read-only** で取得し（5分キャッシュ）、
  **全フィールドをAIコンテキストに注入**します。既知フィールドは整形済みラベル、
  **未知フィールドは `フィールド名: 値` の形でそのまま注入**されるため、
  **admin側で項目を1つ追加するだけでチャットが即座に使い始めます（chat側のコード変更・デプロイ不要）**。
- したがってフィールド名は**英語のわかりやすい camelCase** を推奨（AIがラベルとして読むため）。
- 値は**文字列（自由記述）でOK**。ゲスト向けにそのまま説明できる文章が理想（日本語で書けばAIが各言語に訳して案内します）。
- 🚨 **入室暗証番号・キーボックス番号はこのセクションに絶対に入れない**（それらは property_secrets の管轄。チャットは property_secrets を読みません）。

## フィールド定義（すべて任意）

### 1. Wi-Fi（チャットで案内する方針・2026-08-17確定）
| フィールド名 | 例 |
|---|---|
| `wifiSsid24` | `SGP200W-BDA8-bg` |
| `wifiSsid5` | `SGP200W-BDA8-a` |
| `wifiPassword` | `Nrzc4UH9` |
| `wifiSignLocation` | `LDK中央のコンソールの上に掲示` |

※現在は暫定で chat 側マスタ（chat_facilities）に保持中。**この4フィールドが admin に実装され次第、chat側の値を削除して一本化**します（chatチームに一報ください）。

### 2. 窓口（エスカレーション誘導先）
| フィールド名 | 例 |
|---|---|
| `contactOfficialEmail` | `stay@yah.homes` |
| `contactOfficialPhone` | `092-xxx-xxxx（10:00-18:00）` |

### 3. チェックイン運用
| フィールド名 | 例 |
|---|---|
| `checkinSteps` | `キーボックスは玄関右手。名簿提出後に届く番号で開錠…（番号自体は書かない）` |
| `earlyCheckinPolicy` | `不可` |
| `lateCheckoutPolicy` | `不可` |
| `luggageStoragePolicy` | `チェックイン前・チェックアウト後とも不可` |

### 4. 設備の使い方
| フィールド名 | 例 |
|---|---|
| `bathNotes` | `追い焚きあり。給湯パネルはキッチン横…` |
| `laundryNotes` | `ドラム式洗濯乾燥機（2026年5月設置）。ボタン1つで洗濯〜乾燥まで` |
| `kitchenNotes` | `3口ガスコンロ・炊飯器5合・電子レンジ・ケトル` |
| `tvNotes` | `Google TV 55型。ご自身のアカウントでNetflix等ログイン可` |
| `amenityNotes` | `洗面台に設置（歯ブラシ・シャンプー類・タオル）` |
| `extraBeddingPolicy` | `布団・ベッドの追加不可` |
| `lightingNotes` | `リビング照明は壁スイッチ＋リモコン…` |

### 5. ゴミ・ルール補足
| フィールド名 | 例 |
|---|---|
| `garbageRules` | `分別して室内に置いたまま出発。屋外に出さない。生ゴミは…` |
| `smokingNotes` | `屋内全面禁煙。屋外にも指定喫煙場所なし` |

### 6. トラブル対応
| フィールド名 | 例 |
|---|---|
| `breakerLocation` | `分電盤は玄関上部。落ちたら中央のつまみを上げる` |
| `hotWaterTrouble` | `給湯リモコンの運転を一度切って再度入れる…` |
| `troubleFirstSteps` | `故障時はまず写真を撮って予約経路のメッセージへ` |

### 7. 周辺（Local Guide 補完分）
| フィールド名 | 例 |
|---|---|
| `nearbyLaundromat` | `徒歩3分「○○コインランドリー」` |
| `nearbyConvenience` | `セブンイレブン清川店 徒歩2分` |
| `nearbyAtmPharmacy` | `…` |
| `busToHakata` | `○○バス停から○番系統…` |
| `guestRegistryFormNote` | `フォームは予約確定メール記載。宿泊場所欄は「yah.kiyokawa」を選択` |

### 8. その他
| フィールド名 | 例 |
|---|---|
| `chatNotes` | `チャット専用の補足メモ（ゲストに案内してよい内容のみ）` |
| `chatProhibited` | `チャットで案内してはいけない事項があれば記載` |

### 9. 写真（将来拡張・チャットでの画像表示用）
| フィールド名 | 例 |
|---|---|
| `photoParkingUrl` | `https://.../parking.jpg`（駐車場・公開URL） |
| `photoEntranceUrl` | 玄関・キーボックス位置の写真 |
| `photoBreakerUrl` | 分電盤の写真 |

※チャットUIでの画像表示（例: 駐車場の質問に写真カード添付）は chat 側の次期対応（P2）。
フィールドだけ先に増やしてもらえれば、実装時に即利用できます。まずはURLをAIがリンクとして案内する形から始められます。

## SSoT マップ（どこが正本か）

| 情報 | 正本 | チャットへの経路 |
|---|---|---|
| 施設スペック・数値・chat用情報 | **admin/properties（property_facts）** | 毎ターン自動注入（5分キャッシュ） |
| 規約・ハウスルール | **yah.homes/legal/terms** | 毎日06:00 JSTにRAGへ自動同期（site_sync） |
| 物件ページの案内文（駐車場サイズ等） | **yah.homes/properties/{id}** | 同上（site_sync） |
| 周辺おすすめ | **yah.homes/locals/・/guides/** | AIがURL誘導 |
| 鍵・キーボックス番号 | property_secrets | **チャットは読まない・案内しない** |

## 確定事項（2026-08-18）：admin/templates/#values には相乗りしない

チャットが読む施設情報の正本は **property_facts（chat用情報）のみ**とする。
`mail_templates`（templates/#values）はメール文言の正本として使い分け、**チャットは読まない**。
理由: values には入室暗証番号など機微情報が構造的に混ざり得るため（実際に checkin_ja の
`strings.remEntryBody` に暗証番号らしき実値が直書きされているのを確認）。チャットに読ませる
SSoTは「機微情報が入り得ない場所」に限定する設計原則を維持する。

## 本体側への連絡事項（データ修正のお願い）

- **`property_facts/kiyokawa` の `washer=0` が古い可能性**：物件ページには「2026年5月にドラム式洗濯乾燥機を設置」とあります。`washer=1` への更新をご検討ください（`dryer=1` は衣類乾燥機の意で整合）。
- **`mail_templates/checkin_ja` の `strings.remEntryBody` に暗証番号らしき実値（4桁）が直書き**：
  規約の「暗証番号は宿泊ごとに変更」と不整合の可能性。「暗証番号は {{keyboxCode}} です」のような
  差し込み変数にして、実値は宿泊ごとに property_secrets から差し込む形を推奨（送信事故・固定番号運用の防止）。
