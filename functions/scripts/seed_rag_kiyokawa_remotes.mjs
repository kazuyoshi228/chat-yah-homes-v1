/**
 * seed_rag_kiyokawa_remotes.mjs — 清川 リモコン対訳RAG（2026-09-07）
 *
 * 出典: docs/rag_sources/kiyokawa_remotes.md（実機写真から作成・訳語は独立審査済み）。
 * 方針: seed_rag_kiyokawa.mjs と同じ——固定ID upsert・onRagDocumentWritten が自動Embedding。
 *       エアコン対訳と同型（リモコンが日本語表記のため対訳が価値）。温度の推奨値・Wi-Fi・暗証番号は書かない。
 *
 * 使い方（functions ディレクトリで）:
 *   下見:  node scripts/seed_rag_kiyokawa_remotes.mjs
 *   投入:  node scripts/seed_rag_kiyokawa_remotes.mjs --write
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
    id: "rag-kiyokawa-howto-bath-remote",
    facilityId: "kiyokawa",
    category: "howto",
    title: "お風呂の入れ方・給湯リモコンの使い方（Rinnai BC-155V/MC-155V）",
    content: `# Hot water & bath remote (Rinnai BC-155V in bathroom / MC-155V in hallway)

## 日本語
お風呂を入れる: リモコンの「自動」ボタンを1回押すだけ。設定の温度と湯量まで自動でお湯が入り、そのあと保温されます。
運転（電源）: 緑のランプが点いていれば入っています。消えていたら「運転」を押してください。
おいだき: 冷めたお湯を温め直します。／たし湯: 熱いお湯を足す。たし水: 水を足してぬるくする。
温度: 「給湯 ▲▼」はシャワー・蛇口のお湯の温度、「ふろ ▲▼」は浴槽の温度です。
優先: オレンジのランプが点いているリモコンが温度を決めます（浴室で温度を変えたいときに押す）。
注意: シャワー・入浴の際は、お湯の温度を確かめてからご使用ください。故障のときは予約経路のメッセージでご連絡ください。

## English
To fill the bathtub: just press the AUTO button (自動) once. The tub fills to the set temperature and level automatically, then stays warm.
Power (運転): the green light means it is on. If it is off, press the power button.
Reheat (おいだき): reheats the water in the tub. / Add hot water (たし湯) makes it hotter; Add cold water (たし水) cools it down.
Temperature: "給湯 ▲▼" sets shower/tap hot water; "ふろ ▲▼" sets the bathtub temperature.
Priority (優先): the remote with the orange light controls the temperature — press it in the bathroom to adjust there.
Please check the water temperature before showering or entering the bath. If something seems broken, message us via your booking platform.

## 中文
放洗澡水：按一次「自動」（自动注水）按钮即可。浴缸会自动注满设定温度和水量的热水，之后自动保温。
电源（運転）：绿灯亮表示已开机；如果熄灭，请按电源按钮。
再加热（おいだき）：重新加热变凉的洗澡水。／添热水（たし湯）：加热水；添冷水（たし水）：加冷水调温。
温度：「給湯 ▲▼」调淋浴和水龙头的热水温度，「ふろ ▲▼」调浴缸水温。
优先（優先）：橙灯亮的遥控器拥有温度控制权（在浴室调温时按它）。
淋浴或入浴前，请先确认水温。如设备故障，请通过预订平台的消息联系我们。

## 한국어
욕조에 물 받기: 리모컨의 「自動」(자동 물받기) 버튼을 한 번만 누르세요. 설정된 온도와 수위까지 자동으로 물을 받고, 그 후 보온됩니다.
전원(運転): 초록 불이 켜져 있으면 켜진 상태입니다. 꺼져 있으면 전원 버튼을 누르세요.
재가열(おいだき): 식은 물을 다시 데웁니다. / 온수 추가(たし湯)·냉수 추가(たし水)로 온도를 조절할 수 있습니다.
온도: 「給湯 ▲▼」는 샤워·수도 온수 온도, 「ふろ ▲▼」는 욕조 온도입니다.
우선(優先): 주황 불이 켜진 리모컨이 온도를 결정합니다(욕실에서 조절하려면 누르세요).
샤워하거나 욕조에 들어가기 전에 물 온도를 꼭 확인해 주세요. 고장 시 예약 플랫폼 메시지로 연락해 주세요.`,
  },
  {
    id: "rag-kiyokawa-howto-bath-dryer",
    facilityId: "kiyokawa",
    category: "howto",
    title: "浴室乾燥機の使い方・24時間換気は止めない（MAX DRYFAN UFD-112A）",
    content: `# Bathroom dryer / ventilation (MAX DRYFAN UFD-112A)

## 日本語
緑のランプ（24時間換気）は正常です。結露とカビを防ぐため常時運転しています——停止しないでください（音は小さな換気音です）。
洗濯物を乾かす: 「乾燥」を押し、タイマー（0.5〜8時間）で時間を設定します。
「停止」ボタンは暖房・乾燥・涼風を止めるためのものです。24時間換気の長押し停止はしないでください。
そのほか: 暖房=入浴前に浴室を暖める／涼風=送風／換気=換気の強運転。

## English
The green light (24-hour ventilation) is normal. It runs all the time to prevent condensation and mold — please do not turn it off (the faint fan noise is normal).
To dry laundry: press 乾燥 (Dry), then set the hours with the timer (0.5–8 h).
The 停止 (Stop) button stops heater / dry / cool-air modes. Please do not long-press to stop the 24-hour ventilation.
Others: 暖房 = warms the bathroom before bathing / 涼風 = cool air fan / 換気 = stronger ventilation.

## 中文
绿灯（24小时换气）亮属于正常。为防止结露和霉菌，它全天运行——请不要关闭（轻微的风扇声属正常）。
烘干衣物：按「乾燥」（干燥），再用定时（0.5〜8小时）设定时间。
「停止」按钮用于停止暖房・干燥・凉风模式。请不要长按停止24小时换气。
其他：暖房＝入浴前预热浴室／涼風＝凉风／換気＝加强换气。

## 한국어
초록 불(24시간 환기)은 정상입니다. 결로와 곰팡이를 막기 위해 항상 작동합니다 — 끄지 말아 주세요(작은 팬 소리는 정상입니다).
빨래 건조: 「乾燥」(건조)를 누르고 타이머(0.5〜8시간)로 시간을 설정하세요.
「停止」(정지) 버튼은 난방·건조·냉풍을 멈춥니다. 24시간 환기를 길게 눌러 끄지 말아 주세요.
기타: 暖房=입욕 전 욕실 데우기 / 涼風=냉풍 / 換気=환기 강운전.`,
  },
];

const main = async () => {
  for (const d of DOCS) {
    const ref = chat.collection(COL).doc(d.id);
    const payload = {
      facilityId: d.facilityId, category: d.category, title: d.title, content: d.content,
      isActive: true, source: "docs/rag_sources/kiyokawa_remotes.md（2026-09-07・実機写真より）",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (WRITE) { await ref.set(payload, { merge: true }); console.log("WROTE", d.id); }
    else console.log("DRY", d.id, d.title, `${d.content.length}字`);
  }
  console.log(WRITE ? "done" : "dry-run（--write で投入）");
};
main();
