/**
 * Wispr - Server-authoritative state replication system.
 *
 * Wispr provides a simple, safe, and explicit way to replicate state
 * from server to clients using a snapshot + patch model.
 *
 * Key Concepts:
 * - Server authoritative: Only server can mutate state
 * - Array paths: Use arrays, never strings (["inventory", "gold"])
 * - Explicit patches: All changes are explicit operations
 * - Versioned: Patches are versioned, out-of-order ignored
 * - Scoped: Control which clients see which nodes
 *
 * Quick Start:
 *
 * Server:
 * ```ts
 * import { WisprToken, createNode, patchNode } from "shared/wispr";
 * import { pathOf } from "shared/wispr";
 *
 * const PLAYER_STATS = WisprToken.create<PlayerStats>("player.stats");
 *
 * const node = createNode(PLAYER_STATS, { kind: "all" }, { gold: 0 });
 * patchNode(PLAYER_STATS, { type: "set", path: pathOf("gold"), value: 100 });
 * ```
 *
 * Client:
 * ```ts
 * import { waitForNode } from "shared/wispr";
 *
 * const node = await waitForNode(PLAYER_STATS);
 * const stats = node.getState();
 * node.listenForChange(pathOf("gold"), (newVal, oldVal) => {
 *   print(`Gold changed from ${oldVal} to ${newVal}`);
 * });
 * ```
 */

// Core types
export type {
	WisprPath,
	WisprTokenId,
	WisprScope,
	WisprPatchOp,
	WisprPatch,
	WisprSnapshot,
	WisprCreateMessage,
	WisprDestroyMessage,
	WisprMessage,
	WisprChangeCallback,
	WisprAnyChangeCallback,
	WisprRawPatchCallback,
} from "./WisprTypes";

// Token system
export { WisprToken } from "./WisprToken";

// Path utilities
export { pathOf, isValidPath, getValueAtPath, setValueAtPath, deleteValueAtPath } from "./WisprPath";

// Patch operations
export { applyPatch, applyPatchOperation } from "./WisprPatch";

// Remotes
export { getRemoteFunction, getRemoteEvent, WISPR_REMOTES, initializeRemotes } from "./WisprRemotes";

// Blink integration
export { configureBlink } from "./WisprBlinkConfig";
export type { WisprBlinkConfig, BlinkCasing } from "./WisprBlinkConfig";

// Client API
export { WisprNode } from "./WisprNode";
export { requestInitialData, waitForNode, getNode as getClientNode } from "./WisprClient";

// Server API
export {
	WisprServerNode,
	createNode,
	getNode as getServerNode,
	destroyNode,
	patchNode,
	patchNodeMultiple,
} from "./WisprServer";

// Internal utilities (exposed for advanced use)
export { WisprSignal } from "./WisprSignal";
export { WisprMaid } from "./WisprMaid";
export { WisprRateLimiter } from "./WisprRateLimiter";

/**
 * Helper functions for creating patch operations.
 * These make it easier to create patches without manually constructing objects.
 */

import type { WisprPatchOp, WisprPath } from "./WisprTypes";
import { isValidPath } from "./WisprPath";

/**
 * Create a "set" patch operation.
 *
 * @param path - Path to set
 * @param value - Value to set
 * @returns Patch operation
 * @throws Error if path is invalid
 */
export function opSet(path: WisprPath, value: unknown): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opSet: path must be a non-empty array of strings or numbers");
	}
	return { type: "set", path, value };
}

/**
 * Create a "delete" patch operation.
 *
 * @param path - Path to delete
 * @returns Patch operation
 * @throws Error if path is invalid
 */
export function opDelete(path: WisprPath): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opDelete: path must be a non-empty array of strings or numbers");
	}
	return { type: "delete", path };
}

/**
 * Create an "increment" patch operation.
 *
 * @param path - Path to increment
 * @param delta - Amount to increment by
 * @returns Patch operation
 * @throws Error if path or delta is invalid
 */
export function opIncrement(path: WisprPath, delta: number): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opIncrement: path must be a non-empty array of strings or numbers");
	}
	if (typeOf(delta) !== "number") {
		error("[Wispr] opIncrement: delta must be a number");
	}
	return { type: "increment", path, delta };
}

/**
 * Create a "listPush" patch operation.
 *
 * @param path - Path to the list
 * @param value - Value to push
 * @returns Patch operation
 * @throws Error if path is invalid
 */
export function opListPush(path: WisprPath, value: unknown): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opListPush: path must be a non-empty array of strings or numbers");
	}
	return { type: "listPush", path, value };
}

/**
 * Create a "listInsert" patch operation.
 *
 * @param path - Path to the list
 * @param index - Index to insert at
 * @param value - Value to insert
 * @returns Patch operation
 * @throws Error if path or index is invalid
 */
export function opListInsert(path: WisprPath, index: number, value: unknown): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opListInsert: path must be a non-empty array of strings or numbers");
	}
	if (typeOf(index) !== "number" || index < 0 || index !== math.floor(index)) {
		error("[Wispr] opListInsert: index must be a non-negative integer");
	}
	return { type: "listInsert", path, index, value };
}

/**
 * Create a "listRemoveAt" patch operation.
 *
 * @param path - Path to the list
 * @param index - Index to remove
 * @returns Patch operation
 * @throws Error if path or index is invalid
 */
export function opListRemoveAt(path: WisprPath, index: number): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opListRemoveAt: path must be a non-empty array of strings or numbers");
	}
	if (typeOf(index) !== "number" || index < 0 || index !== math.floor(index)) {
		error("[Wispr] opListRemoveAt: index must be a non-negative integer");
	}
	return { type: "listRemoveAt", path, index };
}

/**
 * Create a "mapSet" patch operation.
 *
 * @param pathToMap - Path to the map
 * @param id - Key in the map
 * @param value - Value to set
 * @returns Patch operation
 * @throws Error if pathToMap or id is invalid
 */
export function opMapSet(pathToMap: WisprPath, id: string, value: unknown): WisprPatchOp {
	if (!isValidPath(pathToMap)) {
		error("[Wispr] opMapSet: pathToMap must be a non-empty array of strings or numbers");
	}
	if (typeOf(id) !== "string" || id === "") {
		error("[Wispr] opMapSet: id must be a non-empty string");
	}
	return { type: "mapSet", pathToMap, id, value };
}

/**
 * Create a "mapDelete" patch operation.
 *
 * @param pathToMap - Path to the map
 * @param id - Key in the map to delete
 * @returns Patch operation
 * @throws Error if pathToMap or id is invalid
 */
export function opMapDelete(pathToMap: WisprPath, id: string): WisprPatchOp {
	if (!isValidPath(pathToMap)) {
		error("[Wispr] opMapDelete: pathToMap must be a non-empty array of strings or numbers");
	}
	if (typeOf(id) !== "string" || id === "") {
		error("[Wispr] opMapDelete: id must be a non-empty string");
	}
	return { type: "mapDelete", pathToMap, id };
}
