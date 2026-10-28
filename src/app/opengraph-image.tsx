import { ImageResponse } from "next/og";

export const alt = "Medoras: Connect. Learn. Grow. Belong.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f8f6f0",
        padding: 80,
        color: "#17414a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "#1f5560",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e6f6f6",
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          M
        </div>
        <div style={{ fontSize: 48, fontWeight: 600 }}>Medoras</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 600 }}>
          Your Community. Your Career. Your Journey.
        </div>
        <div style={{ fontSize: 34, color: "#4b6a70" }}>
          Connect. Learn. Grow. Belong.
        </div>
      </div>
    </div>,
    size,
  );
}
