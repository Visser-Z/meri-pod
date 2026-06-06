import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meri AI — POD Intelligence",
  description: "Proof of delivery processing for logistics operators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
