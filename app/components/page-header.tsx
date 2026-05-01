type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  accent?: string;
  description?: string;
};

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
}: PageHeaderProps) {
  return (
    <header className="mb-8 md:mb-10">
      {eyebrow ? (
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      {accent ? (
        <p className="mt-2 font-serif text-xl font-semibold italic text-primary md:text-2xl">
          {accent}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
