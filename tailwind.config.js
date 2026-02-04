/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#2563EB', // Modern Blue
                    hover: '#1D4ED8',
                    light: '#EFF6FF',
                    border: '#BFDBFE',
                },
                text: {
                    main: '#111827',
                    secondary: '#4B5563',
                    tertiary: '#9CA3AF',
                },
                bg: {
                    main: '#F3F4F6',
                    card: '#FFFFFF',
                },
                border: '#E5E7EB',
                danger: '#EF4444',
                success: '#10B981',
            }
        },
    },
    plugins: [],
}
