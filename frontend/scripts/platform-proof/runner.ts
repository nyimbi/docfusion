import { spawn } from "node:child_process";
import path from "node:path";
import type { ProofScenarioDefinition } from "./scenarios";

export interface ProofScenarioRunResult {
	scenarioId: string;
	exitCode: number;
}

export interface ProofScenarioRunSummary {
	results: ProofScenarioRunResult[];
	failed: ProofScenarioRunResult[];
	exitCode: number;
}

export interface RunProofScenariosOptions {
	continueOnFailure?: boolean;
	dryRun?: boolean;
	log?: (message: string) => void;
	runScenario?: (scenario: ProofScenarioDefinition) => Promise<number>;
}

export function formatProofCommand(scenario: ProofScenarioDefinition): string {
	const env = scenario.command.env
		? Object.entries(scenario.command.env).map(([key, value]) => `${key}=${value}`)
		: [];
	return [...env, scenario.command.command, ...scenario.command.args].join(" ");
}

export async function runProofScenario(scenario: ProofScenarioDefinition): Promise<number> {
	const child = spawn(scenario.command.command, scenario.command.args, {
		cwd: scenario.command.cwd ? path.resolve(process.cwd(), scenario.command.cwd) : process.cwd(),
		stdio: "inherit",
		env: {
			...process.env,
			...scenario.command.env,
		},
	});
	return new Promise((resolve) => {
		child.on("close", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}

export async function runProofScenarios(
	scenarios: ProofScenarioDefinition[],
	options: RunProofScenariosOptions = {},
): Promise<ProofScenarioRunSummary> {
	const log = options.log ?? console.log;
	const results: ProofScenarioRunResult[] = [];
	const failed: ProofScenarioRunResult[] = [];
	const execute = options.runScenario ?? runProofScenario;

	for (const scenario of scenarios) {
		if (options.dryRun) {
			log(formatProofCommand(scenario));
			results.push({ scenarioId: scenario.id, exitCode: 0 });
			continue;
		}

		log(`\n[platform-proof] ${scenario.id}`);
		log(`[platform-proof] ${scenario.title}`);
		log(`[platform-proof] ${formatProofCommand(scenario)}`);
		const exitCode = await execute(scenario);
		const result = { scenarioId: scenario.id, exitCode };
		results.push(result);

		if (exitCode !== 0) {
			failed.push(result);
			if (!options.continueOnFailure) {
				return {
					results,
					failed,
					exitCode,
				};
			}
		}
	}

	if (failed.length) {
		log(`\n[platform-proof] ${failed.length} scenario(s) failed:`);
		for (const result of failed) {
			log(`[platform-proof] - ${result.scenarioId} exited ${result.exitCode}`);
		}
		return {
			results,
			failed,
			exitCode: failed[0]?.exitCode || 1,
		};
	}

	return {
		results,
		failed,
		exitCode: 0,
	};
}
