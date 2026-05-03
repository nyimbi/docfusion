import "./load-env";

import { closeDatabaseConnection } from "@/lib/db";
import {
	auditSnippetContextFixtures,
	ensureSnippetContextFixtures,
	getManualProofSnippetSeedContract,
	getSnippetFixtureTargetInfo,
} from "@/lib/snippets/snippet-context-fixtures";

interface CliOptions {
	audit: boolean;
	apply: boolean;
	allowProduction: boolean;
	confirmHost?: string;
	json: boolean;
}

function parseArgs(argv: string[]): CliOptions {
	const options: CliOptions = {
		audit: false,
		apply: false,
		allowProduction: false,
		json: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		switch (arg) {
			case "--audit":
				options.audit = true;
				break;
			case "--apply":
				options.apply = true;
				break;
			case "--allow-production":
				options.allowProduction = true;
				break;
			case "--confirm-host": {
				const host = argv[index + 1];
				if (!host || host.startsWith("--")) {
					throw new Error("--confirm-host requires a host value.");
				}
				options.confirmHost = host;
				index += 1;
				break;
			}
			case "--json":
				options.json = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!options.audit && !options.apply) {
		options.audit = true;
	}
	if (options.audit && options.apply) {
		throw new Error("Use either --audit or --apply, not both.");
	}

	return options;
}

function printTextReport(label: string, value: unknown) {
	console.log(`\n${label}`);
	console.log(JSON.stringify(value, null, 2));
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const target = getSnippetFixtureTargetInfo();
	const seedContract = getManualProofSnippetSeedContract();

	console.log("Snippet context fixture target");
	console.log(`host=${target.host ?? "unknown"} database=${target.database ?? "unknown"} productionLike=${target.productionLike}`);
	if (target.productionReasons.length > 0) {
		console.log(`productionReasons=${target.productionReasons.join("; ")}`);
	}
	if (!seedContract.exists || !seedContract.containsClientName || !seedContract.containsOpportunityName) {
		throw new Error("/dc-exec-summary seed contract is missing client_name or opportunity_name placeholders.");
	}

	if (options.apply) {
		const result = await ensureSnippetContextFixtures({
			allowProduction: options.allowProduction,
			confirmHost: options.confirmHost,
			targetInfo: target,
		});
		if (options.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			printTextReport("Fixture apply result", {
				opportunityIds: Object.fromEntries(result.opportunityIds),
				documentIds: Object.fromEntries(result.documentIds),
				manualVerificationUrls: result.audit.manualVerificationUrls,
				totals: result.audit.totals,
				fixtures: result.audit.fixtures,
			});
		}
		return;
	}

	const audit = await auditSnippetContextFixtures();
	if (options.json) {
		console.log(JSON.stringify(audit, null, 2));
	} else {
		printTextReport("Fixture audit result", audit);
	}
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	})
	.finally(async () => {
		await closeDatabaseConnection();
	});
