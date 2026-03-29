'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const tools = [
    {
      name: "Menu",
      href: "/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      )
    },
    {
      name: "Eat",
      href: "/what-to-eat",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      )
    },
    {
      name: "Route",
      href: "/route",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      )
    }
  ];

  return (
    <aside className="fixed left-0 top-[64px] bottom-0 w-[72px] bg-white border-r border-[#e3e3e3] flex flex-col items-center pt-0 pb-4 z-40">
      <nav className="flex-1 w-full space-y-1 mt-0">
        {tools.map((tool) => {
          const isActive = pathname === tool.href;

          return (
            <Link
              key={tool.name}
              href={tool.href}
              className={`flex flex-col items-center justify-center w-full py-4 px-1 transition-all group relative ${isActive
                  ? 'text-[var(--color-qb-green)]'
                  : 'text-gray-400 hover:text-[var(--color-qb-text)]'
                }`}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-[var(--color-qb-green)] rounded-r-full" />
              )}
              <div className={`mb-1 transition-transform group-hover:scale-110 ${isActive ? 'text-[var(--color-qb-green)]' : 'text-gray-400'}`}>
                {tool.icon}
              </div>
              <span className={`text-[10px] font-bold text-center leading-none ${isActive ? 'text-[var(--color-qb-green)]' : 'text-gray-500'}`}>
                {tool.name}
              </span>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
