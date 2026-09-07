/**
 * AdminSettings — 運用設定（通知メールのON/OFF）
 *
 * 立ち上げ期の観察用。会話が10分静穏になったら全文をメール送信、
 * 窓口誘導（エスカレーション）発生時は即時アラート。
 * トグルはデプロイ不要で即反映（Functions側が chat_settings/notifications を毎回参照）。
 */
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

const REF = () => doc(db, "chat_settings", "notifications");

export default function AdminSettings() {
  const [enabled, setEnabled] = useState(false);
  const [escalationAlert, setEscalationAlert] = useState(false);
  const [recipient, setRecipient] = useState("kazuyoshi.yamada@bonfire.co.jp");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getDoc(REF());
        if (s.exists()) {
          const d = s.data();
          setEnabled(d.enabled === true);
          setEscalationAlert(d.escalationAlert === true);
          if (d.recipient) setRecipient(d.recipient);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (patch: Record<string, unknown>, msg: string) => {
    try {
      await setDoc(
        REF(),
        { enabled, escalationAlert, recipient, ...patch, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success(msg);
    } catch (e) {
      console.error(e);
      toast.error("保存に失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">会話の通知メール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">会話まとめを送る</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      会話が10分間途切れたら、やり取り全文を1通にまとめて送信します（重複送信なし）。
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => {
                      setEnabled(v);
                      save({ enabled: v }, v ? "通知をONにしました" : "通知をOFFにしました");
                    }}
                  />
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">窓口誘導が起きたら即座に知らせる</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AIが解決できず窓口へ誘導した時点で、そこまでのやり取りをすぐ送ります（対応が必要な可能性）。
                    </p>
                  </div>
                  <Switch
                    checked={escalationAlert}
                    onCheckedChange={(v) => {
                      setEscalationAlert(v);
                      save({ escalationAlert: v }, v ? "即時アラートをONにしました" : "即時アラートをOFFにしました");
                    }}
                  />
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs">宛先（カンマ区切りで複数可）</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="max-w-md"
                    />
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => save({ recipient: recipient.trim() }, "宛先を保存しました")}
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      保存
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    送信元は yah.homes 共通の Gmail（本体サイトと同じ設定を使用）。
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
