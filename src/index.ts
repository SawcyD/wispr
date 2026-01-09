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
	WisprStateUpdateMessage,
} from "./WisprTypes";

// Token system
export { WisprToken } from "./WisprToken";

// Path utilities
export { pathOf, isValidPath, getValueAtPath, setValueAtPath, deleteValueAtPath } from "./WisprPath";

// Patch operations
export { applyPatch, applyPatchOperation } from "./WisprPatch";

// Remotes
export {
	getRemoteFunction,
	getRemoteEvent,
	getUnreliableRemoteEvent,
	WISPR_REMOTES,
	initializeRemotes,
} from "./WisprRemotes";

// Blink integration
export { configureBlink } from "./WisprBlinkConfig";
export type { WisprBlinkConfig, BlinkCasing } from "./WisprBlinkConfig";

// Client API
export { WisprNode } from "./WisprNode";
export { requestInitialData, waitForNode, getNode as getClientNode, onNodeOfClassCreated } from "./WisprClient";

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

/**
 * Create a "set" patch operation (unreliable - best effort delivery).
 * Use for frequent updates where only the latest value matters (e.g., positions).
 *
 * @param path - Path to set
 * @param value - Value to set
 * @returns Unreliable patch operation
 * @throws Error if path is invalid
 */
export function opSetUnreliable(path: WisprPath, value: unknown): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opSetUnreliable: path must be a non-empty array of strings or numbers");
	}
	return { type: "set", path, value, reliability: "unreliable" };
}

/**
 * Create a "set" patch operation (reliable - guaranteed delivery).
 * Use for important updates that must not be lost (e.g., inventory changes).
 *
 * @param path - Path to set
 * @param value - Value to set
 * @returns Reliable patch operation
 * @throws Error if path is invalid
 */
export function opSetReliable(path: WisprPath, value: unknown): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opSetReliable: path must be a non-empty array of strings or numbers");
	}
	return { type: "set", path, value, reliability: "reliable" };
}

/**
 * Create an "increment" patch operation (unreliable).
 * Use for frequent updates where only the latest value matters.
 *
 * @param path - Path to increment
 * @param delta - Amount to increment by
 * @returns Unreliable patch operation
 * @throws Error if path or delta is invalid
 */
export function opIncrementUnreliable(path: WisprPath, delta: number): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opIncrementUnreliable: path must be a non-empty array of strings or numbers");
	}
	if (typeOf(delta) !== "number") {
		error("[Wispr] opIncrementUnreliable: delta must be a number");
	}
	return { type: "increment", path, delta, reliability: "unreliable" };
}

/**
 * Create an "increment" patch operation (reliable).
 * Use for important updates that must not be lost.
 *
 * @param path - Path to increment
 * @param delta - Amount to increment by
 * @returns Reliable patch operation
 * @throws Error if path or delta is invalid
 */
export function opIncrementReliable(path: WisprPath, delta: number): WisprPatchOp {
	if (!isValidPath(path)) {
		error("[Wispr] opIncrementReliable: path must be a non-empty array of strings or numbers");
	}
	if (typeOf(delta) !== "number") {
		error("[Wispr] opIncrementReliable: delta must be a number");
	}
	return { type: "increment", path, delta, reliability: "reliable" };
}
