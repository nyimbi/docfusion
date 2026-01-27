/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	content: [
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./lib/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			fontFamily: {
				display: ["var(--font-display)", "Georgia", "serif"],
				body: ["var(--font-body)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
				mono: ["var(--font-mono)", "Menlo", "monospace"],
			},
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
				border: "var(--border)",
				ring: "var(--ring)",
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
				},
			},
			borderRadius: {
				sm: "var(--radius-sm)",
				md: "var(--radius-md)",
				lg: "var(--radius-lg)",
				xl: "var(--radius-xl)",
			},
			boxShadow: {
				xs: "var(--shadow-xs)",
				sm: "var(--shadow-sm)",
				md: "var(--shadow-md)",
				lg: "var(--shadow-lg)",
				xl: "var(--shadow-xl)",
				glow: "var(--shadow-glow)",
			},
		},
	},
	plugins: [],
};
