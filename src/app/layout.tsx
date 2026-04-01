import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Degen Vibe Check",
  description: "Fast token health dashboard for liquidity, contract risk, and hype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="app-banner" aria-hidden="true">
          <div className="app-banner-base" />
          <div className="app-banner-aurora" />
          <div className="app-banner-grid" />
          <div className="app-banner-glow app-banner-glow-main" />
          <div className="app-banner-glow app-banner-glow-left" />
          <div className="app-banner-glow app-banner-glow-right" />
          <div className="app-banner-fade" />
        </div>
        {children}
      </body>
    </html>
  );
}
