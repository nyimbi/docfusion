/**
 * DocFusion Tailwind Configuration
 * "Ink & Paper" Editorial Design System
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: [
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./lib/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			/* Typography */
			fontFamily: {
				display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
				sans: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
			},

			/* Colors - mapped from CSS variables */
			colors: {
				border: "hsl(var(--border))",
				"border-strong": "hsl(var(--border-strong))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				"background-subtle": "hsl(var(--background-subtle))",
				foreground: "hsl(var(--foreground))",
				"foreground-muted": "hsl(var(--foreground-muted))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
					hover: "hsl(var(--primary-hover))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				success: {
					DEFAULT: "hsl(var(--success))",
					foreground: "hsl(var(--success-foreground))",
				},
				warning: {
					DEFAULT: "hsl(var(--warning))",
					foreground: "hsl(var(--warning-foreground))",
				},
				info: {
					DEFAULT: "hsl(var(--info))",
					foreground: "hsl(var(--info-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
			},

			/* Border Radius */
			borderRadius: {
				lg: "var(--radius-lg)",
				md: "var(--radius)",
				sm: "var(--radius-sm)",
				xl: "var(--radius-xl)",
				"2xl": "var(--radius-2xl)",
			},

			/* Box Shadows */
			boxShadow: {
				xs: "var(--shadow-xs)",
				sm: "var(--shadow-sm)",
				md: "var(--shadow-md)",
				lg: "var(--shadow-lg)",
				xl: "var(--shadow-xl)",
				/* Colored glow shadows for primary elements */
				"primary-sm": "0 2px 8px hsl(var(--primary) / 0.15)",
				"primary-md": "0 4px 16px hsl(var(--primary) / 0.2)",
				"primary-lg": "0 8px 32px hsl(var(--primary) / 0.25)",
			},

			/* Transitions */
			transitionDuration: {
				fast: "var(--transition-fast)",
				base: "var(--transition-base)",
				slow: "var(--transition-slow)",
			},

			transitionTimingFunction: {
				"ease-out-expo": "var(--ease-out)",
				spring: "var(--ease-spring)",
			},

			/* Keyframes */
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				"collapsible-down": {
					from: { height: "0" },
					to: { height: "var(--radix-collapsible-content-height)" },
				},
				"collapsible-up": {
					from: { height: "var(--radix-collapsible-content-height)" },
					to: { height: "0" },
				},
				"slide-in-from-top": {
					from: { transform: "translateY(-100%)", opacity: "0" },
					to: { transform: "translateY(0)", opacity: "1" },
				},
				"slide-in-from-bottom": {
					from: { transform: "translateY(100%)", opacity: "0" },
					to: { transform: "translateY(0)", opacity: "1" },
				},
				"slide-in-from-left": {
					from: { transform: "translateX(-100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"slide-in-from-right": {
					from: { transform: "translateX(100%)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				"fade-out": {
					from: { opacity: "1" },
					to: { opacity: "0" },
				},
				"zoom-in": {
					from: { transform: "scale(0.95)", opacity: "0" },
					to: { transform: "scale(1)", opacity: "1" },
				},
				"zoom-out": {
					from: { transform: "scale(1)", opacity: "1" },
					to: { transform: "scale(0.95)", opacity: "0" },
				},
				spin: {
					from: { transform: "rotate(0deg)" },
					to: { transform: "rotate(360deg)" },
				},
				pulse: {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.5" },
				},
				bounce: {
					"0%, 100%": { transform: "translateY(-5%)", animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)" },
					"50%": { transform: "translateY(0)", animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)" },
				},
			},

			/* Animations */
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"collapsible-down": "collapsible-down 0.2s ease-out",
				"collapsible-up": "collapsible-up 0.2s ease-out",
				"slide-in-from-top": "slide-in-from-top 0.3s ease-out",
				"slide-in-from-bottom": "slide-in-from-bottom 0.3s ease-out",
				"slide-in-from-left": "slide-in-from-left 0.3s ease-out",
				"slide-in-from-right": "slide-in-from-right 0.3s ease-out",
				"fade-in": "fade-in 0.2s ease-out",
				"fade-out": "fade-out 0.2s ease-out",
				"zoom-in": "zoom-in 0.2s ease-out",
				"zoom-out": "zoom-out 0.2s ease-out",
				spin: "spin 1s linear infinite",
				pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				bounce: "bounce 1s infinite",
			},

			/* Spacing scale extensions */
			spacing: {
				18: "4.5rem",
				22: "5.5rem",
				30: "7.5rem",
			},

			/* Z-index scale */
			zIndex: {
				60: "60",
				70: "70",
				80: "80",
				90: "90",
				100: "100",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
