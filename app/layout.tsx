import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./parity.css";
import { PwaRegister } from "./PwaRegister";

export const metadata: Metadata = {
  title: "Vocab",
  description: "簡潔、離線可用的英文單字學習工具",
  applicationName: "Vocab",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vocab",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "Vocab",
    description: "每天一點，記得更久",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vocab－每天一點，記得更久" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vocab",
    description: "每天一點，記得更久",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F7F9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
