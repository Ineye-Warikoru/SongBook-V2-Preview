import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Songbook — kasg.co.uk",
  description: "Store, organise and transpose the Broadfield Christian Fellowship song library.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef2f8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body className="antialiased">{children}</body>
    </html>
  );
}
