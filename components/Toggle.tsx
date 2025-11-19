"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

export default function Toggle({ checked, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`group relative flex h-8 w-14 items-center rounded-full border border-white/10 px-1 transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-black/20 ${
        checked
          ? "bg-gradient-to-r from-emerald-500/80 via-emerald-400/80 to-teal-300/70"
          : "bg-zinc-900"
      }`}
    >
      <span
        className={`relative inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white text-[10px] font-semibold text-zinc-900 shadow-lg shadow-emerald-900/40 transition duration-200 ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      >
        <span
          className={`absolute inset-0 rounded-full blur-md transition ${
            checked ? "bg-emerald-300/50" : "bg-white/10"
          }`}
        />
        <span className="relative">{checked ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}
