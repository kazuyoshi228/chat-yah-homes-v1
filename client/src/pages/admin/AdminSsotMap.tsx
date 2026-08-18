/**
 * AdminSsotMap — SSoTマップ（情報の正本と編集場所のリファレンス）
 *
 * 「チャットの回答を変えたいとき、どこを編集すればよいか」の一覧。
 * 静的コンテンツ（仕組みが変わったらここも更新する）。
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SSOT_ROWS: { info: string; source: string; path: string }[] = [
  { info: "施設スペック・数値（時刻・定員・設備等）", source: "yah.homes/admin/properties/{施設}/", path: "チャットへ毎ターン自動注入（最大5分で反映）" },
  { info: "chat用情報（Wi-Fi・窓口・使い方・トラブル対処 Q&A）", source: "yah.homes/admin/properties/{施設}/#chat", path: "チャットへ毎ターン自動注入（最大5分で反映）" },
  { info: "規約・ハウスルール・キャンセル", source: "yah.homes/legal/terms", path: "毎日06:00 JSTにRAGへ自動同期" },
  { info: "物件ページ（設備・ベッド・アクセス）", source: "yah.homes/properties/{施設}/", path: "毎日06:00 JSTにRAGへ自動同期" },
  { info: "使い方ガイド（駐車場・入室・設備手順）", source: "yah.homes/how-to/{施設}/", path: "毎日06:00 JSTにRAGへ自動同期" },
  { info: "周辺おすすめ（飲食・コンビニ・薬局等）", source: "yah.homes/locals/・/guides/", path: "毎日06:00 JSTにRAGへ自動同期＋AIがURL誘導" },
  { info: "チャット用写真（駐車場・分電盤など）", source: "このAdminの「写真」ページ", path: "AIが関連する質問で画像カードとして添付" },
  { info: "施設の公開フラグ・表示名（チャット動作制御）", source: "chat側マスタ（chat_facilities）", path: "施設URLの有効判定・ヘッダー表示に使用" },
  { info: "上記に無い運用知識（他に正本が無いものだけ）", source: "このAdminの「RAG Documents」", path: "保存時に自動Embedding→即反映" },
  { info: "施設QRコード（印刷・ダウンロード）", source: "このAdminの「QRコード」ページ", path: "公開中の施設ぶん自動生成" },
  { info: "鍵・入室暗証番号", source: "property_secrets（本体管理）", path: "🚫 チャットは読まない・絶対に案内しない" },
];

export default function AdminSsotMap() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SSoTマップ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            情報の正本と編集場所。チャットの回答を変えたいときは「正本」を編集してください（二重管理しない）。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">どこを編集すればチャットに反映されるか</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4 font-medium">情報</th>
                    <th className="py-2 pr-4 font-medium">正本（編集場所）</th>
                    <th className="py-2 font-medium">チャットへの反映経路</th>
                  </tr>
                </thead>
                <tbody>
                  {SSOT_ROWS.map((r) => (
                    <tr key={r.info} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-4 font-medium">{r.info}</td>
                      <td className="py-2 pr-4">{r.source}</td>
                      <td className="py-2 text-muted-foreground">{r.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              進捗の管理はリポジトリの docs/ssot_map_progress.xlsx（またはお手元のスプレッドシート）で。
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
