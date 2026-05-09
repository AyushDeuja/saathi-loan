"use client";

import type { PropsWithChildren } from "react";
import { Navbar } from "./navbar";
import { SiteFooter } from "./site-footer";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-6 md:pb-24 md:pt-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
