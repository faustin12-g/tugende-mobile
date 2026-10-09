/**
 * Tugende Color System — Single source of truth.
 * Import from here instead of hardcoding color values.
 * These match the Tailwind config in tailwind.config.js.
 */
export const colors = {
  sunset: {
    DEFAULT: '#F97316',
    light: '#FDBA74',
    dark: '#EA580C',
  },
  black: '#0F0F0F',
  white: '#FFFFFF',
  red: '#EF4444',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;

export type ColorKey = keyof typeof colors;
