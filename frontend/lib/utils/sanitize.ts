import DOMPurify from "dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify with the HTML profile for safe rendering.
 */
export function sanitizeHTML(dirty: string): string {
	if (typeof window === "undefined") {
		// Server-side: strip all HTML tags as a safe fallback
		return dirty.replace(/<[^>]*>/g, "");
	}
	return DOMPurify.sanitize(dirty, {
		USE_PROFILES: { html: true },
		ALLOWED_TAGS: [
			"b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li",
			"h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "blockquote",
			"table", "thead", "tbody", "tr", "th", "td", "span", "div",
			"img", "figure", "figcaption", "sup", "sub", "mark", "del", "ins",
			"svg", "path", "g", "rect", "circle", "ellipse", "line", "polyline",
			"polygon", "text", "tspan", "defs", "clipPath", "use", "symbol",
			"marker", "pattern", "linearGradient", "radialGradient", "stop",
			"foreignObject", "title", "desc", "metadata",
		],
		ALLOWED_ATTR: [
			"href", "src", "alt", "title", "class", "id", "target", "rel",
			"width", "height", "viewBox", "xmlns", "fill", "stroke",
			"stroke-width", "d", "transform", "x", "y", "cx", "cy", "r",
			"rx", "ry", "x1", "y1", "x2", "y2", "points", "style",
			"font-size", "font-family", "font-weight", "text-anchor",
			"dominant-baseline", "opacity", "clip-path", "marker-end",
			"marker-start", "marker-mid", "gradientUnits", "offset",
			"stop-color", "stop-opacity",
		],
	});
}
