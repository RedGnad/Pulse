import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { FloatingChat } from "@/components/floating-chat";
import "./globals.css";

const syne = Syne({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-chakra",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  subsets: ["latin"],
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
