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
    <Tag
      className={cx(
        "rounded-[--radius-card] border border-[--color-line] bg-[--color-surface] shadow-[--shadow-card]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
};

/** Ținta tactilă minimă e 44px — cursantul lucrează de pe telefon (brief §7). */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    md: "min-h-11 px-4 text-sm",
    lg: "min-h-13 px-6 text-base",
  };
  const variants = {
    primary: "bg-[--color-accent] text-white hover:bg-[--color-accent-hover]",
    secondary:
      "border border-[--color-line-strong] bg-[--color-surface] text-[--color-ink] hover:bg-[--color-sunken]",
    ghost: "text-[--color-ink-soft] hover:bg-[--color-sunken] hover:text-[--color-ink]",
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />;
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
  const sizes = { md: "min-h-11 px-4 text-sm", lg: "min-h-13 px-6 text-base" };
  const variants = {
    primary: "bg-[--color-accent] text-white hover:bg-[--color-accent-hover]",
    secondary:
      "border border-[--color-line-strong] bg-[--color-surface] text-[--color-ink] hover:bg-[--color-sunken]",
  };
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
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
    neutral: "bg-[--color-sunken] text-[--color-ink-soft]",
    success: "bg-[--color-success-soft] text-[--color-success]",
    warning: "bg-[--color-warning-soft] text-[--color-warning]",
    danger: "bg-[--color-danger-soft] text-[--color-danger]",
    accent: "bg-[--color-accent-soft] text-[--color-accent]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
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
      className="h-2 w-full overflow-hidden rounded-full bg-[--color-sunken]"
    >
      <div
        className="h-full rounded-full bg-[--color-accent] transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[--color-line] pb-5">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-[--color-ink]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[--color-ink-soft]">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[--radius-card] border border-dashed border-[--color-line-strong] px-5 py-8 text-center text-[--color-ink-soft]">
      {children}
    </p>
  );
}
