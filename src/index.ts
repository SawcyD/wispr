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

/**
 * Create a "set" patch operation.
 */
export function opSet(path: WisprPath, value: unknown): WisprPatchOp {
	return { type: "set", path, value };
}

/**
 * Create a "delete" patch operation.
 */
export function opDelete(path: WisprPath): WisprPatchOp {
	return { type: "delete", path };
}

/**
 * Create an "increment" patch operation.
 */
export function opIncrement(path: WisprPath, delta: number): WisprPatchOp {
	return { type: "increment", path, delta };
}

/**
 * Create a "listPush" patch operation.
 */
export function opListPush(path: WisprPath, value: unknown): WisprPatchOp {
	return { type: "listPush", path, value };
}

/**
 * Create a "listInsert" patch operation.
 */
export function opListInsert(path: WisprPath, index: number, value: unknown): WisprPatchOp {
	return { type: "listInsert", path, index, value };
}

/**
 * Create a "listRemoveAt" patch operation.
 */
export function opListRemoveAt(path: WisprPath, index: number): WisprPatchOp {
	return { type: "listRemoveAt", path, index };
}

/**
 * Create a "mapSet" patch operation.
 */
export function opMapSet(pathToMap: WisprPath, id: string, value: unknown): WisprPatchOp {
	return { type: "mapSet", pathToMap, id, value };
}

/**
 * Create a "mapDelete" patch operation.
 */
export function opMapDelete(pathToMap: WisprPath, id: string): WisprPatchOp {
	return { type: "mapDelete", pathToMap, id };
}
