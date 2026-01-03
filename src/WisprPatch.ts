/**
 * Patch operation definitions and application logic.
 *
 * Patches are the only way state changes are communicated to clients.
 * Each patch contains a version and a list of operations.
 *
 * Rules:
 * - Patches are applied in order
 * - Lower version patches are ignored
 * - Snapshot version always supersedes patches
 * - Operations are applied blindly (server is authoritative)
 */

import type { WisprPatch, WisprPatchOp, WisprPath } from "./WisprTypes";
import { deleteValueAtPath, getValueAtPath, setValueAtPath } from "./WisprPath";

/**
 * Apply a patch operation to a state object.
 * Mutates the state in place.
 *
 * @param state - State object to mutate
 * @param operation - Patch operation to apply
 */
export function applyPatchOperation(state: Record<string | number, unknown>, operation: WisprPatchOp): void {
	if (operation.type === "set") {
		setValueAtPath(state, operation.path, operation.value);
	} else if (operation.type === "delete") {
		deleteValueAtPath(state, operation.path);
	} else if (operation.type === "increment") {
		const currentValue = getValueAtPath(state, operation.path);
		if (typeOf(currentValue) === "number") {
			setValueAtPath(state, operation.path, (currentValue as number) + operation.delta);
		}
	} else if (operation.type === "listPush") {
		const currentValue = getValueAtPath(state, operation.path);
		if (typeIs(currentValue, "table")) {
			const arr = currentValue as { push: (value: unknown) => void };
			arr.push(operation.value);
		}
	} else if (operation.type === "listInsert") {
		const currentValue = getValueAtPath(state, operation.path);
		if (typeIs(currentValue, "table")) {
			const arr = currentValue as { insert: (index: number, value: unknown) => void };
			arr.insert(operation.index, operation.value);
		}
	} else if (operation.type === "listRemoveAt") {
		const currentValue = getValueAtPath(state, operation.path);
		if (typeIs(currentValue, "table")) {
			const arr = currentValue as { remove: (index: number) => void };
			arr.remove(operation.index);
		}
	} else if (operation.type === "mapSet") {
		const mapValue = getValueAtPath(state, operation.pathToMap);
		if (typeIs(mapValue, "table")) {
			const map = mapValue as Record<string, unknown>;
			map[operation.id] = operation.value;
		}
	} else if (operation.type === "mapDelete") {
		const mapValue = getValueAtPath(state, operation.pathToMap);
		if (typeIs(mapValue, "table")) {
			const map = mapValue as Record<string, unknown>;
			delete map[operation.id];
		}
	}
}

/**
 * Apply a complete patch to a state object.
 *
 * @param state - State object to mutate
 * @param patch - Patch to apply
 */
export function applyPatch(state: Record<string | number, unknown>, patch: WisprPatch): void {
	for (const operation of patch.operations) {
		applyPatchOperation(state, operation);
	}
}
