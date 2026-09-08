import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-[24px] border border-white/40 bg-white/90 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.08)] backdrop-blur-[12px]">
        <h1 className="text-2xl font-bold text-[#0a0f1c]">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-[#64748b]">{subtitle}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div className="mt-4 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      {message}
    </div>
  );
}

export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#0a0f1c]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-xl border border-gray-200 bg-background px-4 text-sm outline-none transition-all focus-visible:border-[#f96316] focus-visible:ring-2 focus-visible:ring-[#f96316]/20"
      />
    </div>
  );
}
