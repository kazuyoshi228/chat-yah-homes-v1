/**
 * labels — チャットUI内の静的な多言語ラベル辞書（yah.homes）
 *
 * Firestore由来の動的テキスト（フローノード・施設マスタ等）は lib/i18nJson.parseI18n、
 * ここは「チャットUI自体」の固定文言（6言語）。
 * エスカレーションの誘導先（予約経路別窓口）はAIが会話内で案内する（固定URLは持たない）。
 */

type LabelMap = Record<string, string>;

const L = (
  ja: string,
  en: string,
  zh: string,
  ko: string,
  th: string,
  vi: string
): LabelMap => ({ ja, en, zh, ko, th, vi });

/** 言語→ラベル解決（en フォールバック） */
export const pick = (map: LabelMap, lang: string): string =>
  map[lang] ?? map.en;

/** AIチャットへの導線 */
export const AI_CHAT_LABEL = L(
  "AIサポートに質問する",
  "Ask AI Support",
  "向AI支持提问",
  "AI 지원에 질문하기",
  "ถาม AI Support",
  "Hỏi AI Support"
);

/** ログイン/新規登録パネル */
export const AUTH_LABELS = {
  signin: L("ログイン", "Sign in", "登录", "로그인", "เข้าสู่ระบบ", "Đăng nhập"),
  signout: L("ログアウト", "Sign out", "登出", "로그아웃", "ออกจากระบบ", "Đăng xuất"),
  register: L("新規登録", "Sign up", "注册", "회원가입", "สมัคร", "Đăng ký"),
  google: L(
    "Google で続ける",
    "Continue with Google",
    "使用 Google 继续",
    "Google로 계속",
    "ดำเนินการต่อด้วย Google",
    "Tiếp tục với Google"
  ),
  email: L("メールアドレス", "Email", "邮箱", "이메일", "อีเมล", "Email"),
  password: L("パスワード", "Password", "密码", "비밀번호", "รหัสผ่าน", "Mật khẩu"),
  toLogin: L(
    "アカウントをお持ちの方",
    "Already have an account? Sign in",
    "已有账号？登录",
    "이미 계정이 있으신가요? 로그인",
    "มีบัญชีแล้ว? เข้าสู่ระบบ",
    "Đã có tài khoản? Đăng nhập"
  ),
  toRegister: L(
    "アカウントを作成",
    "Create an account",
    "创建账号",
    "계정 만들기",
    "สร้างบัญชี",
    "Tạo tài khoản"
  ),
  hint: L(
    "ログインすると、会話の履歴を引き継げます。",
    "Sign in to keep your conversation history.",
    "登录后可保留您的会话记录。",
    "로그인하면 대화 기록을 이어갈 수 있습니다.",
    "เข้าสู่ระบบเพื่อเก็บประวัติการสนทนาของคุณ",
    "Đăng nhập để giữ lịch sử trò chuyện của bạn."
  ),
  error: L(
    "認証に失敗しました。メール/パスワードをご確認ください。",
    "Sign-in failed. Please check your email/password.",
    "认证失败，请检查邮箱/密码。",
    "인증 실패. 이메일/비밀번호를 확인하세요.",
    "การเข้าสู่ระบบล้มเหลว โปรดตรวจสอบอีเมล/รหัสผ่าน",
    "Đăng nhập thất bại. Vui lòng kiểm tra email/mật khẩu."
  ),
  or: L("または", "or", "或", "또는", "หรือ", "hoặc"),
};

/** 施設案内（フォールバック画面） */
export const FACILITY_LABELS = {
  selectTitle: L(
    "ご宿泊の施設を選択してください",
    "Please select your property",
    "请选择您入住的设施",
    "숙박하시는 시설을 선택해 주세요",
    "กรุณาเลือกที่พักของคุณ",
    "Vui lòng chọn cơ sở lưu trú của bạn"
  ),
  loading: L(
    "読み込み中…",
    "Loading…",
    "加载中…",
    "불러오는 중…",
    "กำลังโหลด…",
    "Đang tải…"
  ),
  notFound: L(
    "施設が見つかりません。お部屋に掲示のQRコード、またはご予約のご案内メールのリンクからアクセスしてください。",
    "Property not found. Please use the QR code posted in your room or the link in your booking email.",
    "未找到该设施。请使用房间内张贴的二维码或预订邮件中的链接访问。",
    "시설을 찾을 수 없습니다. 객실에 게시된 QR 코드 또는 예약 안내 메일의 링크로 접속해 주세요.",
    "ไม่พบที่พัก กรุณาใช้ QR Code ที่ติดไว้ในห้องพัก หรือลิงก์ในอีเมลยืนยันการจอง",
    "Không tìm thấy cơ sở. Vui lòng dùng mã QR dán trong phòng hoặc liên kết trong email đặt phòng."
  ),
};
