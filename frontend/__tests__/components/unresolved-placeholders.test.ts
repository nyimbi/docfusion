import { describe, expect, it } from "vitest";

import { findUnresolvedPlaceholderRanges } from "@/components/editor/extensions/unresolved-placeholders";

describe("unresolved placeholder decorations", () => {
	it("creates inline decorations for moustache placeholders only", () => {
		const doc = {
			descendants(callback: (node: { isText: boolean; text?: string }, pos: number) => void) {
				callback(
					{
						isText: true,
						text: "Resolved client and {{client_name}} plus {{ rfp.number }}.",
					},
					1
				);
				callback({ isText: true, text: "Not a placeholder: {client}" }, 60);
			},
		};

		const decorations = findUnresolvedPlaceholderRanges(doc as any);
		const firstDecoration = decorations[0] as any;
		const secondDecoration = decorations[1] as any;

		expect(decorations).toHaveLength(2);
		expect(firstDecoration.type.attrs?.["data-placeholder"]).toBe("{{client_name}}");
		expect(secondDecoration.type.attrs?.["data-placeholder"]).toBe("{{ rfp.number }}");
	});
});
