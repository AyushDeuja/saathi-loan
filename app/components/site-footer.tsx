import Link from "next/link";

const FOOTER_LINKS = [
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Documentation" },
  { href: "#", label: "Community" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/80 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Saathi Loan
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            © {year} Saathi Loan. On-chain Lending.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
