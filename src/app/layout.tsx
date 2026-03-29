import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "WhatToEat",
  description: "Your Wha tToEat food companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#fcfcfc] flex flex-col pt-[64px]">
        {/* Full-width Top Header */}
        <header className="fixed top-0 left-0 right-0 h-[64px] border-b border-gray-100 bg-white flex items-center justify-between px-8 z-50 shrink-0">
           <div className="w-1/2 flex items-center h-full">
                 <Link href="/" className="text-[var(--color-qb-green)] font-black text-2xl tracking-tight flex items-center gap-3 h-full">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                     {/* Clean Outline Teardrop Pin */}
                     <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeWidth="2.5" />
                     {/* Fork Outer Tines & Bowl */}
                     <path d="M9 6v3c0 1.7 1.3 3 3 3s3-1.3 3-3V6" strokeWidth="2" />
                     {/* Fork Middle Tine & Handle */}
                     <path d="M12 6v10" strokeWidth="2" />
                   </svg>
                   WhatToEat
                 </Link>
               </div>
               
               <div className="w-1/2 flex justify-end">
                 <span id="current-tool-title" className="font-bold text-gray-800 text-sm opacity-50"></span>
               </div>
            </header>

        <div className="flex w-full flex-1 overflow-hidden">
          <Sidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-y-auto p-4 md:p-12">
              <div className="max-w-4xl mx-auto w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
