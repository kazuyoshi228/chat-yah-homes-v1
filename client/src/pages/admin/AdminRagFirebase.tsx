/**
 * AdminRagFirebase — RAG ドキュメント管理画面（Firestore版）
 * tRPC → Firestore SDK 直接
 */
import { useState, useMemo, useEffect } from "react";
import { orderBy } from "firebase/firestore";
import { useCollection, useAddDoc, useUpdateDoc, useDeleteDoc } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Pencil, Trash2, BookOpen, Globe, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LangFilter = "all" | "ja" | "en" | "zh" | "ko" | "th" | "vi" | "other";

const LANG_FILTERS: { key: LangFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ja", label: "日本語" },
  { key: "en", label: "EN" },
  { key: "zh", label: "中文" },
  { key: "ko", label: "한국어" },
  { key: "th", label: "ไทย" },
  { key: "vi", label: "Tiếng Việt" },
  { key: "other", label: "Other" },
];

function detectLanguage(text: string): LangFilter {
  const sample = text.slice(0, 200);
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(sample)) return "zh";
  if (/[\uAC00-\uD7A3]/.test(sample)) return "ko";
  if (/[\u0E00-\u0E7F]/.test(sample)) return "th";
  if (/[\u00C0-\u024F]/.test(sample)) return "vi";
  if (/^[a-zA-Z\s.,!?]+$/.test(sample)) return "en";
  return "other";
}

interface RagDoc {
  id: string;
  title: string;
  content: string;
  category?: string;
  /** 施設分離キー（"common"=全施設共通）。searchRAG が当該施設＋common のみ検索 */
  facilityId?: string;
  isActive?: boolean;
  source?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

type StatusView = "published" | "pending";

export default function AdminRagFirebase() {
  const { docs, loading, error } = useCollection("chat_rag_documents", [orderBy("createdAt", "desc")]);
  const { addDocument, loading: adding } = useAddDoc("chat_rag_documents");
  const { updateDocument, loading: updating } = useUpdateDoc("chat_rag_documents");
  const { deleteDocument } = useDeleteDoc("chat_rag_documents");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RagDoc | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [facilityId, setFacilityId] = useState("common");
  // 施設セレクタの選択肢（chat_facilities マスタ駆動＋common）
  const { docs: facilityDocs } = useCollection("chat_facilities", []);
  const facilityOptions = useMemo(
    () => ["common", ...facilityDocs.map((f) => f.id).filter((id) => id !== "common")],
    [facilityDocs]
  );
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const [search, setSearch] = useState("");
  const [statusView, setStatusView] = useState<StatusView>("published");
  const [deepLinkDocId, setDeepLinkDocId] = useState<string | null>(null);
  // 内容ビューア（行クリック → 右からスライドイン）
  const [viewDoc, setViewDoc] = useState<RagDoc | null>(null);

  const ragDocs = docs as unknown as RagDoc[];

  const pendingCount = useMemo(
    () => ragDocs.filter((d) => d.isActive === false).length,
    [ragDocs]
  );

  const filtered = useMemo(() => {
    // 承認待ち（下書き = isActive:false）と公開を分ける
    let result = ragDocs.filter((d) =>
      statusView === "pending" ? d.isActive === false : d.isActive !== false
    );
    if (langFilter !== "all") {
      result = result.filter(
        (d) => detectLanguage(`${d.title} ${d.content}`) === langFilter
      );
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [ragDocs, statusView, langFilter, search]);

  // ── ディープリンク（?filter=pending / ?draft=... / ?doc=...） ──
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("filter") === "pending") setStatusView("pending");
    const draft = p.get("draft");
    if (draft) {
      setEditingDoc(null);
      setTitle(draft.slice(0, 60));
      setContent(draft);
      setCategory("");
      setDialogOpen(true);
    }
    const docId = p.get("doc");
    if (docId) setDeepLinkDocId(docId);
  }, []);

  // ?doc= は docs 読み込み後に対象を探して編集ダイアログを開く
  useEffect(() => {
    if (!deepLinkDocId) return;
    const found = ragDocs.find((d) => d.id === deepLinkDocId);
    if (found) {
      openEdit(found);
      setDeepLinkDocId(null);
    }
  }, [deepLinkDocId, ragDocs]);

  const openCreate = () => {
    setEditingDoc(null);
    setTitle("");
    setContent("");
    setCategory("");
    setFacilityId("common");
    setDialogOpen(true);
  };

  const openEdit = (doc: RagDoc) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
    setCategory(doc.category || "");
    setFacilityId(doc.facilityId || "common");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      // 編集時は公開状態を維持（下書きは下書きのまま。公開は [公開] ボタンで行う）
      const isActive = editingDoc ? editingDoc.isActive !== false : true;
      const data = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        facilityId: facilityId || "common",
        isActive,
      };
      if (editingDoc) {
        await updateDocument(editingDoc.id, data);
        toast.success("ドキュメントを更新しました");
      } else {
        await addDocument(data);
        toast.success("ドキュメントを追加しました");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error("保存に失敗しました");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このドキュメントを削除しますか？")) return;
    try {
      await deleteDocument(id);
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  // 下書きを公開（isActive:true）→ onRagDocumentWritten が本番検索に載せる
  const handlePublish = async (id: string) => {
    try {
      await updateDocument(id, { isActive: true });
      toast.success("公開しました（本番AIが参照します）");
    } catch {
      toast.error("公開に失敗しました");
    }
  };

  // 下書きを却下（削除）
  const handleReject = async (id: string) => {
    if (!confirm("この下書きを却下（削除）しますか？")) return;
    try {
      await deleteDocument(id);
      toast.success("却下しました");
    } catch {
      toast.error("却下に失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RAG ドキュメント</h1>
            <p className="text-sm text-muted-foreground mt-1">
              手書き文書は「他に正本が無い知識」専用（正本がある内容はSSoTマップの編集場所へ）
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新規追加
          </Button>
        </div>

        {/* 公開 / 承認待ち 切替 */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatusView("published")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              statusView === "published"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            公開中
          </button>
          <button
            onClick={() => setStatusView("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
              statusView === "pending"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            承認待ち（下書き）
            {pendingCount > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  statusView === "pending" ? "bg-white/25" : "bg-amber-500 text-white"
                )}
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex gap-1">
            {LANG_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setLangFilter(f.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  langFilter === f.key
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} / {ragDocs.length} 件
          </span>
        </div>

        {/* ドキュメントリスト */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 border border-red-200 rounded-lg bg-red-50">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
            <p className="font-semibold">読み込みエラーが発生しました</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>ドキュメントがありません</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setViewDoc(doc)}
                className="border rounded-xl p-6 hover:border-black/20 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {doc.facilityId || "common"}
                      </span>
                      {doc.category && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {doc.category}
                        </span>
                      )}
                      {doc.source === "auto_draft" && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          自動生成
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        <Globe className="w-3 h-3 inline mr-0.5" />
                        {detectLanguage(`${doc.title} ${doc.content}`).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {doc.content}
                    </p>
                  </div>
                  <div
                    className="flex gap-1 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(doc)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {statusView === "pending" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePublish(doc.id)}
                          title="公開する"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(doc.id)}
                          title="却下する"
                        >
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 内容ビューア（右スライドイン・スクロール表示） */}
        <Sheet open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
            {viewDoc && (
              <>
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                  <SheetTitle className="text-base pr-8">{viewDoc.title}</SheetTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {viewDoc.facilityId || "common"}
                    </span>
                    {viewDoc.category && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {viewDoc.category}
                      </span>
                    )}
                    {viewDoc.source === "site_sync" && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        サイト自動同期
                      </span>
                    )}
                    {viewDoc.isActive === false && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        承認待ち
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {viewDoc.content.length.toLocaleString()}字
                    </span>
                  </div>
                </SheetHeader>
                <ScrollArea className="flex-1 min-h-0">
                  <pre className="px-5 py-4 text-xs whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {viewDoc.content}
                  </pre>
                </ScrollArea>
                <div className="px-5 py-3 border-t flex gap-2">
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      openEdit(viewDoc);
                      setViewDoc(null);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    編集
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setViewDoc(null)}
                  >
                    閉じる
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* 作成/編集ダイアログ */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingDoc ? "ドキュメントを編集" : "新規ドキュメント"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: チェックイン手順（清川）"
                />
              </div>
              <div>
                <Label>対象施設（common = 全施設共通）</Label>
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
                <Label>カテゴリ</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="例: checkin, wifi, rules, area"
                />
              </div>
              <div>
                <Label>コンテンツ</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="AIが参照する知識ベースの内容..."
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                💡 保存すると自動的に Gemini Embedding が生成され、ベクトル検索で利用可能になります。
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                disabled={!title.trim() || !content.trim() || adding || updating}
              >
                {(adding || updating) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingDoc ? "更新" : "追加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
