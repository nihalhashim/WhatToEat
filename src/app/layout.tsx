import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "WhatToEat",
  description: "Your food companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#fcfcfc]">
        {/* Full-width Top Header */}
        <header className="fixed top-0 left-0 right-0 h-[64px] border-b border-gray-100 bg-white flex items-center justify-between px-8 z-50 shrink-0">
          <div className="w-1/2 flex items-center h-full">
            <Link href="/" className="font-black text-2xl tracking-tight flex items-center gap-3 h-full group">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-[var(--color-qb-green)] group-hover:scale-105 transition-transform">
                {/* Map Pin Container */}
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                {/* Solid Geometric Fork & Knife perfectly scaled and centered inside the pin head */}
                <g transform="translate(12.1, 10.5) scale(0.55) translate(-12, -12)" fill="currentColor" stroke="none">
                  {/* Fork */}
                  <path d="M2 2v8c0 3 1 4 3 4v8h2v-8c2 0 3-1 3-4V2h-2v6H7V2H5v6H4V2Z" />
                  {/* Knife */}
                  <path d="M22 22h-4v-8h-4v-5c0-4 3-7 8-7z" />
                </g>
              </svg>
              <span className="text-gray-900">WhatToEat</span>
            </Link>
          </div>

          <div className="w-1/2 flex justify-end">
            <span id="current-tool-title" className="font-bold text-gray-800 text-sm opacity-50"></span>
          </div>
        </header>

        <Sidebar />

        <div className="pt-[64px] pl-[72px] flex flex-col min-h-screen">
          <main className="flex-1 p-4 md:p-12">
            <div className="max-w-4xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
