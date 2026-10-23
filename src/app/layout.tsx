import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07090e",
};

export const metadata: Metadata = {
  title: "Finanzas Hogar",
  description: "Fondo Común e Inversión Conjunta (FCI) para Parejas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hogar",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

import { AppUpdateChecker } from "@/components/AppUpdateChecker";
import { DeviceProvider } from "@/lib/use-device";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className="h-full antialiased dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon.png" />
        <link rel="preload" href="/icon-192.png" as="image" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Hogar" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="min-h-full bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white"
        suppressHydrationWarning
      >
        <DeviceProvider>
          <AppUpdateChecker />
          {children}
        </DeviceProvider>
      </body>
    </html>
  );
}
