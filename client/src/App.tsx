/**
 * App.tsx — ルーティング定義（chat.yah.homes）
 *
 * - /{facilityId} … 宿泊者チャット（施設マスタ駆動。未知スラッグは施設案内へ）
 * - /admin/*      … 管理画面（DashboardLayout が認証ガードを担当）
 * - /             … 施設案内（フォールバック。通常入口はQR/メールの施設別URL）
 *
 * 🚨 /admin 系のルートは必ず /:facilityId より先に宣言する（先勝ちマッチ）。
 */
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Visitor pages
import FacilityChat from "@/pages/FacilityChat";
import FacilitySelect from "@/pages/FacilitySelect";

// Admin pages（中核のみ・Firebase版）
import BigKPIs from "@/pages/admin/BigKPIsFirebase";
import AdminRag from "@/pages/admin/AdminRagFirebase";
import AdminChatList from "@/pages/admin/AdminChatListFirebase";
import AdminFlowTree from "@/pages/admin/AdminFlowTreeFirebase";
import AdminFeedback from "@/pages/admin/AdminFeedbackFirebase";
import Hospitality from "@/pages/admin/HospitalityFirebase";
import AdminPhotos from "@/pages/admin/AdminPhotos";
import AdminSsotMap from "@/pages/admin/AdminSsotMap";
import AdminQr from "@/pages/admin/AdminQr";
import AdminFacilities from "@/pages/admin/AdminFacilities";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <Switch>
        {/* Root: 施設案内（フォールバック） */}
        <Route path="/">{() => <FacilitySelect />}</Route>

        {/* Admin portal（中核のみ・DashboardLayout内で認証チェック） */}
        <Route path="/admin" component={BigKPIs} />
        <Route path="/admin/dashboard" component={BigKPIs} />
        <Route path="/admin/chats" component={AdminChatList} />
        <Route path="/admin/rag" component={AdminRag} />
        <Route path="/admin/feedback" component={AdminFeedback} />
        <Route path="/admin/flow-tree" component={AdminFlowTree} />
        <Route path="/admin/hospitality" component={Hospitality} />
        <Route path="/admin/photos" component={AdminPhotos} />
        <Route path="/admin/ssot-map" component={AdminSsotMap} />
        <Route path="/admin/qr" component={AdminQr} />
        <Route path="/admin/facilities" component={AdminFacilities} />

        {/* 施設別チャット（認証不要・マスタ駆動）。未知スラッグは内部で施設案内へ */}
        <Route path="/:facilityId">
          {(params) => <FacilityChat facilityId={params.facilityId} />}
        </Route>

        <Route>{() => <FacilitySelect />}</Route>
      </Switch>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
