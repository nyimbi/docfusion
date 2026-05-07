import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
	// Enable React strict mode
	reactStrictMode: true,
	serverExternalPackages: ["pdf-parse"],
	// Webpack configuration to handle Node.js modules
	webpack: (config, { isServer }) => {
		// Handle node: prefixed modules - only for client builds
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				https: false,
				http: false,
				path: false,
				stream: false,
				crypto: false,
				zlib: false,
				url: false,
				assert: false,
				util: false,
				tls: false,
				net: false,
				dns: false,
				child_process: false,
				cluster: false,
				module: false,
				os: false,
				querystring: false,
				readline: false,
				string_decoder: false,
				timers: false,
			};
			
			// Add plugin to ignore node: prefixed modules
			config.plugins.push(
				new webpack.NormalModuleReplacementPlugin(
					/^node:/,
					"data:text/javascript,export default {};"
				)
			);
		}
		return config;
	},
	// API proxy to backend
	async rewrites() {
		return {
			fallback: [
				{
					source: "/api/v1/:path*",
					destination: "http://localhost:8000/api/v1/:path*",
				},
			],
		};
	},
};

export default nextConfig;
