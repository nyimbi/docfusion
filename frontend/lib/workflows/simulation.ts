import type { WorkflowTemplateInput } from "@/lib/actions/workflow-runtime";

export interface WorkflowSimulationResult {
	valid: boolean;
	errors: string[];
	reachableStates: string[];
	terminalStates: string[];
}

export function simulateWorkflowTemplate(input: Pick<WorkflowTemplateInput, "states" | "transitions">): WorkflowSimulationResult {
	const errors: string[] = [];
	const states = new Set(input.states);
	if (states.size === 0) {
		errors.push("At least one state is required");
	}

	for (const transition of input.transitions) {
		if (!transition.action.trim()) {
			errors.push("Transition action is required");
		}
		for (const from of transition.from) {
			if (!states.has(from)) errors.push(`Transition ${transition.action} references unknown from-state ${from}`);
		}
		if (!states.has(transition.to)) {
			errors.push(`Transition ${transition.action} references unknown to-state ${transition.to}`);
		}
	}

	const reachable = new Set<string>();
	const initial = input.states[0];
	if (initial) reachable.add(initial);
	let changed = true;
	while (changed) {
		changed = false;
		for (const transition of input.transitions) {
			if (transition.from.some((state) => reachable.has(state)) && !reachable.has(transition.to)) {
				reachable.add(transition.to);
				changed = true;
			}
		}
	}

	for (const state of states) {
		if (!reachable.has(state)) errors.push(`State ${state} is unreachable`);
	}

	const fromStates = new Set(input.transitions.flatMap((transition) => transition.from));
	const terminalStates = [...states].filter((state) => !fromStates.has(state));
	if (terminalStates.length === 0 && states.size > 0) {
		errors.push("At least one terminal state is required");
	}

	return {
		valid: errors.length === 0,
		errors,
		reachableStates: [...reachable],
		terminalStates,
	};
}
