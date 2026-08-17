import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liro",
  description: "Învățarea limbii române pentru vorbitori de rusă",
};

/**
 * Limba documentului se stabilește în layout-urile de rol: profesorul lucrează
 * în română, cursantul în rusă. Aici punem valoarea neutră.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
