/**
 * Theme Provider - DocFusion
 *
 * Handles light/dark theme switching with localStorage persistence.
 */

"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: "light" | "dark";
	setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = React.useState<Theme>("dark");
	const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("dark");

	// Initialize from localStorage and system preference
	React.useEffect(() => {
		const stored = localStorage.getItem("docfusion-theme") as Theme | null;
		if (stored) {
			setThemeState(stored);
		}
	}, []);

	// Update resolved theme and apply to document
	React.useEffect(() => {
		let resolved: "light" | "dark";

		if (theme === "system") {
			resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		} else {
			resolved = theme;
		}

		setResolvedTheme(resolved);

		// Apply to document
		const root = document.documentElement;
		if (resolved === "dark") {
			root.classList.add("dark");
			root.classList.remove("light");
		} else {
			root.classList.remove("dark");
			root.classList.add("light");
		}
	}, [theme]);

	// Listen for system theme changes
	React.useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => {
			setResolvedTheme(e.matches ? "dark" : "light");
			const root = document.documentElement;
			if (e.matches) {
				root.classList.add("dark");
				root.classList.remove("light");
			} else {
				root.classList.remove("dark");
				root.classList.add("light");
			}
		};

		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, [theme]);

	const setTheme = React.useCallback((newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem("docfusion-theme", newTheme);
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = React.useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
