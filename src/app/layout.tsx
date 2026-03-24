import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Work Monster",
  description: "Motivation-based productivity game with rewards, streaks, and recoverable Risk Zone."
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
