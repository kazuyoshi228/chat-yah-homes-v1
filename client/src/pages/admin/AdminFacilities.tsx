/**
 * AdminFacilities — 施設マスタ（chat_facilities）の管理
 *
 * chat_facilities は「公開フラグ＋表示名」だけの最小マスタ（チャットの動作制御専用）。
 * 施設のコンテンツは admin/properties（chat用情報）とサイトが正本（SSoTマップ参照）。
 *
 * 施設の開通手順: ①ここで追加・公開ON ②admin/properties でchat用情報入力
 * ③写真ページで写真登録 ④QRコードページからQRを印刷 — コード変更・デプロイ不要。
 */
import { useState } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";

interface FacilityDoc {
  id: string;
  name?: { ja?: string; en?: string } | string;
  isActive?: boolean;
}

const SLUG_RE = /^[a-z0-9-]{1,40}$/;

export default function AdminFacilities() {
  const { docs, loading } = useCollection("chat_facilities", []);
  const facilities = docs as unknown as FacilityDoc[];

  // 新規追加フォーム
  const [newId, setNewId] = useState("");
  const [newJa, setNewJa] = useState("");
  const [newEn, setNewEn] = useState("");
  const [saving, setSaving] = useState(false);

  // 行ごとの編集状態（名前）
  const [edits, setEdits] = useState<Record<string, { ja: string; en: string }>>({});

  const nameOf = (f: FacilityDoc) => {
    if (typeof f.name === "string") return { ja: f.name, en: f.name };
    return { ja: f.name?.ja ?? "", en: f.name?.en ?? "" };
  };

  const handleAdd = async () => {
    const id = newId.trim();
    if (!SLUG_RE.test(id)) {
      return toast.error("施設IDは半角小文字・数字・ハイフンのみ（URLになります）");
    }
    if (id === "common") return toast.error("common は共通文書用の予約語です");
    if (facilities.some((f) => f.id === id)) return toast.error("そのIDは既に存在します");
    if (!newJa.trim()) return toast.error("表示名（日本語）を入力してください");
    setSaving(true);
    try {
      await setDoc(doc(db, "chat_facilities", id), {
        name: { ja: newJa.trim(), en: (newEn || newJa).trim() },
        isActive: false, // 準備が整うまで非公開で作成
        updatedAt: serverTimestamp(),
      });
      toast.success(`${id} を追加しました（非公開）。準備ができたら公開ONに`);
      setNewId(""); setNewJa(""); setNewEn("");
    } catch (e) {
      console.error(e);
      toast.error("追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (f: FacilityDoc, next: boolean) => {
    try {
      await updateDoc(doc(db, "chat_facilities", f.id), {
        isActive: next,
        updatedAt: serverTimestamp(),
      });
      toast.success(`${f.id} を${next ? "公開" : "非公開に"}しました`);
    } catch (e) {
      console.error(e);
      toast.error("更新に失敗しました");
    }
  };

  const handleSaveName = async (f: FacilityDoc) => {
    const e = edits[f.id];
    if (!e) return;
    try {
      await updateDoc(doc(db, "chat_facilities", f.id), {
        name: { ja: e.ja.trim(), en: (e.en || e.ja).trim() },
        updatedAt: serverTimestamp(),
      });
      toast.success("表示名を更新しました");
      setEdits((prev) => {
        const { [f.id]: _removed, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error(err);
      toast.error("更新に失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">施設</h1>
          <p className="text-sm text-muted-foreground mt-1">
            公開ONで chat.yah.homes/施設ID が有効になります。施設の情報入力は admin/properties（chat用情報）で。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">施設一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : (
              <div className="grid gap-5">
                {facilities.map((f) => {
                  const cur = edits[f.id] ?? nameOf(f);
                  const dirty = !!edits[f.id];
                  return (
                    <div
                      key={f.id}
                      className="border rounded-xl p-6 flex flex-wrap items-end gap-4"
                    >
                      <div className="min-w-[120px]">
                        <p className="text-xs text-muted-foreground">施設ID</p>
                        <p className="font-mono text-sm font-medium">{f.id}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          chat.yah.homes/{f.id}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">表示名（日本語）</Label>
                        <Input
                          value={cur.ja}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [f.id]: { ...cur, ja: e.target.value } }))
                          }
                          className="w-44"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">表示名（英語）</Label>
                        <Input
                          value={cur.en}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [f.id]: { ...cur, en: e.target.value } }))
                          }
                          className="w-44"
                        />
                      </div>
                      {dirty && (
                        <Button size="sm" className="text-xs" onClick={() => handleSaveName(f)}>
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          保存
                        </Button>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {f.isActive !== false ? "公開中" : "非公開"}
                        </span>
                        <Switch
                          checked={f.isActive !== false}
                          onCheckedChange={(v) => handleToggle(f, v)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">施設を追加</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs">施設ID（URLスラッグ・小文字英数とハイフン）</Label>
                <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="例: takasago" />
              </div>
              <div>
                <Label className="text-xs">表示名（日本語）</Label>
                <Input value={newJa} onChange={(e) => setNewJa(e.target.value)} placeholder="例: yah.takasago" />
              </div>
              <div>
                <Label className="text-xs">表示名（英語・省略時は日本語と同じ）</Label>
                <Input value={newEn} onChange={(e) => setNewEn(e.target.value)} placeholder="例: yah.takasago" />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving} className="text-xs">
              <Plus className="w-4 h-4 mr-2" />
              追加（非公開で作成）
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
