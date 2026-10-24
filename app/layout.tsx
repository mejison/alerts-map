import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ВАРТА — карта тривог України",
  description: "Повітряні тривоги та публічні повідомлення про повітряні загрози на інтерактивній карті України. Оновлення в реальному часі.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ВАРТА' },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#17191f', colorScheme: 'dark' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className="antialiased">{children}</body>
    </html>
  );
}
