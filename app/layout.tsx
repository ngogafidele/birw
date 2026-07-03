// Defines root metadata and document structure for the inventory application.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIRW Inventory",
  description: "BIRW inventory management for one store",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
