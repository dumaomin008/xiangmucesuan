import { clsx } from "clsx";
import { cloneElement, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-sn-lg bg-white p-6 shadow-sn-card border border-black/[0.06] transition-shadow duration-300 ease-sn",
        hover && "hover:shadow-sn-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-sn-primary text-white hover:opacity-90 hover:-translate-y-px",
    secondary: "bg-white text-sn-primary border border-black/10 hover:bg-sn-hover",
    ghost: "bg-transparent text-sn-secondary hover:bg-sn-hover",
    danger: "bg-[#FF6B6B] text-white hover:opacity-90",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-sn-md px-6 py-3 text-[15px] font-semibold transition duration-200 ease-sn disabled:opacity-40 disabled:pointer-events-none",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-sn-info/12 text-sn-info",
    calculated: "bg-sn-success/12 text-sn-success",
    baseline: "bg-[#667EEA]/12 text-[#667EEA]",
    archived: "bg-black/5 text-sn-secondary",
  };
  const label: Record<string, string> = {
    draft: "草稿",
    calculated: "已测算",
    baseline: "基准",
    archived: "已归档",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium", map[status] || "bg-black/5")}>
      {label[status] || status}
    </span>
  );
}

export function Field({
  label,
  unit,
  hint,
  required,
  source,
  overridden,
  help,
  error,
  fieldId,
  children,
}: {
  label: string;
  unit?: string;
  hint?: string;
  required?: boolean;
  source?: string;
  overridden?: boolean;
  help?: ReactNode;
  error?: string;
  fieldId?: string;
  children: ReactNode;
}) {
  return (
    <div className="block" data-field={fieldId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium tracking-[0.02em] text-sn-secondary">
          {label}
          {required && <span className="ml-1 text-sn-error">*</span>}
          {help}
        </span>
        <span className="flex items-center gap-2">
          {source && (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[11px]",
                overridden ? "bg-sn-warning/15 text-[#C47B12]" : "bg-sn-hover text-sn-muted",
              )}
            >
              {overridden ? "已覆盖标准" : source}
            </span>
          )}
          {unit && <span className="text-[12px] text-sn-muted">{unit}</span>}
        </span>
      </div>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ "aria-label"?: string; "aria-invalid"?: boolean; className?: string; id?: string }>, {
            "aria-label": label,
            "aria-invalid": Boolean(error) || undefined,
            id: fieldId ? `input-${fieldId.replace(/\./g, "-")}` : undefined,
            className: clsx(
              (children as ReactElement<{ className?: string }>).props.className,
              error && "border-sn-error bg-[#FFF6F6]",
            ),
          })
        : children}
      {error && <p className="mt-1.5 text-[12px] text-[#C44747]">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[12px] text-sn-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-sn-sm border border-black/[0.06] bg-sn-subtle px-3 py-2.5 text-[15px] text-sn-primary transition duration-200",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-sn-sm border border-black/[0.06] bg-sn-subtle px-3 py-2.5 text-[15px] text-sn-primary transition duration-200",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-sn-sm border border-black/[0.06] bg-sn-subtle px-3 py-2.5 text-[15px] text-sn-primary transition duration-200",
        props.className,
      )}
    />
  );
}

export function MetricCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sn-lg bg-white p-6 text-left shadow-sn-card border border-black/[0.06] transition duration-300 hover:shadow-sn-hover"
    >
      <div className="text-[13px] font-medium uppercase tracking-[0.04em] text-sn-muted">{label}</div>
      <div className="mt-3 text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-sn-primary">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-sn-muted">{hint}</div>}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-sn-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
