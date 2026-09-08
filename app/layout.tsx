import type { Metadata } from "next";
import "./globals.css";
import { StatusProvider } from "@/components/lib/status-context";

export const metadata: Metadata = {
  title: "WINAPI//CORE — Windows API Intelligence Explorer",
  description:
    "Searchable, analyst-oriented reference for Windows APIs: attack categorization, MITRE ATT&CK mapping, native syscall tables, and documentation links.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-grid">
        <StatusProvider>{children}</StatusProvider>
      </body>
    </html>
  );
}