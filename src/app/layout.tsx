import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Logo } from "./logo";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Settle",
  description: "One structured invoice that fixes cost coding for buyers and card fees for suppliers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <header className="bg-ink text-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" aria-label="Settle home"><Logo /></Link>
            <Link href="/invoices" className="text-white/70 hover:text-white">Buyer · invoices</Link>
            <Link href="/supplier" className="text-white/70 hover:text-white">Supplier · card policy</Link>
            <Link href="/invoice/INV-1042" className="ml-auto rounded-full bg-lime px-3 py-1 font-medium text-ink hover:brightness-95">Try the demo</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
