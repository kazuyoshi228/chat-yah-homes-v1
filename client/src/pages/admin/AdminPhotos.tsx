/**
 * AdminPhotos — チャット用写真の管理（アップロード・一覧・削除）
 *
 * アップロード/削除は管理者限定 callable（uploadChatPhoto / deleteChatPhoto）経由。
 * クライアントは長辺1600pxに縮小してから送る（通信量・Storage節約）。
 * ラベルがAIの添付判断の材料になる（例:「駐車場」→駐車場の質問で添付）。
 */
import { useMemo, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { orderBy } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { useCollection } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, Copy } from "lucide-react";

const fns = getFunctions(app, "asia-northeast1");
const uploadFn = httpsCallable(fns, "uploadChatPhoto");
const deleteFn = httpsCallable(fns, "deleteChatPhoto");

interface PhotoDoc {
  id: string;
  facilityId?: string;
  label?: string;
  url?: string;
  sizeBytes?: number;
  createdAt?: { toDate?: () => Date };
}

/** 長辺1600pxへ縮小し JPEG base64 を返す（PNG/WebPもJPEG化して統一） */
async function resizeToBase64(file: File): Promise<{ base64: string; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], contentType: "image/jpeg" };
}

export default function AdminPhotos() {
  const { docs: facilityDocs } = useCollection("chat_facilities", []);
  const { docs: photoDocs, loading } = useCollection("chat_photos", [
    orderBy("createdAt", "desc"),
  ]);
  const photos = photoDocs as unknown as PhotoDoc[];

  const facilityOptions = useMemo(
    () => ["common", ...facilityDocs.map((f) => f.id).filter((id) => id !== "common")],
    [facilityDocs]
  );

  const [facilityId, setFacilityId] = useState("kiyokawa");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("画像ファイルを選択してください");
    if (!label.trim()) return toast.error("ラベルを入力してください（AIの添付判断に使います）");
    setUploading(true);
    try {
      const { base64, contentType } = await resizeToBase64(file);
      await uploadFn({ facilityId, label: label.trim(), imageBase64: base64, contentType });
      toast.success("アップロードしました（チャットには最大5分で反映）");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error(e);
      toast.error("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (p: PhotoDoc) => {
    if (!confirm(`「${p.label}」を削除しますか？`)) return;
    try {
      await deleteFn({ photoId: p.id });
      toast.success("削除しました");
    } catch (e) {
      console.error(e);
      toast.error("削除に失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">チャット用写真</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">アップロード</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label className="text-xs">対象施設（common = 全施設共通）</Label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {facilityOptions.map((fid) => (
                    <option key={fid} value={fid}>
                      {fid}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">ラベル（AIが見る説明。例: 駐車場 / 分電盤の場所）</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例: 駐車場（W2,000×D5,000）"
                />
              </div>
              <div>
                <Label className="text-xs">画像（JPEG/PNG/WebP・自動で縮小されます）</Label>
                <Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" />
              </div>
            </div>
            <Button onClick={handleUpload} disabled={uploading} className="text-xs">
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              アップロード
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">登録済み写真（{photos.length}）</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">まだ写真がありません</p>
            ) : (
              <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <div key={p.id} className="border rounded-lg overflow-hidden">
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={p.url}
                        alt={p.label}
                        loading="lazy"
                        className="w-full h-32 object-cover"
                      />
                    </a>
                    <div className="p-3 space-y-1.5">
                      <p className="text-xs font-medium truncate">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.facilityId}
                        {p.sizeBytes ? ` · ${Math.round(p.sizeBytes / 1024)}KB` : ""}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(p.url ?? "");
                            toast.success("URLをコピーしました");
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleDelete(p)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
