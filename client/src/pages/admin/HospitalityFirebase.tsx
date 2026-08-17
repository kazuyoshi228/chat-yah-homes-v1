/**
 * HospitalityFirebase — ホスピタリティ指針管理（Firestore版・chat DB）
 * chat_hospitality_guidelines を CRUD。AI のシステムプロンプトに注入される行動指針を運用する。
 */
import { useState, useMemo } from "react";
import {
  useCollection,
  useAddDoc,
  useUpdateDoc,
  useDeleteDoc,
} from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Heart,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COL = "chat_hospitality_guidelines";

const CATEGORIES = [
  { key: "credo", label: "クレド" },
  { key: "steps", label: "3ステップ" },
  { key: "tone", label: "トーン" },
  { key: "emotion", label: "感情" },
  { key: "oonas", label: "OONAS" },
  { key: "wow", label: "WOW" },
  { key: "judgment", label: "判断" },
  { key: "scenario", label: "状況別" },
];
const catLabel = (k?: string) =>
  CATEGORIES.find((c) => c.key === k)?.label ?? k ?? "—";

interface Guideline {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  priority?: number;
  isActive?: boolean;
  scope?: "always" | "situational";
  trigger?: { keywords?: string[] } | null;
}

export default function HospitalityFirebase() {
  const { docs, loading, error } = useCollection(COL);
  const { addDocument, loading: adding } = useAddDoc(COL);
  const { updateDocument, loading: updating } = useUpdateDoc(COL);
  const { deleteDocument } = useDeleteDoc(COL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // フォーム
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("tone");
  const [priority, setPriority] = useState("50");
  const [scope, setScope] = useState<"always" | "situational">("always");
  const [keywords, setKeywords] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const items = (docs as unknown as Guideline[]) ?? [];
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999)),
    [items]
  );
  const filtered = useMemo(
    () =>
      catFilter === "all"
        ? sorted
        : sorted.filter((g) => (g.category ?? "") === catFilter),
    [sorted, catFilter]
  );

  // 常時コアの注入プレビュー（サーバの組み立てを模したもの）
  const preview = useMemo(() => {
    const always = sorted.filter(
      (g) => g.isActive !== false && (g.scope ?? "always") === "always"
    );
    const cats: string[] = [];
    for (const g of always) {
      const c = g.category ?? "";
      if (!cats.includes(c)) cats.push(c);
    }
    const sections = cats.map((c) => {
      const lines = always
        .filter((g) => (g.category ?? "") === c)
        .map((g) => `- ${g.title}: ${g.content}`);
      return `■ ${catLabel(c)}\n${lines.join("\n")}`;
    });
    return `【ホスピタリティ基準 — 全ての応答に適用】\n${sections.join("\n")}`;
  }, [sorted]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setCategory("tone");
    setPriority("50");
    setScope("always");
    setKeywords("");
    setDialogOpen(true);
  };

  const openEdit = (g: Guideline) => {
    setEditing(g);
    setTitle(g.title ?? "");
    setContent(g.content ?? "");
    setCategory(g.category ?? "tone");
    setPriority(String(g.priority ?? 50));
    setScope(g.scope ?? "always");
    setKeywords((g.trigger?.keywords ?? []).join(", "));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    const kws = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const data = {
      title: title.trim(),
      content: content.trim(),
      category,
      priority: Number(priority) || 50,
      scope,
      trigger: scope === "situational" && kws.length ? { keywords: kws } : null,
      isActive: editing ? editing.isActive !== false : true,
    };
    try {
      if (editing) {
        await updateDocument(editing.id, data);
        toast.success("指針を更新しました");
      } else {
        await addDocument(data);
        toast.success("指針を追加しました");
      }
      setDialogOpen(false);
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  const toggleActive = async (g: Guideline) => {
    try {
      await updateDocument(g.id, { isActive: g.isActive === false });
    } catch {
      toast.error("切り替えに失敗しました");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この指針を削除しますか？")) return;
    try {
      await deleteDocument(id);
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              ホスピタリティ指針
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI 応答の行動指針（システムプロンプトに注入）。常時＝毎回適用／状況別＝キーワード一致時のみ。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              プロンプト確認
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              新規追加
            </Button>
          </div>
        </div>

        {/* プロンプトプレビュー */}
        {showPreview && (
          <pre className="text-xs bg-gray-50 border rounded-lg p-4 whitespace-pre-wrap max-h-72 overflow-y-auto">
            {preview}
          </pre>
        )}

        {/* カテゴリフィルタ */}
        <div className="flex flex-wrap gap-1 items-center">
          {[{ key: "all", label: "All" }, ...CATEGORIES].map((c) => (
            <button
              key={c.key}
              onClick={() => setCatFilter(c.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                catFilter === c.key
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {c.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} / {items.length} 件
          </span>
        </div>

        {/* リスト */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 border border-red-200 rounded-lg bg-red-50">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
            <p className="font-semibold">読み込みエラー</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>指針がありません</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((g) => {
              const inactive = g.isActive === false;
              return (
                <div
                  key={g.id}
                  className={cn(
                    "border rounded-lg p-3 transition-colors",
                    inactive ? "opacity-50 bg-gray-50" : "hover:border-black/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          p{g.priority ?? "—"}
                        </span>
                        <h3 className="font-medium text-sm truncate">
                          {g.title}
                        </h3>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {catLabel(g.category)}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            (g.scope ?? "always") === "situational"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          )}
                        >
                          {(g.scope ?? "always") === "situational"
                            ? "状況別"
                            : "常時"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {g.content}
                      </p>
                      {(g.scope ?? "always") === "situational" &&
                        g.trigger?.keywords?.length ? (
                        <p className="text-[11px] text-amber-600 mt-1">
                          trigger: {g.trigger.keywords.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(g)}
                        title={inactive ? "有効化" : "無効化"}
                      >
                        {inactive ? (
                          <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(g.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 作成/編集ダイアログ */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editing ? "指針を編集" : "新規指針"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 出迎え"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>カテゴリ</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>優先度</Label>
                  <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    placeholder="小さいほど先"
                  />
                </div>
                <div>
                  <Label>適用</Label>
                  <select
                    value={scope}
                    onChange={(e) =>
                      setScope(e.target.value as "always" | "situational")
                    }
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="always">常時</option>
                    <option value="situational">状況別</option>
                  </select>
                </div>
              </div>
              {scope === "situational" && (
                <div>
                  <Label>トリガーキーワード（カンマ区切り）</Label>
                  <Input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="例: 返金, refund, 払い戻し"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    訪問者メッセージにこれらが含まれる時だけ注入されます（多言語で登録可）。
                  </p>
                </div>
              )}
              <div>
                <Label>内容（行動指針・簡潔に）</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="AIにどう振る舞ってほしいかを1〜2文で..."
                  rows={5}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={!title.trim() || !content.trim() || adding || updating}
              >
                {(adding || updating) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editing ? "更新" : "追加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
