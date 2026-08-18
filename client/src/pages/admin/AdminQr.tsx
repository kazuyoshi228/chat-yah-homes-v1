/**
 * AdminQr — 施設別QRコード（表示・ダウンロード）
 *
 * 公開中の施設（chat_facilities.isActive !== false）ぶんのQRを
 * クライアント側で自動生成（誤り訂正H・1024px）。施設を公開すれば自動で増える。
 * kiyokawa には印刷用A6カード（ベクターSVG）も同梱（client/public/qr/）。
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useCollection } from "@/hooks/useFirestoreAdmin";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

const BASE_URL = "https://chat.yah.homes";

/** 施設ごとの静的な印刷カード（存在するものだけボタン表示） */
const PRINT_CARDS: Record<string, { svg: string; png: string }> = {
  kiyokawa: {
    svg: "/qr/qr_kiyokawa_card_a6.svg",
    png: "/qr/qr_kiyokawa_card_a6.png",
  },
};

interface FacilityRow {
  id: string;
  name?: Record<string, string> | string;
  isActive?: boolean;
}

function displayName(name: FacilityRow["name"], id: string): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") return name.ja ?? name.en ?? id;
  return id;
}

export default function AdminQr() {
  const { docs, loading } = useCollection("chat_facilities", []);
  const facilities = (docs as unknown as FacilityRow[]).filter(
    (f) => f.isActive !== false
  );
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const f of facilities) {
        const url = `${BASE_URL}/${f.id}`;
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "H",
          width: 1024,
          margin: 4,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        entries.push([f.id, dataUrl]);
      }
      if (!cancelled) setQrMap(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // facilities は毎レンダーで新配列になるため id 列で依存させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities.map((f) => f.id).join(",")]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QRコード</h1>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {facilities.map((f) => {
              const url = `${BASE_URL}/${f.id}`;
              const dataUrl = qrMap[f.id];
              const card = PRINT_CARDS[f.id];
              return (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {displayName(f.name, f.id)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {f.id}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dataUrl ? (
                      <img
                        src={dataUrl}
                        alt={`QR: ${url}`}
                        className="w-56 h-56 border rounded-lg"
                      />
                    ) : (
                      <div className="w-56 h-56 border rounded-lg animate-pulse bg-gray-50" />
                    )}
                    <p className="text-xs font-mono">{url}</p>
                    <div className="flex flex-wrap gap-2">
                      {dataUrl && (
                        <a href={dataUrl} download={`qr_${f.id}.png`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            QR PNG
                          </Button>
                        </a>
                      )}
                      {card && (
                        <>
                          <a href={card.svg} download={`qr_${f.id}_card_a6.svg`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              A6カード SVG（印刷推奨）
                            </Button>
                          </a>
                          <a href={card.png} download={`qr_${f.id}_card_a6.png`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              A6カード PNG
                            </Button>
                          </a>
                        </>
                      )}
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          開く
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
