/**
 * Stealth Scraper Service
 *
 * HTTP API for scraping sites with anti-bot protection using Crawlee.
 * Designed to run alongside Firecrawl on the same server.
 *
 * Endpoints:
 *   POST /scrape    - Scrape a URL with stealth browser
 *   POST /v1/scrape - Firecrawl-compatible endpoint
 *   GET /health     - Health check
 *
 * Port: 3003 (Firecrawl is on 3002)
 */

import Fastify from "fastify";
import { stealthScrape, type ScrapeOptions } from "./scraper.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3003;
const HOST = process.env.HOST || "0.0.0.0";

const fastify = Fastify({
	logger: {
		level: "info",
		transport: {
			target: "pino-pretty",
			options: { colorize: true },
		},
	},
});

// Health check endpoint
fastify.get("/health", async () => {
	return {
		status: "ok",
		service: "stealth-scraper",
		timestamp: new Date().toISOString(),
	};
});

// Scrape endpoint - native format
interface ScrapeBody {
	url: string;
	options?: Partial<ScrapeOptions>;
}

fastify.post<{ Body: ScrapeBody }>("/scrape", async (request, reply) => {
	const { url, options } = request.body;

	if (!url) {
		return reply.status(400).send({
			success: false,
			error: "Missing required field: url",
		});
	}

	try {
		request.log.info({ url }, "Starting stealth scrape");
		const result = await stealthScrape(url, options);
		request.log.info(
			{ url, success: result.success, contentLength: result.markdown?.length },
			"Scrape completed"
		);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		request.log.error({ url, error: message }, "Scrape failed");
		return reply.status(500).send({
			success: false,
			error: message,
		});
	}
});

// V1 API - Firecrawl-compatible endpoint
fastify.post<{ Body: ScrapeBody }>("/v1/scrape", async (request, reply) => {
	const { url, options } = request.body;

	if (!url) {
		return reply.status(400).send({
			success: false,
			error: "Missing required field: url",
		});
	}

	try {
		const result = await stealthScrape(url, options);

		// Return in Firecrawl-compatible format
		return {
			success: result.success,
			data: result.success
				? {
						markdown: result.markdown,
						html: result.html,
						metadata: {
							title: result.title,
							sourceURL: url,
							statusCode: result.statusCode,
						},
						links: result.links,
					}
				: undefined,
			error: result.error,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return reply.status(500).send({
			success: false,
			error: message,
		});
	}
});

// Start server
async function start() {
	try {
		await fastify.listen({ port: PORT, host: HOST });
		console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              STEALTH SCRAPER SERVICE                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Port:     ${String(PORT).padEnd(46)}║
║  Host:     ${HOST.padEnd(46)}║
║  Endpoint: POST /scrape, POST /v1/scrape                      ║
║  Health:   GET /health                                        ║
║                                                               ║
║  Using Crawlee + Playwright for anti-bot bypass               ║
╚═══════════════════════════════════════════════════════════════╝
`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

start();
