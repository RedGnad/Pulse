import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

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
  title: "Pulse — Initia Action Router",
  description:
    "Describe what you want to do on Initia and get routed to the right minitia instantly. Deterministic intent router + live health oracle for the Interwoven Network.",
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
        </Providers>
      </body>
    </html>
  );
}
