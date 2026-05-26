import {
	listProofScenarios,
	validateProofScenarioManifest,
	type ProofScenarioDefinition,
} from "./platform-proof/scenarios";
import { formatProofCommand, runProofScenarios } from "./platform-proof/runner";

interface CliOptions {
	json: boolean;
	list: boolean;
	dryRun: boolean;
	runAll: boolean;
	includeLiveSafe: boolean;
	continueOnFailure: boolean;
	wave?: number;
	runIds: string[];
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const manifestErrors = validateProofScenarioManifest();
	if (manifestErrors.length) {
		throw new Error(`Invalid proof scenario manifest:\n${manifestErrors.join("\n")}`);
	}

	const scenarios = listProofScenarios({
		wave: options.wave,
		ids: options.runAll ? undefined : options.runIds,
		includeLiveSafe: options.includeLiveSafe,
	});

	if (options.json) {
		console.log(JSON.stringify({ scenarios }, null, 2));
		return;
	}

	const shouldExecute = options.runAll || options.runIds.length > 0;

	if (options.list || !shouldExecute) {
		printScenarioList(scenarios);
		if (!shouldExecute) {
			console.log("\nUse --run <scenario-id> or --all to execute scenarios. Add --include-live-safe for deployed-service proofs.");
		}
		if (options.list) return;
	}

	if (!shouldExecute) return;
	if (!scenarios.length) {
		throw new Error("No proof scenarios matched the requested filters.");
	}

	await executeScenarios(scenarios, options);
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		json: false,
		list: false,
		dryRun: false,
		runAll: false,
		includeLiveSafe: false,
		continueOnFailure: false,
		runIds: [],
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json") options.json = true;
		else if (arg === "--list") options.list = true;
		else if (arg === "--dry-run") options.dryRun = true;
		else if (arg === "--all") options.runAll = true;
		else if (arg === "--include-live-safe") options.includeLiveSafe = true;
		else if (arg === "--continue-on-failure") options.continueOnFailure = true;
		else if (arg === "--wave") {
			const value = args[index + 1];
			if (!value) throw new Error("--wave requires a number");
			options.wave = Number(value);
			if (!Number.isInteger(options.wave)) throw new Error(`Invalid --wave value: ${value}`);
			index += 1;
		} else if (arg === "--run") {
			const value = args[index + 1];
			if (!value) throw new Error("--run requires a scenario id");
			options.runIds.push(value);
			index += 1;
		} else {
			throw new Error(`Unknown platform-proof option: ${arg}`);
		}
	}

	return options;
}

function printScenarioList(scenarios: ProofScenarioDefinition[]) {
	if (!scenarios.length) {
		console.log("No proof scenarios matched the requested filters.");
		return;
	}
	for (const scenario of scenarios) {
		const live = scenario.requiresLiveServices ? " live-safe" : "";
		console.log(`${scenario.id} [wave ${scenario.wave}, ${scenario.kind}${live}]`);
		console.log(`  ${scenario.title}`);
		console.log(`  targets: ${scenario.proofTargets.join(", ")}`);
		console.log(`  command: ${formatProofCommand(scenario)}`);
	}
}

async function executeScenarios(scenarios: ProofScenarioDefinition[], options: CliOptions) {
	const summary = await runProofScenarios(scenarios, {
		continueOnFailure: options.continueOnFailure,
		dryRun: options.dryRun,
	});
	if (summary.exitCode !== 0) process.exit(summary.exitCode);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
