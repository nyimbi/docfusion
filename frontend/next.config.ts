import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
	// Cache strategies for different types of assets
	runtimeCaching: [
		{
			// Cache API responses
			urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "api-cache",
				expiration: {
					maxEntries: 200,
					maxAgeSeconds: 60 * 60, // 1 hour
				},
				networkTimeoutSeconds: 10,
			},
		},
		{
			// Cache static assets
			urlPattern: /\.(?:js|css|woff|woff2|ttf|otf|eot)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-assets",
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			// Cache images
			urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
			handler: "CacheFirst",
			options: {
				cacheName: "images",
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			// Cache Google Fonts
			urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 20,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			// Cache document pages for offline viewing
			urlPattern: /\/documents\/.*/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "document-pages",
				expiration: {
					maxEntries: 50,
					maxAgeSeconds: 60 * 60 * 24, // 1 day
				},
				networkTimeoutSeconds: 10,
			},
		},
	],
});

const nextConfig: NextConfig = {
	// Enable React strict mode
	reactStrictMode: true,
	// Transpile auth packages that may have ESM/CJS issues
	transpilePackages: [
		"better-auth",
		"@daveyplate/better-auth-ui",
		"@better-auth/passkey",
		"@daveyplate/better-auth-tanstack",
	],
	// API proxy to backend
	async rewrites() {
		return [
			{
				source: "/api/v1/:path*",
				destination: "http://localhost:8000/api/v1/:path*",
			},
		];
	},
};

export default withPWA(nextConfig);
