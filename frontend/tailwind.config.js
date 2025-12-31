/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#3B82F6',
        },
        secondary: '#64748B',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#1E293B',
          secondary: '#64748B',
          light: '#94A3B8',
        },
        border: '#E2E8F0',
        'gradient-green-100': '#10B981',
        'gradient-green-80': '#34D399',
        'gradient-amber-60': '#FBBF24',
        'gradient-orange-40': '#FB923C',
        'gradient-red-20': '#EF4444',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '40px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      letterSpacing: {
        plate: '2px',  // For license plate text
      },
    },
  },
  plugins: [],
}
