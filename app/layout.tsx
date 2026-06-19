import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EnviroSense AI",
  description: "NGO dashboard for Sindh flood risk, water quality, and public reports"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
