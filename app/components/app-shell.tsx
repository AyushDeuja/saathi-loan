"use client";

import type { PropsWithChildren } from "react";
import { Navbar } from "./navbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-[920px] px-6 pb-20 pt-8">
        {children}
      </main>
    </div>
  );
}
