import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/services";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const settings = await getSiteSettings();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111111",
        }}
      >
        <div
          style={{
            fontSize: 108,
            letterSpacing: 12,
            color: "#ffffff",
            fontWeight: 600,
          }}
        >
          {settings.siteName}
        </div>
        <div style={{ fontSize: 28, color: "#f5f5f5", marginTop: 24, letterSpacing: 2 }}>
          {settings.tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
