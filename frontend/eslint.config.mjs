import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	{
		ignores: [".next/**", "node_modules/**"],
	},
	...compat.extends("next/core-web-vitals", "plugin:jsx-a11y/recommended"),
	{
		rules: {
			// Enforce aria-label on interactive elements that lack visible text
			"jsx-a11y/anchor-has-content": "warn",
			"jsx-a11y/click-events-have-key-events": "warn",
			"jsx-a11y/heading-has-content": "warn",
			"jsx-a11y/no-autofocus": "warn",
			"jsx-a11y/no-noninteractive-element-interactions": "warn",
			"jsx-a11y/no-static-element-interactions": "warn",
			"jsx-a11y/img-redundant-alt": "warn",
			"jsx-a11y/label-has-associated-control": [
				"warn",
				{
					controlComponents: [
						"Checkbox",
						"Input",
						"RadioGroupItem",
						"SelectTrigger",
						"Switch",
						"Textarea",
					],
					depth: 5,
				},
			],
			"react/no-unescaped-entities": "off",
		},
	},
];

export default eslintConfig;
