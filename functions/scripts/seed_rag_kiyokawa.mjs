/**
 * seed_rag_kiyokawa.mjs — kiyokawa 初期RAG投入（検証済み知識のみ・2026-08-17）
 *
 * 出典: 利用規約(yah.homes/legal/terms 2026-08-14施行)・admin/properties(property_facts)・
 *       オーナーヒアリング回答・掲示物データ（docs/rag_sources/ 参照）。
 * 方針:
 *  - 事実が確定しているものだけを書く（数値系は property_facts のライブ注入が正本のため書かない）
 *  - 各文書は6言語併記（L1ドラフトと同形式。Embedding入力上限8000字未満に収める）
 *  - 🚫 鍵・玄関・キーボックスの暗証番号は絶対に書かない（Wi-Fiは方針転換によりマスタ注入側で案内）
 *  - 固定ID upsert（再実行は上書き）。書き込み後 onRagDocumentWritten が自動Embedding
 *
 * 使い方（functions ディレクトリで）:
 *   下見:  node scripts/seed_rag_kiyokawa.mjs
 *   投入:  node scripts/seed_rag_kiyokawa.mjs --write
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "yah-homes";
const WRITE = process.argv.includes("--write");
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const chat = getFirestore(app, "chat");
const COL = "chat_rag_documents";

const DOCS = [
  {
    id: "rag-common-rules-cancellation",
    facilityId: "common",
    category: "rules",
    title: "ハウスルールとキャンセルポリシー（規約準拠・全施設共通）",
    content: `# House Rules & Cancellation Policy (from Terms of Accommodation, effective 2026-08-14)

## 日本語
ハウスルール: パーティー・イベント・撮影目的の利用禁止／宿泊は申告した人数のみ（超過は追加請求）／屋内は全面禁煙（施設として喫煙場所の提供はありません）／玄関に屋外防犯カメラあり・屋内にカメラはありません／住宅地のため夜22時以降は話し声・音楽・屋外行動に配慮／ペット不可／火気・暖房器具の無人使用禁止／鍵の暗証番号は同行者以外に開示しない。
キャンセル（公式サイト予約）: チェックイン8日前の23:59（日本時間）まで無料。以降とノーショーは全額かかり返金なし。返金はカードへ（反映まで数日〜1ヶ月）。日程・人数・棟の変更は「キャンセル＋再予約」扱い。※Booking.com・Airbnb等の予約は各サイトの規約が適用されます（このルールは適用外）。
宿泊者名簿: 法令により全宿泊者の情報をチェックイン2日前までに提出必須。未提出の場合、入室用の暗証番号はお渡しできません。
決済（公式予約）: クレジットカードのみ・予約時全額前払い・清掃料と福岡市宿泊税込み。

## English
House rules: No parties, events, or photo shoots. Only registered guests may stay (extra guests incur charges). Strictly non-smoking indoors; the property provides no smoking area. An outdoor security camera is at the entrance; there are no cameras indoors. Residential area — please keep quiet after 10 PM. No pets. Do not leave open flames or heaters unattended. Never share the door code with anyone outside your party.
Cancellation (official-site bookings): Free until 8 days before check-in, 23:59 JST. After that, and for no-shows, the full amount is charged with no refund. Refunds go to your card (may take days to a month). Date/guest/property changes are handled as cancel + rebook. Note: bookings via Booking.com, Airbnb, etc. follow that platform's own policy instead.
Guest registry: By law, details for ALL guests must be submitted no later than 2 days before check-in. Without it, the entry door code cannot be issued.
Payment (official bookings): credit card only, full prepayment, cleaning fee and Fukuoka city accommodation tax included.

## 中文
入住规则：禁止派对、活动、拍摄；仅限申报人数入住（超员将加收费用）；室内全面禁烟（本设施不设吸烟区）；玄关设有室外监控摄像头，室内无摄像头；住宅区，晚上10点后请保持安静；不可携带宠物；请勿在无人看管时使用明火或取暖设备；门锁密码请勿告知同行者以外的任何人。
取消（官网预订）：入住前8天23:59（日本时间）前可免费取消；之后及未入住（No-show）收取全额且不退款。改期/改人数/换房源需先取消再重新预订。※通过Booking.com、Airbnb等预订的，适用该平台自身的取消政策。
住宿者名单：依法须在入住前2天提交所有住客信息，未提交则无法发放入室密码。

## 한국어
하우스룰: 파티·이벤트·촬영 목적 이용 금지／신고한 인원만 숙박 가능(초과 시 추가 요금)／실내 전면 금연(흡연 구역 없음)／현관에 실외 방범 카메라 있음·실내 카메라 없음／주택가이므로 밤 10시 이후 정숙／반려동물 불가／화기·난방기구 무인 사용 금지／도어 비밀번호는 일행 외 공유 금지.
취소(공식 사이트 예약): 체크인 8일 전 23:59(일본 시간)까지 무료. 이후 및 노쇼는 전액 청구·환불 불가. 날짜/인원/숙소 변경은 취소 후 재예약. ※Booking.com·Airbnb 등 예약은 해당 플랫폼 규정이 적용됩니다.
숙박자 명부: 법령에 따라 체크인 2일 전까지 전원 정보 제출 필수. 미제출 시 출입 비밀번호를 드릴 수 없습니다.

## ไทย
กฎที่พัก: ห้ามจัดปาร์ตี้/อีเวนต์/ถ่ายทำ ห้ามพักเกินจำนวนที่แจ้ง (เกินมีค่าใช้จ่ายเพิ่ม) ห้ามสูบบุหรี่ในอาคารโดยเด็ดขาด (ไม่มีจุดสูบบุหรี่) มีกล้องวงจรปิดด้านนอกที่ทางเข้า ไม่มีกล้องภายใน หลัง 4 ทุ่มโปรดเงียบ ห้ามนำสัตว์เลี้ยง ห้ามใช้ไฟ/เครื่องทำความร้อนโดยไม่มีคนดูแล ห้ามบอกรหัสประตูแก่บุคคลภายนอก
การยกเลิก (จองผ่านเว็บทางการ): ฟรีถึง 8 วันก่อนเช็คอิน 23:59 (เวลาญี่ปุ่น) หลังจากนั้นและ no-show เก็บเต็มจำนวน ไม่คืนเงิน ※จองผ่าน Booking.com/Airbnb ใช้นโยบายของแพลตฟอร์มนั้น
ทะเบียนผู้เข้าพัก: ต้องส่งข้อมูลผู้เข้าพักทุกคนภายใน 2 วันก่อนเช็คอิน มิฉะนั้นจะไม่ได้รับรหัสเข้าประตู

## Tiếng Việt
Nội quy: Cấm tiệc tùng/sự kiện/quay chụp; chỉ đúng số khách đã khai (vượt sẽ tính phí); cấm hút thuốc trong nhà (không có khu hút thuốc); có camera an ninh ngoài cửa, trong nhà không có camera; sau 22h giữ yên tĩnh; không thú cưng; không dùng lửa/thiết bị sưởi khi không có người; không tiết lộ mã cửa cho người ngoài.
Hủy phòng (đặt qua trang chính thức): Miễn phí đến 23:59 (giờ Nhật) 8 ngày trước check-in; sau đó và no-show thu toàn bộ, không hoàn. ※Đặt qua Booking.com/Airbnb áp dụng chính sách của nền tảng đó.
Danh sách khách: Theo luật, phải nộp thông tin toàn bộ khách trước check-in 2 ngày; nếu không sẽ không được cấp mã cửa.`,
  },
  {
    id: "rag-kiyokawa-checkin-access",
    facilityId: "kiyokawa",
    category: "checkin",
    title: "チェックイン・入室ガイド（kiyokawa）",
    content: `# Check-in & Entry Guide — yah.kiyokawa

## 日本語
無人運営です（現地にスタッフは常駐しません）。入室は玄関のキーボックスの暗証番号で行います。番号は宿泊ごとに変更され、宿泊者名簿の提出完了後にご予約経路のメッセージ／チェックイン案内でお届けします（チャットではお伝えできません）。
チェックイン16:00〜／チェックアウト10:00。アーリーチェックイン・レイトチェックアウトは不可。チェックイン前・チェックアウト後の荷物預かりも不可です。
「入室コードが届かない」場合の確認順: ①宿泊者名簿を提出済みか（チェックイン2日前まで・未提出だと発行されません）②予約サイトのメッセージ／メールを確認 ③解決しなければ緊急連絡先 050-1721-4419（宿泊中・到着時のお客様専用）へ。
住所: 〒810-0005 福岡県福岡市中央区清川3-3-1（3階建て。各階に避難経路図を掲示）。

## English
This property is self-check-in with no on-site staff. Entry is via a key box at the entrance using a door code. The code changes every stay and is sent via your booking platform's messages / check-in instructions AFTER the guest registry is submitted (this chat cannot provide door codes).
Check-in from 16:00 / check-out by 10:00. Early check-in and late check-out are NOT available. Luggage storage before check-in or after check-out is NOT available.
If your entry code hasn't arrived: 1) Confirm you submitted the guest registry (due 2 days before check-in — the code is not issued without it). 2) Check your booking platform's messages/email. 3) Still stuck? Call the emergency line 050-1721-4419 (for arriving/staying guests).
Address: 3-3-1 Kiyokawa, Chuo-ku, Fukuoka 810-0005 (3-story building; emergency exit maps on each floor).

## 中文
本设施为无人运营（现场无常驻工作人员）。通过玄关钥匙盒的密码入室；密码每次住宿都会更换，并在提交住宿者名单后通过预订平台消息/入住指南发送（本聊天无法告知密码）。
入住16:00起／退房10:00前。不可提前入住、不可延迟退房、不可寄存行李。
未收到入室密码时：①确认已提交住宿者名单（入住前2天截止，未提交不发放）②查看预订平台消息/邮件 ③仍未解决请致电紧急联系电话 050-1721-4419。
地址：福冈市中央区清川3-3-1（3层建筑，每层有逃生路线图）。

## 한국어
무인 운영 시설입니다(현장 상주 직원 없음). 현관 키박스의 비밀번호로 입실합니다. 번호는 숙박마다 변경되며, 숙박자 명부 제출 완료 후 예약 플랫폼 메시지/체크인 안내로 전달됩니다(채팅으로는 알려드릴 수 없습니다).
체크인 16:00〜／체크아웃 10:00. 얼리 체크인·레이트 체크아웃 불가. 짐 보관 불가.
입실 코드가 안 왔다면: ①명부 제출 여부 확인(체크인 2일 전까지) ②예약 플랫폼 메시지/메일 확인 ③해결 안 되면 긴급 연락처 050-1721-4419.
주소: 후쿠오카시 주오구 기요카와 3-3-1(3층 건물, 각 층에 대피 경로도).

## ไทย
ที่พักแบบเช็คอินด้วยตนเอง (ไม่มีพนักงานประจำ) เข้าห้องด้วยรหัสจากกล่องกุญแจหน้าประตู รหัสเปลี่ยนทุกการเข้าพัก และจะส่งให้ทางข้อความของแพลตฟอร์มจอง/คู่มือเช็คอิน หลังจากส่งทะเบียนผู้เข้าพักแล้ว (แชทนี้บอกรหัสไม่ได้)
เช็คอิน 16:00 / เช็คเอาท์ 10:00 ไม่มีเช็คอินก่อนเวลา เช็คเอาท์สาย หรือฝากสัมภาระ
ถ้ายังไม่ได้รหัส: 1) ตรวจว่าส่งทะเบียนผู้เข้าพักแล้ว (ภายใน 2 วันก่อนเช็คอิน) 2) ดูข้อความ/อีเมลจากแพลตฟอร์ม 3) โทร 050-1721-4419
ที่อยู่: 3-3-1 Kiyokawa, Chuo-ku, Fukuoka (อาคาร 3 ชั้น มีแผนผังทางหนีไฟทุกชั้น)

## Tiếng Việt
Cơ sở tự nhận phòng (không có nhân viên tại chỗ). Vào nhà bằng mã số của hộp chìa khóa ở cửa; mã đổi mỗi kỳ lưu trú và được gửi qua tin nhắn nền tảng đặt phòng/hướng dẫn check-in SAU khi nộp danh sách khách (chat này không thể cung cấp mã).
Check-in từ 16:00 / check-out trước 10:00. Không nhận phòng sớm, trả phòng muộn hay giữ hành lý.
Chưa nhận được mã: 1) Kiểm tra đã nộp danh sách khách chưa (hạn 2 ngày trước check-in) 2) Xem tin nhắn/email của nền tảng 3) Gọi 050-1721-4419.
Địa chỉ: 3-3-1 Kiyokawa, Chuo-ku, Fukuoka (nhà 3 tầng, mỗi tầng có sơ đồ thoát hiểm).`,
  },
  {
    id: "rag-kiyokawa-facilities",
    facilityId: "kiyokawa",
    category: "facilities",
    title: "設備・アメニティガイド（kiyokawa）",
    content: `# Facilities & Amenities — yah.kiyokawa

## 日本語
キッチンあり（調理器具・電子レンジ完備）。テレビは Google TV（55インチ・Netflix等のアプリ利用可、ご自身のアカウントでログイン）。衣類乾燥機あり。アメニティ（タオル・歯ブラシ・シャンプー等）は洗面台に設置。タオル・寝具はご申告の人数分のみ・布団やベッドの追加は不可。浴槽あり。
Wi-Fi は無料。SSID とパスワードは LDK 中央のコンソールの上に掲示しています（このチャットでもご案内できます）。
エアコンのリモコンは日本語表記です。主なボタン: 運転/停止＝電源、冷房＝Cooling、暖房＝Heating、除湿＝Dry、送風＝Fan、風量＝風の強さ、温度＝設定温度、運転切換＝モード切替、切タイマー＝オフタイマー。

## English
Full kitchen with cookware and a microwave. TV is a 55-inch Google TV — you can use Netflix and other apps by signing in to your own account. A clothes dryer is available. Amenities (towels, toothbrushes, shampoo, etc.) are at the washbasin. Towels/bedding are provided only for the registered number of guests; extra futons/beds are not available. There is a bathtub.
Free Wi-Fi: the SSID and password are posted on the console in the center of the living room (LDK) — this chat can also tell you.
The air-conditioner remote is labeled in Japanese. Key buttons: 運転/停止 = power on/off, 冷房 = cooling, 暖房 = heating, 除湿 = dry, 送風 = fan only, 風量 = fan speed, 温度 = temperature, 運転切換 = mode select, 切タイマー = off timer.

## 中文
配备厨房（炊具、微波炉齐全）。电视为55英寸 Google TV，可登录自己的账号使用 Netflix 等应用。有烘干机。洗漱用品（毛巾、牙刷、洗发水等）放在洗手台。毛巾和寝具仅按申报人数提供，不可加被褥或床。有浴缸。
免费Wi-Fi：SSID和密码贴在客厅（LDK）中央的置物台上（本聊天也可告知）。
空调遥控器为日文标识：運転/停止=开关、冷房=制冷、暖房=制热、除湿=除湿、送風=送风、風量=风量、温度=温度、運転切換=模式切换、切タイマー=定时关。

## 한국어
주방 있음(조리도구·전자레인지 완비). TV는 55인치 Google TV로 본인 계정으로 Netflix 등 이용 가능. 의류 건조기 있음. 어메니티(수건·칫솔·샴푸 등)는 세면대에 비치. 수건·침구는 신고 인원수만큼만 제공, 이불/침대 추가 불가. 욕조 있음.
무료 Wi-Fi: SSID와 비밀번호는 거실(LDK) 중앙 콘솔 위에 게시(채팅으로도 안내 가능).
에어컨 리모컨은 일본어 표기: 運転/停止=전원, 冷房=냉방, 暖房=난방, 除湿=제습, 送風=송풍, 風量=바람 세기, 温度=온도, 運転切換=모드 전환, 切タイマー=꺼짐 타이머.

## ไทย
มีครัวพร้อมอุปกรณ์และไมโครเวฟ ทีวี Google TV 55 นิ้ว ใช้ Netflix ฯลฯ ได้ด้วยบัญชีของคุณ มีเครื่องอบผ้า ของใช้ (ผ้าเช็ดตัว แปรงสีฟัน แชมพู) อยู่ที่อ่างล้างหน้า ผ้าและเครื่องนอนมีตามจำนวนที่แจ้งเท่านั้น เพิ่มฟูก/เตียงไม่ได้ มีอ่างอาบน้ำ
Wi-Fi ฟรี: SSID และรหัสผ่านติดไว้บนคอนโซลกลางห้องนั่งเล่น (แชทนี้บอกได้เช่นกัน)
รีโมทแอร์เป็นภาษาญี่ปุ่น: 運転/停止=เปิด/ปิด, 冷房=เย็น, 暖房=อุ่น, 除湿=ลดความชื้น, 送風=พัดลม, 風量=แรงลม, 温度=อุณหภูมิ, 運転切換=เปลี่ยนโหมด, 切タイマー=ตั้งเวลาปิด

## Tiếng Việt
Có bếp đầy đủ dụng cụ nấu và lò vi sóng. TV Google TV 55 inch — đăng nhập tài khoản của bạn để dùng Netflix v.v. Có máy sấy quần áo. Đồ dùng (khăn, bàn chải, dầu gội) đặt ở bồn rửa mặt. Khăn/chăn đệm chỉ đủ theo số khách đã khai, không thêm được nệm/giường. Có bồn tắm.
Wi-Fi miễn phí: SSID và mật khẩu dán trên kệ giữa phòng khách (chat này cũng có thể cho bạn biết).
Điều khiển máy lạnh ghi tiếng Nhật: 運転/停止=bật/tắt, 冷房=làm lạnh, 暖房=sưởi, 除湿=hút ẩm, 送風=quạt, 風量=tốc độ gió, 温度=nhiệt độ, 運転切換=đổi chế độ, 切タイマー=hẹn giờ tắt.`,
  },
  {
    id: "rag-kiyokawa-garbage-checkout",
    facilityId: "kiyokawa",
    category: "checkout",
    title: "ゴミ・喫煙・チェックアウト（kiyokawa）",
    content: `# Garbage, Smoking & Check-out — yah.kiyokawa

## 日本語
ゴミ: 分別のうえ、室内に置いたままご出発ください。屋外には出さないでください（近隣ルールのため）。
喫煙: 屋内は全面禁煙です。施設として屋外にも喫煙場所は用意していません（違反時は特別清掃費を申し受けます）。
チェックアウト: 10:00までに退室し、鍵をキーボックスへ戻してください。チェックアウトの連絡は不要です。延長・荷物預かりはできません。

## English
Garbage: Sort your trash and simply leave it INSIDE the house when you depart. Please do not take it outside (neighborhood rules).
Smoking: Strictly non-smoking indoors, and the property provides no outdoor smoking area either (violations incur a special cleaning fee).
Check-out: Leave by 10:00 and return the key to the key box. No need to notify us at check-out. Late check-out and luggage storage are not available.

## 中文
垃圾：请分类后放在室内即可离开，请勿拿到室外（社区规定）。
吸烟：室内全面禁烟，室外也不设吸烟区（违者收取特别清扫费）。
退房：10:00前离开，把钥匙放回钥匙盒即可，无需另行通知。不可延迟退房、不可寄存行李。

## 한국어
쓰레기: 분리수거 후 실내에 두고 출발하시면 됩니다. 실외로 내놓지 마세요(지역 규정).
흡연: 실내 전면 금연이며, 실외 흡연 구역도 없습니다(위반 시 특별 청소비 청구).
체크아웃: 10:00까지 퇴실 후 열쇠를 키박스에 반납하세요. 별도 연락은 불필요합니다. 연장·짐 보관 불가.

## ไทย
ขยะ: แยกขยะแล้ววางไว้ในบ้านได้เลย อย่านำออกไปข้างนอก (กฎของชุมชน)
บุหรี่: ห้ามสูบในอาคาร และไม่มีจุดสูบบุหรี่ด้านนอกด้วย (ฝ่าฝืนมีค่าทำความสะอาดพิเศษ)
เช็คเอาท์: ออกภายใน 10:00 คืนกุญแจใส่กล่อง ไม่ต้องแจ้ง ไม่มีบริการฝากสัมภาระ

## Tiếng Việt
Rác: Phân loại rồi để TRONG nhà khi rời đi, đừng mang ra ngoài (quy định khu dân cư).
Hút thuốc: Cấm hút trong nhà; ngoài trời cũng không có khu hút thuốc (vi phạm sẽ tính phí vệ sinh đặc biệt).
Trả phòng: Rời đi trước 10:00, trả chìa khóa vào hộp. Không cần báo. Không trả muộn/giữ hành lý.`,
  },
  {
    id: "rag-common-area-localguide",
    facilityId: "common",
    category: "area",
    title: "周辺案内はLocal Guideへ（全施設共通）",
    content: `# Restaurants & Things to Do — see our Local Guide

## 日本語
おすすめの飲食店・お店・観光スポットは、公式の Local Guide にまとめています。地図: https://yah.homes/locals/ ／ 記事: https://yah.homes/guides/ （日本語版は https://yah.homes/ja/ から）。個別のおすすめを聞かれたら、まず Local Guide をご案内してください。

## English
Our recommended restaurants, shops and sights are curated in the official Local Guide. Map: https://yah.homes/locals/ — Articles: https://yah.homes/guides/. When guests ask for recommendations, point them to the Local Guide first.

## 中文
推荐的餐厅、商店和景点都整理在官方 Local Guide 中。地图：https://yah.homes/locals/ ／文章：https://yah.homes/guides/（中文版从 https://yah.homes/zh/ 进入）。

## 한국어
추천 맛집·상점·관광지는 공식 Local Guide에 정리되어 있습니다. 지도: https://yah.homes/locals/ ／ 아티클: https://yah.homes/guides/ (한국어판은 https://yah.homes/ko/ 에서).

## ไทย
ร้านอาหาร ร้านค้า และที่เที่ยวแนะนำรวมอยู่ใน Local Guide ทางการ แผนที่: https://yah.homes/locals/ บทความ: https://yah.homes/guides/ (ภาษาไทยที่ https://yah.homes/th/)

## Tiếng Việt
Nhà hàng, cửa hàng và điểm tham quan gợi ý có trong Local Guide chính thức. Bản đồ: https://yah.homes/locals/ — Bài viết: https://yah.homes/guides/`,
  },
];

async function main() {
  console.log(`\n=== kiyokawa 初期RAG seed [${WRITE ? "本番書き込み" : "DRY RUN"}] ===\n`);
  for (const d of DOCS) {
    console.log(`upsert: ${d.id} [${d.facilityId}/${d.category}] ${d.title}（${d.content.length}字）`);
    if (d.content.length > 7500) console.log("  ⚠ 8000字に接近（Embedding入力上限）");
    if (WRITE) {
      await chat.collection(COL).doc(d.id).set(
        {
          title: d.title,
          content: d.content,
          category: d.category,
          facilityId: d.facilityId,
          isActive: true,
          source: "seed_verified",
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
  console.log(WRITE ? "\n✅ 完了（onRagDocumentWritten が自動でEmbedding生成）" : "\n--write で書き込みます。");
  process.exit(0);
}

main().catch((e) => { console.error("seed エラー:", e); process.exit(1); });
