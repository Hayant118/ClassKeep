import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium',
  danger: 'bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium',
  ghost: 'hover:bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASSES[variant]} transition-colors ${className}`}
      {...rest}
    />
  );
}
