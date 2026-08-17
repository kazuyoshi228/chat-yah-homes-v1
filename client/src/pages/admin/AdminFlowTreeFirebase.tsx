/**
 * AdminFlowTreeFirebase — デシジョンツリー管理（Firestore版）
 * tRPC → Firestore SDK 直接
 */
import { useState, useMemo, useCallback } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, useUpdateDoc, useDeleteDoc } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { parseI18nObject } from "@/lib/i18nJson";
import {
  ChevronRight, Plus, Pencil, Trash2, GitBranch, RefreshCw, ChevronsDownUp, ChevronsUpDown,
  Wifi, Smartphone, CreditCard, MessageSquare, Package, Wrench, AlertTriangle,
  CheckCircle, HelpCircle, Clock, ShoppingCart, Bot, FileText, Bookmark,
  Globe, Settings, Zap, Shield, Star, Home, Map, Phone, Mail, Info,
  type LucideIcon,
} from "lucide-react";

// ─── Icon Key → Lucide mapping ────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  wifi:           Wifi,
  smartphone:     Smartphone,
  credit_card:    CreditCard,
  message:        MessageSquare,
  package:        Package,
  wrench:         Wrench,
  alert:          AlertTriangle,
  check:          CheckCircle,
  help:           HelpCircle,
  clock:          Clock,
  cart:           ShoppingCart,
  bot:            Bot,
  file:           FileText,
  bookmark:       Bookmark,
  globe:          Globe,
  settings:       Settings,
  zap:            Zap,
  shield:         Shield,
  star:           Star,
  home:           Home,
  map:            Map,
  phone:          Phone,
  mail:           Mail,
  info:           Info,
  git_branch:     GitBranch,
};

// Legacy emoji → icon key migration
const EMOJI_TO_KEY: Record<string, string> = {
  "🔌": "wifi",
  "📱": "smartphone",
  "💳": "credit_card",
  "💬": "message",
  "📦": "package",
  "🔧": "wrench",
  "⚠️": "alert",
  "✅": "check",
  "❓": "help",
  "⏱️": "clock",
  "🛒": "cart",
  "🤖": "bot",
  "📋": "file",
  "📝": "file",
  "📌": "bookmark",
  "🔴": "alert",
  "📡": "wifi",
  "⚙️": "settings",
  "💰": "credit_card",
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

function resolveIcon(iconKey: string | null): LucideIcon {
  if (!iconKey) return Bookmark;
  // If it's an emoji, map to key first
  const key = EMOJI_TO_KEY[iconKey] ?? iconKey;
  return ICON_MAP[key] ?? Bookmark;
}

function NodeIcon({ iconKey, className = "h-4 w-4" }: { iconKey: string | null; className?: string }) {
  const Icon = resolveIcon(iconKey);
  return <Icon className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = "question" | "answer" | "redirect_form" | "redirect_ai";

interface FlowNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  label: string;
  content: string | null;
  options: string | null;
  icon: string | null;
  formTrigger: number | null;
  aiTrigger: number | null;
  sortOrder: number | null;
  isActive: number | null;
  createdAt: unknown;
}

interface NodeFormState {
  id: string;
  parentId: string;
  type: NodeType;
  label_ja: string;
  label_en: string;
  content_ja: string;
  content_en: string;
  icon: string;
  formTrigger: boolean;
  aiTrigger: boolean;
  qrResend: boolean;
  sortOrder: number;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  question: "質問分岐",
  answer: "回答表示",
  redirect_form: "フォーム誘導",
  redirect_ai: "AIチャット誘導",
};

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  question:      "bg-blue-50   text-blue-700   border-blue-200",
  answer:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  redirect_form: "bg-orange-50 text-orange-700 border-orange-200",
  redirect_ai:   "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 多言語JSONラベルのパース（widget と共通の lib/i18nJson を使用） */
const parseLabel = parseI18nObject;

function buildNodeForm(node?: FlowNode): NodeFormState {
  if (!node) {
    return { id: "", parentId: "", type: "question", label_ja: "", label_en: "",
      content_ja: "", content_en: "", icon: "", formTrigger: false, aiTrigger: false,
      qrResend: false, sortOrder: 0, isActive: true };
  }
  const label = parseLabel(node.label);
  let content_ja = "", content_en = "";
  if (node.content) {
    try { const c = JSON.parse(node.content); content_ja = c.ja ?? ""; content_en = c.en ?? ""; }
    catch { content_ja = node.content; }
  }
  return {
    id: node.id, parentId: node.parentId ?? "", type: node.type,
    label_ja: label.ja ?? "", label_en: label.en ?? "",
    content_ja, content_en, icon: node.icon ?? "",
    formTrigger: (node.formTrigger ?? 0) === 1,
    aiTrigger: (node.aiTrigger ?? 0) === 1,
    qrResend: label.qr_resend === true,
    sortOrder: node.sortOrder ?? 0,
    isActive: (node.isActive ?? 1) === 1,
  };
}

// ─── Recursive Node Row ───────────────────────────────────────────────────────

function NodeRow({
  node,
  depth,
  childrenOf,
  expandAll,
  onEdit,
  onDeactivate,
}: {
  node: FlowNode;
  depth: number;
  childrenOf: Record<string, FlowNode[]>;
  expandAll: boolean;
  onEdit: (node: FlowNode) => void;
  onDeactivate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = parseLabel(node.label);
  const isInactive = (node.isActive ?? 1) === 0;
  const children = (childrenOf[node.id] ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const hasChildren = children.length > 0;

  // Sync with expandAll toggle
  const isExpanded = expandAll ? true : expanded;

  const depthColors = [
    "border-slate-200",
    "border-blue-200",
    "border-emerald-200",
    "border-amber-200",
    "border-purple-200",
  ];
  const borderColor = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div className={depth > 0 ? `ml-5 border-l-2 ${borderColor} pl-3` : ""}>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded-lg mb-0.5 group transition-colors ${
          isInactive ? "opacity-40" : "hover:bg-muted/40"
        }`}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 text-muted-foreground">
          <NodeIcon iconKey={node.icon} className="h-4 w-4" />
        </span>

        {/* Label + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-medium text-sm ${isInactive ? "line-through" : ""}`}>
              {label.ja ?? label.en ?? node.id}
            </span>
            {label.en && label.en !== label.ja && (
              <span className="text-xs text-muted-foreground hidden sm:inline">/ {label.en}</span>
            )}
            <Badge className={`text-[10px] px-1.5 py-0 border ${NODE_TYPE_COLORS[node.type]}`} variant="outline">
              {NODE_TYPE_LABELS[node.type]}
            </Badge>
            {(node.formTrigger ?? 0) === 1 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-600 border-orange-200" variant="outline">
                フォーム
              </Badge>
            )}
            {label.qr_resend && (
              <Badge className="text-[10px] px-1.5 py-0 bg-cyan-50 text-cyan-700 border-cyan-200" variant="outline">
                QR再送
              </Badge>
            )}

            {hasChildren && (
              <span className="text-[10px] text-muted-foreground">({children.length})</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{node.id}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(node)}>
            <Pencil className="h-3 w-3" />
          </Button>
          {!isInactive && (
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDeactivate(node.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Children — recursive */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              expandAll={expandAll}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminFlowTreeFirebase() {
  const { docs: rawNodes, loading: isLoading } = useCollection("chat_flow_nodes");
  const { updateDocument } = useUpdateDoc("chat_flow_nodes");
  const [saving, setSaving] = useState(false);

  const nodes = rawNodes as unknown as FlowNode[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NodeFormState>(buildNodeForm());
  const [expandAll, setExpandAll] = useState(true);

  // Build tree map: parentId → children[]
  const rootNodes = useMemo(
    () => nodes.filter((n) => !n.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [nodes]
  );
  const childrenOf = useMemo(() => {
    const map: Record<string, FlowNode[]> = {};
    for (const n of nodes) {
      if (n.parentId) {
        if (!map[n.parentId]) map[n.parentId] = [];
        map[n.parentId].push(n);
      }
    }
    return map;
  }, [nodes]);

  function openCreate() { setForm(buildNodeForm()); setDialogOpen(true); }
  function openEdit(node: FlowNode) { setForm(buildNodeForm(node)); setDialogOpen(true); }

  const handleDeactivate = useCallback(async (id: string) => {
    if (!confirm(`ノード「${id}」を無効化しますか？`)) return;
    try {
      await updateDocument(id, { isActive: 0 });
      toast.success("ノードを無効化しました");
    } catch (e) {
      toast.error(`無効化失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [updateDocument]);

  const handleSave = useCallback(async () => {
    if (!form.id.trim()) { toast.error("ノードIDは必須です"); return; }
    if (!form.label_ja.trim() && !form.label_en.trim()) {
      toast.error("日本語または英語のラベルを入力してください"); return;
    }
    const labelObj: Record<string, unknown> = { ja: form.label_ja, en: form.label_en,
      ko: form.label_ja, zh: form.label_ja, th: form.label_ja, vi: form.label_ja };
    if (form.qrResend) labelObj["qr_resend"] = true;
    const label = JSON.stringify(labelObj);
    const content = form.content_ja || form.content_en
      ? JSON.stringify({ ja: form.content_ja, en: form.content_en,
          ko: form.content_ja, zh: form.content_ja, th: form.content_ja, vi: form.content_ja })
      : null;

    setSaving(true);
    try {
      // Use setDoc with merge to support upsert (custom ID)
      const ref = doc(db, "chat_flow_nodes", form.id.trim());
      await setDoc(ref, {
        parentId: form.parentId.trim() || null,
        type: form.type,
        label,
        content,
        icon: form.icon.trim() || null,
        formTrigger: form.formTrigger ? 1 : 0,
        aiTrigger: 1,
        sortOrder: form.sortOrder,
        isActive: form.isActive ? 1 : 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success("ノードを保存しました");
      setDialogOpen(false);
    } catch (e) {
      toast.error(`保存失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [form]);

  const activeCount   = nodes.filter((n) => (n.isActive ?? 1) === 1).length;
  const inactiveCount = nodes.filter((n) => (n.isActive ?? 1) === 0).length;
  const questionCount = nodes.filter((n) => n.type === "question").length;

  return (
    <DashboardLayout title="Flow Tree">
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            デシジョンツリー管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            チャットウィジェットの選択肢フローを管理します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            ノード追加
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "総ノード数",   value: nodes.length,   cls: "" },
          { label: "質問分岐",     value: questionCount,  cls: "text-blue-600" },
          { label: "有効ノード",   value: activeCount,    cls: "text-emerald-600" },
          { label: "無効ノード",   value: inactiveCount,  cls: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">全分岐ツリー</CardTitle>
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setExpandAll(!expandAll)}
            >
              {expandAll
                ? <><ChevronsDownUp className="h-3.5 w-3.5 mr-1" />すべて折りたたむ</>
                : <><ChevronsUpDown className="h-3.5 w-3.5 mr-1" />すべて展開</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">読み込み中...</div>
          ) : rootNodes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              ノードがありません。「ノード追加」から作成してください。
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootNodes.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  childrenOf={childrenOf}
                  expandAll={expandAll}
                  onEdit={openEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Node Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id && nodes.find((n) => n.id === form.id) ? "ノード編集" : "ノード追加"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ID & Parent */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ノードID <span className="text-destructive">*</span></Label>
                <Input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="例: conn_iphone_step1"
                  disabled={!!nodes.find((n) => n.id === form.id) && form.id !== ""}
                />
                <p className="text-xs text-muted-foreground">英数字・アンダースコアのみ。一度設定すると変更不可。</p>
              </div>
              <div className="space-y-1.5">
                <Label>親ノードID</Label>
                <Select
                  value={form.parentId || "__root__"}
                  onValueChange={(v) => setForm({ ...form, parentId: v === "__root__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="（ルートノード）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">（ルートノード）</SelectItem>
                    {nodes
                      .filter((n) => n.id !== form.id)
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.icon} {parseLabel(n.label).ja ?? n.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type & Icon */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ノードタイプ <span className="text-destructive">*</span></Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as NodeType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NODE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>アイコン</Label>
                <Select
                  value={form.icon || "bookmark"}
                  onValueChange={(v) => setForm({ ...form, icon: v })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <NodeIcon iconKey={form.icon || "bookmark"} className="h-4 w-4" />
                        <span className="text-sm">{form.icon || "bookmark"}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ICON_OPTIONS.map((key) => {
                      const Icon = ICON_MAP[key];
                      return (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{key}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Labels */}
            <div className="space-y-1.5">
              <Label>ラベル（日本語）<span className="text-destructive">*</span></Label>
              <Input
                value={form.label_ja}
                onChange={(e) => setForm({ ...form, label_ja: e.target.value })}
                placeholder="例: 接続・通信トラブル"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ラベル（英語）</Label>
              <Input
                value={form.label_en}
                onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                placeholder="例: Connection Issues"
              />
            </div>

            {/* Content */}
            {(form.type === "answer" || form.type === "redirect_form") && (
              <>
                <div className="space-y-1.5">
                  <Label>回答内容（日本語）</Label>
                  <Textarea
                    value={form.content_ja}
                    onChange={(e) => setForm({ ...form, content_ja: e.target.value })}
                    placeholder="ユーザーに表示する解決策・説明文"
                    rows={4}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>回答内容（英語）</Label>
                  <Textarea
                    value={form.content_en}
                    onChange={(e) => setForm({ ...form, content_en: e.target.value })}
                    placeholder="Solution text in English"
                    rows={4}
                  />
                </div>
              </>
            )}

            {/* Flags */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.formTrigger}
                  onCheckedChange={(v) => setForm({ ...form, formTrigger: v, qrResend: v ? false : form.qrResend })}
                />
                <Label className="text-sm">フォーム誘導</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.qrResend}
                  onCheckedChange={(v) => setForm({ ...form, qrResend: v, formTrigger: v ? false : form.formTrigger })}
                />
                <Label className="text-sm text-cyan-700">QR再送トリガー</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-sm">有効</Label>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <Label>表示順（数値が小さいほど上位）</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
