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

import type { WisprPatch, WisprPatchOp } from "./WisprTypes";
import { deleteValueAtPath, getValueAtPath, setValueAtPath, isValidPath } from "./WisprPath";

/**
 * Apply a patch operation to a state object.
 * Mutates the state in place.
 *
 * @param state - State object to mutate
 * @param operation - Patch operation to apply
 * @throws Error if operation or state is invalid
 */
export function applyPatchOperation(state: Record<string | number, unknown>, operation: WisprPatchOp): void {
	if (!state || typeOf(state) !== "table") {
		error("[WisprPatch] Invalid state: state must be a table");
	}
	if (!operation || typeOf(operation) !== "table") {
		error("[WisprPatch] Invalid operation: operation must be a table");
	}
	if (!("type" in operation) || typeOf(operation.type) !== "string") {
		error("[WisprPatch] Invalid operation: operation.type must be a string");
	}

	try {
		if (operation.type === "set") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid set operation: path is required and must be valid");
			}
			setValueAtPath(state, operation.path, operation.value);
		} else if (operation.type === "delete") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid delete operation: path is required and must be valid");
			}
			deleteValueAtPath(state, operation.path);
		} else if (operation.type === "increment") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid increment operation: path is required and must be valid");
			}
			if (!("delta" in operation) || typeOf(operation.delta) !== "number") {
				error("[WisprPatch] Invalid increment operation: delta must be a number");
			}
			const currentValue = getValueAtPath(state, operation.path);
			if (typeOf(currentValue) === "number") {
				setValueAtPath(state, operation.path, (currentValue as number) + operation.delta);
			} else {
				warn(`[WisprPatch] Cannot increment: value at path is not a number (got ${typeOf(currentValue)})`);
			}
		} else if (operation.type === "listPush") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid listPush operation: path is required and must be valid");
			}
			const currentValue = getValueAtPath(state, operation.path);
			if (typeIs(currentValue, "table")) {
				const arr = currentValue as { push: (value: unknown) => void };
				arr.push(operation.value);
			} else {
				warn(`[WisprPatch] Cannot push: value at path is not a table (got ${typeOf(currentValue)})`);
			}
		} else if (operation.type === "listInsert") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid listInsert operation: path is required and must be valid");
			}
			if (!("index" in operation) || typeOf(operation.index) !== "number") {
				error("[WisprPatch] Invalid listInsert operation: index must be a number");
			}
			if (operation.index < 0) {
				error("[WisprPatch] Invalid listInsert operation: index must be non-negative");
			}
			const currentValue = getValueAtPath(state, operation.path);
			if (typeIs(currentValue, "table")) {
				const arr = currentValue as { insert: (index: number, value: unknown) => void };
				arr.insert(operation.index, operation.value);
			} else {
				warn(`[WisprPatch] Cannot insert: value at path is not a table (got ${typeOf(currentValue)})`);
			}
		} else if (operation.type === "listRemoveAt") {
			if (!("path" in operation) || !isValidPath(operation.path)) {
				error("[WisprPatch] Invalid listRemoveAt operation: path is required and must be valid");
			}
			if (!("index" in operation) || typeOf(operation.index) !== "number") {
				error("[WisprPatch] Invalid listRemoveAt operation: index must be a number");
			}
			if (operation.index < 0) {
				error("[WisprPatch] Invalid listRemoveAt operation: index must be non-negative");
			}
			const currentValue = getValueAtPath(state, operation.path);
			if (typeIs(currentValue, "table")) {
				const arr = currentValue as { remove: (index: number) => void };
				arr.remove(operation.index);
			} else {
				warn(`[WisprPatch] Cannot remove: value at path is not a table (got ${typeOf(currentValue)})`);
			}
		} else if (operation.type === "mapSet") {
			if (!("pathToMap" in operation) || !isValidPath(operation.pathToMap)) {
				error("[WisprPatch] Invalid mapSet operation: pathToMap is required and must be valid");
			}
			if (!("id" in operation) || typeOf(operation.id) !== "string") {
				error("[WisprPatch] Invalid mapSet operation: id must be a string");
			}
			const mapValue = getValueAtPath(state, operation.pathToMap);
			if (typeIs(mapValue, "table")) {
				const map = mapValue as Record<string, unknown>;
				map[operation.id] = operation.value;
			} else {
				warn(`[WisprPatch] Cannot set map value: value at pathToMap is not a table (got ${typeOf(mapValue)})`);
			}
		} else if (operation.type === "mapDelete") {
			if (!("pathToMap" in operation) || !isValidPath(operation.pathToMap)) {
				error("[WisprPatch] Invalid mapDelete operation: pathToMap is required and must be valid");
			}
			if (!("id" in operation) || typeOf(operation.id) !== "string") {
				error("[WisprPatch] Invalid mapDelete operation: id must be a string");
			}
			const mapValue = getValueAtPath(state, operation.pathToMap);
			if (typeIs(mapValue, "table")) {
				const map = mapValue as Record<string, unknown>;
				delete map[operation.id];
			} else {
				warn(
					`[WisprPatch] Cannot delete map value: value at pathToMap is not a table (got ${typeOf(mapValue)})`,
				);
			}
		} else {
			const opType = (operation as { type?: unknown }).type;
			error(`[WisprPatch] Unknown operation type: ${tostring(opType ?? "undefined")}`);
		}
	} catch (err) {
		error(`[WisprPatch] Failed to apply operation "${operation.type}": ${err}`);
	}
}

/**
 * Apply a complete patch to a state object.
 *
 * @param state - State object to mutate
 * @param patch - Patch to apply
 * @throws Error if patch is invalid
 */
export function applyPatch(state: Record<string | number, unknown>, patch: WisprPatch): void {
	if (!state || typeOf(state) !== "table") {
		error("[WisprPatch] Invalid state: state must be a table");
	}
	if (!patch || typeOf(patch) !== "table") {
		error("[WisprPatch] Invalid patch: patch must be a table");
	}
	if (!("operations" in patch) || !typeIs(patch.operations, "table")) {
		error("[WisprPatch] Invalid patch: operations array is required");
	}
	if (typeOf(patch.version) !== "number" || patch.version < 0) {
		error("[WisprPatch] Invalid patch: version must be a non-negative number");
	}

	for (const operation of patch.operations) {
		applyPatchOperation(state, operation);
	}
}
