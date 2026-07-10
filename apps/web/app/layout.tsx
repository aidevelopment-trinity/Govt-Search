import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gov Contract Finder",
  description: "Federated government contract source search for leadership and management training.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
