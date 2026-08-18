import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { useIsMobile } from "@/hooks/useMobile";
import { LogOut, PanelLeft, MessageCircle, BookOpen, Star, GitBranch, Target, ShieldCheck, Heart, Image, Map, QrCode, Building2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useAdminAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/hooks/useFirestoreAdmin";
import { where } from "firebase/firestore";
import { YahLogo } from "@/components/YahLogo";

export type SidebarItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 別サイトへの導線（新しいタブで開く）。QRのように正本が yah.homes 側にあるもの用 */
  external?: boolean;
};

const DEFAULT_ADMIN_ITEMS: SidebarItem[] = [
  { title: "Big KPIs", href: "/admin", icon: Target },
  { title: "Chat List", href: "/admin/chats", icon: MessageCircle },
  { title: "RAG Documents", href: "/admin/rag", icon: BookOpen },
  { title: "写真", href: "/admin/photos", icon: Image },
  { title: "施設", href: "/admin/facilities", icon: Building2 },
  // QRの正本は yah.homes の物件情報ページ（実体もそこ・2026-08-18 発注者承認）
  { title: "QRコード", href: "https://yah.homes/admin/properties/", icon: QrCode, external: true },
  { title: "SSoTマップ", href: "/admin/ssot-map", icon: Map },
  { title: "Feedback", href: "/admin/feedback", icon: Star },
  { title: "Flow Tree", href: "/admin/flow-tree", icon: GitBranch },
  { title: "ホスピタリティ", href: "/admin/hospitality", icon: Heart },
];

const MASTER_ADMIN_EMAIL = "kazuyoshi.yamada@bonfire.co.jp";
const MASTER_ADMIN_NAME = "Master Admin";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
  sidebarItems,
  title,
}: {
  children: React.ReactNode;
  sidebarItems?: SidebarItem[];
  title?: string;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, logout, isAdmin, login } = useAdminAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen overflow-hidden bg-black">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.25_0_0),transparent)]" />

        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
          <YahLogo className="text-white" height={36} />
          <div className="space-y-4">
            <h2 className="text-white text-3xl font-semibold leading-snug tracking-tight">
              Chat Support<br />Admin Portal
            </h2>
          </div>
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} yah.homes. All rights reserved.
          </p>
        </div>

        {/* Right panel — sign in form */}
        <div className="flex flex-1 items-center justify-center p-8 relative z-10">
          <div
            className="w-full max-w-sm rounded-2xl p-8 space-y-8"
            style={{
              background: "oklch(0.12 0 0)",
              border: "1px solid oklch(0.22 0 0)",
              boxShadow: "0 24px 64px oklch(0 0 0 / 0.6)",
            }}
          >
            {/* Mobile logo */}
            <div className="flex lg:hidden justify-center">
              <YahLogo className="text-white" height={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-white text-xl font-semibold tracking-tight">
                Admin Sign In
              </h1>
              <p className="text-white/40 text-sm">
                bonfire.co.jp アカウントでサインイン
              </p>
            </div>

            <button
              onClick={() => { login(); }}
              className="group w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
              style={{
                background: "oklch(1 0 0)",
                color: "oklch(0.1 0 0)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.92 0 0)")}
              onMouseLeave={e => (e.currentTarget.style.background = "oklch(1 0 0)")}
            >
              {/* Google icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <p className="text-white/20 text-xs text-center">
              管理者権限のあるアカウントのみアクセス可能です
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl p-8 space-y-6 text-center"
          style={{
            background: "oklch(0.12 0 0)",
            border: "1px solid oklch(0.22 0 0)",
            boxShadow: "0 24px 64px oklch(0 0 0 / 0.6)",
          }}
        >
          <YahLogo className="text-white mx-auto" height={28} />
          <div className="space-y-2">
            <h1 className="text-white text-lg font-semibold">アクセス権限がありません</h1>
            <p className="text-white/40 text-sm">
              {user?.email} は管理者として登録されていません。
            </p>
          </div>
          <button
            onClick={() => { logout(); }}
            className="w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
            style={{ background: "oklch(0.2 0 0)", color: "oklch(0.7 0 0)", border: "1px solid oklch(0.28 0 0)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "oklch(0.25 0 0)")}
            onMouseLeave={e => (e.currentTarget.style.background = "oklch(0.2 0 0)")}
          >
            別のアカウントでサインイン
          </button>
        </div>
      </div>
    );
  }

  // Determine menu items based on role if not provided
  const items = sidebarItems ?? DEFAULT_ADMIN_ITEMS;

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        sidebarItems={items}
        title={title}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  sidebarItems: SidebarItem[];
  title?: string;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarItems,
  title,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAdminAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = sidebarItems.find((item) => item.href === location);
  const isMobile = useIsMobile();

  // 承認待ちRAG下書き（isActive:false）の件数 → サイドバーにバッジ表示
  const { docs: pendingRagDocs } = useCollection("chat_rag_documents", [
    where("isActive", "==", false),
  ]);
  const pendingRagCount = pendingRagDocs.length;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-gray-100" disableTransition={isResizing}>
          <SidebarHeader className="h-14 justify-center border-b border-gray-100">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Admin Section */}
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Admin</span>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-black flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-white">M</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{MASTER_ADMIN_NAME}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{MASTER_ADMIN_EMAIL}</p>
                </div>
              </div>
            </div>
            <SidebarMenu className="px-2 py-2">
              {sidebarItems.map((item) => {
                // "/admin"（Big KPIs）は全サブページの接頭辞になるため完全一致のみで判定
                const isActive = item.external
                  ? false
                  : item.href === "/admin"
                    ? location === "/admin" || location === "/admin/dashboard"
                    : location === item.href || location.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() =>
                        item.external
                          ? window.open(item.href, "_blank", "noopener")
                          : setLocation(item.href)
                      }
                      tooltip={item.title}
                      className="h-9 font-normal text-sm"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.title}</span>
                      {item.href === "/admin/rag" && pendingRagCount > 0 && (
                        <span
                          title={`${pendingRagCount} 件の承認待ち`}
                          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500 text-white"
                        >
                          {pendingRagCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-black text-white">
                      {user?.displayName?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-medium truncate">{user?.displayName ?? user?.email ?? "-"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-12 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <span className="text-sm font-medium">{activeMenuItem?.title ?? title ?? "Menu"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">{children}</main>
      </SidebarInset>
    </>
  );
}
