/**
 * notifySettings — 通知のON/OFF設定（chat DB: chat_settings/notifications）
 *
 * 管理画面のトグルから切り替える。デプロイなしで停止できるようにするための設定。
 * ドキュメントが無い場合は「無効」を既定とし、意図しない送信を防ぐ。
 */
import { chatDb } from "../db";

export interface NotifySettings {
  /** 会話まとめ通知（静穏10分後） */
  enabled: boolean;
  /** 窓口誘導（エスカレーション）発生時の即時アラート */
  escalationAlert: boolean;
  /** 宛先（カンマ区切りで複数可） */
  recipient: string;
}

const DEFAULTS: NotifySettings = {
  enabled: false,
  escalationAlert: false,
  recipient: "kazuyoshi.yamada@bonfire.co.jp",
};

export async function getNotifySettings(): Promise<NotifySettings> {
  try {
    const snap = await chatDb.collection("chat_settings").doc("notifications").get();
    if (!snap.exists) return DEFAULTS;
    const d = snap.data() as Partial<NotifySettings>;
    return {
      enabled: d.enabled === true,
      escalationAlert: d.escalationAlert === true,
      recipient: (d.recipient || DEFAULTS.recipient).trim(),
    };
  } catch (e) {
    console.error("notifySettings 取得エラー:", e);
    return DEFAULTS;
  }
}
