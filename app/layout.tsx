import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetGram",
  description: "Scoped read-only AI access to selected Telegram chats",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
