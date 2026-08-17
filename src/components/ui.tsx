import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Componente de bază, partajate între spațiul profesorului și cel al
 * cursantului. Deliberat puține și fără variante exotice: consecvența
 * vizuală contează mai mult decât flexibilitatea, iar fiecare variantă în plus
 * e o decizie pe care cineva o poate lua greșit mai târziu.
 */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag className={cx("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </Tag>
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
};

/** Ținta tactilă minimă e 44px — cursantul lucrează de pe telefon (brief §7). */
const sizes = { md: "min-h-11 px-4 text-sm", lg: "min-h-13 px-6 text-base" };
const variants = {
  primary: "bg-accent text-white shadow-card hover:bg-accent-hover active:translate-y-px",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-sunken text-ink-soft ring-line",
    success: "bg-success-soft text-success ring-success/20",
    warning: "bg-warning-soft text-warning ring-warning/25",
    danger: "bg-danger-soft text-danger ring-danger/20",
    accent: "bg-accent-soft text-accent ring-accent/20",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * Inițialele cursantului. Într-o listă de nume scrise cu chirilice, un reper
 * vizual stabil ajută profesorul să găsească persoana din privire, nu prin
 * citire — și evită să cerem fotografii pe care nu le avem.
 */
export function Avatar({ name, className }: { name: string | null; className?: string }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent ring-1 ring-inset ring-accent-line",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Inel de progres. Într-o listă, un cerc se compară mult mai ușor între rânduri
 * decât o bară lungă sau un procent scris.
 */
export function ProgressRing({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max > 0 ? value / max : 0;
  const r = 14;
  const c = 2 * Math.PI * r;

  return (
    <span
      role="img"
      aria-label={`${label}: ${value} din ${max}`}
      className="relative inline-flex size-9 items-center justify-center"
    >
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-sunken" />
        {/* La zero nu desenăm arcul: `strokeLinecap="round"` ar lăsa un punct
            care arată ca un artefact, nu ca „încă nimic rezolvat". */}
        {pct > 0 ? (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className="stroke-accent"
          />
        ) : null}
      </svg>
      <span className="absolute text-[0.6875rem] font-semibold tabular-nums text-ink-soft">
        {value}
      </span>
    </span>
  );
}

export function PageHeading({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Titlu de secțiune cu icon — dă listelor un punct de ancorare vizual. */
export function SectionHeading({
  id,
  icon,
  children,
  aside,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="text-ink-faint">{icon}</span>
      <h2 id={id} className="text-base font-semibold">
        {children}
      </h2>
      {aside ? <span className="ml-auto">{aside}</span> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-line-strong bg-surface/60 px-5 py-10 text-center text-ink-soft">
      {children}
    </p>
  );
}
