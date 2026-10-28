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
        background: "#ffffff",
        padding: 80,
        color: "#2a1519",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="108" height="75" viewBox="210 243 992 688">
          <path
            fill="#7b1230"
            d="M220 253 H360 C560 253 680 380 690 548 L475 377 V636 L300 628 C250 560 225 420 220 253 Z M 1192 253 H 1052 C 852 253 732 380 722 548 L 937 377 V 636 L 1112 628 C 1162 560 1187 420 1192 253 Z M297 660 C420 660 520 680 590 740 C640 785 662 850 672 921 H590 C440 921 340 800 297 660 Z M 1115 660 C 992 660 892 680 822 740 C 772 785 750 850 740 921 H 822 C 972 921 1072 800 1115 660 Z M533 500 C600 520 660 590 703 665 C746 590 806 520 880 500 V658 C800 690 740 780 703 895 C665 780 600 700 533 658 Z"
          />
        </svg>
        <div style={{ fontSize: 48, fontWeight: 600 }}>Medoras</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 600 }}>
          Your Community. Your Career. Your Journey.
        </div>
        <div style={{ fontSize: 34, color: "#7a5a60" }}>
          Connect. Learn. Grow. Belong.
        </div>
      </div>
    </div>,
    size,
  );
}
