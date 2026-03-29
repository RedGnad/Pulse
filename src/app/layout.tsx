import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { FloatingChat } from "@/components/floating-chat";
import "./globals.css";

const syne = localFont({
  src: "../fonts/Syne-Variable.woff2",
  variable: "--font-chakra",
  display: "swap",
});

const dmMono = localFont({
  src: [
    { path: "../fonts/DMMono-Regular.woff2", weight: "400" },
    { path: "../fonts/DMMono-Medium.woff2", weight: "500" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Initia Pulse — On-Chain Intelligence",
  description:
    "An AI that watches the entire Initia ecosystem and writes its analysis immutably on-chain. On-chain intelligence oracle + AI advisor for the Interwoven Network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${dmMono.variable} antialiased min-h-screen`}
      >
        <div className="noise-overlay" />
        <Providers>
          <Header />
          {children}
          <FloatingChat />
        </Providers>
      </body>
    </html>
  );
}
