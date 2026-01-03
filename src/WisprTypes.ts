/**
 * Core type definitions for Wispr state replication system.
 *
 * Wispr provides server-authoritative, snapshot + patch based state replication.
 * All state mutations happen on the server; clients receive read-only mirrors.
 */

/**
 * A path in the state tree.
 *
 * Paths are arrays of keys, never strings.
 * - string keys access object properties
 * - number keys access array indices
 *
 * Examples:
 * - ["inventory", "gold"] → state.inventory.gold
 * - ["inventory", "items", "sword_001"] → state.inventory.items["sword_001"]
 * - ["weapons", 0, "cooldown"] → state.weapons[0].cooldown
 *
 * Why arrays instead of strings?
 * - No parsing overhead
 * - Type-safe key access
 * - Clear intent (object vs array)
 * - No ambiguity with dots in keys
 */
export type WisprPath = ReadonlyArray<string | number>;

/**
 * Unique identifier for a Wispr token.
 * Tokens are created once and never change meaning.
 */
export type WisprTokenId = string;

/**
 * Replication scope determines which clients receive state updates.
 */
export type WisprScope = { kind: "all" } | { kind: "player"; player: Player } | { kind: "players"; players: Player[] };

/**
 * Patch operation type.
 * Patches are the only way state changes are communicated to clients.
 */
export type WisprPatchOp =
	| { type: "set"; path: WisprPath; value: unknown }
	| { type: "delete"; path: WisprPath }
	| { type: "increment"; path: WisprPath; delta: number }
	| { type: "listPush"; path: WisprPath; value: unknown }
	| { type: "listInsert"; path: WisprPath; index: number; value: unknown }
	| { type: "listRemoveAt"; path: WisprPath; index: number }
	| { type: "mapSet"; pathToMap: WisprPath; id: string; value: unknown }
	| { type: "mapDelete"; pathToMap: WisprPath; id: string };

/**
 * A patch message sent from server to client.
 * Contains version and operations to apply.
 */
export interface WisprPatch {
	readonly tokenId: WisprTokenId;
	readonly version: number;
	readonly operations: readonly WisprPatchOp[];
}

/**
 * Initial snapshot sent to client when node is created.
 */
export interface WisprSnapshot {
	readonly tokenId: WisprTokenId;
	readonly version: number;
	readonly data: unknown;
}

/**
 * Node creation message sent from server to client.
 */
export interface WisprCreateMessage {
	readonly tokenId: WisprTokenId;
	readonly snapshot: WisprSnapshot;
}

/**
 * Node destruction message sent from server to client.
 */
export interface WisprDestroyMessage {
	readonly tokenId: WisprTokenId;
}

/**
 * Network message types.
 */
export type WisprMessage = WisprCreateMessage | WisprPatch | WisprDestroyMessage;

/**
 * Callback for path-specific change notifications.
 * Fired after patch application if the value at the path actually changed.
 */
export type WisprChangeCallback = (newValue: unknown, oldValue: unknown) => void;

/**
 * Callback for any change in the node.
 * Fired after any patch application.
 */
export type WisprAnyChangeCallback = () => void;

/**
 * Callback for raw patch notifications (dev/debug).
 * Fired before patch application.
 */
export type WisprRawPatchCallback = (patch: WisprPatch) => void;
