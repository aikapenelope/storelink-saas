import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
  }).format(price);
}

/** Type-safe helper to read the custom `role` field from Payload's User object */
export function getUserRole(user: unknown): 'super-admin' | 'tenant-admin' | undefined {
  if (user && typeof user === 'object' && 'role' in user) {
    const role = (user as { role: unknown }).role;
    if (role === 'super-admin' || role === 'tenant-admin') return role;
  }
  return undefined;
}
