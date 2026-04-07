import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "plugin:jsx-a11y/recommended"),
	{
		rules: {
			// Enforce aria-label on interactive elements that lack visible text
			"jsx-a11y/anchor-has-content": "warn",
			"jsx-a11y/click-events-have-key-events": "warn",
			"jsx-a11y/no-static-element-interactions": "warn",
			"jsx-a11y/img-redundant-alt": "warn",
			"jsx-a11y/label-has-associated-control": "warn",
		},
	},
];

export default eslintConfig;
