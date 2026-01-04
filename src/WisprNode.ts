/**
 * Client-side readonly Wispr node.
 *
 * WisprNode represents a replicated state tree on the client.
 * It is:
 * - Read-only (clients cannot mutate state)
 * - Versioned (tracks patch versions)
 * - Observable (fires change events)
 *
 * Nodes are created by the server and received via network messages.
 * Clients apply patches incrementally to keep state in sync.
 */

import type {
	WisprAnyChangeCallback,
	WisprChangeCallback,
	WisprPath,
	WisprRawPatchCallback,
	WisprSnapshot,
	WisprPatch,
} from "./WisprTypes";
import { WisprToken } from "./WisprToken";
import { getValueAtPath, isValidPath } from "./WisprPath";
import { applyPatch } from "./WisprPatch";
import { WisprSignal } from "./WisprSignal";
import { WisprMaid } from "./WisprMaid";

/**
 * Client-side readonly node for replicated state.
 *
 * Nodes are created by the server and synchronized via patches.
 * Clients can read state and listen for changes, but cannot mutate.
 */
export class WisprNode<T = unknown> {
	private state: T;
	private version: number;
	private readonly changeSignals = new Map<string, WisprSignal<[unknown, unknown]>>();
	private readonly anyChangeSignal = new WisprSignal<void>();
	private readonly rawPatchSignal = new WisprSignal<WisprPatch>();
	private readonly maid = new WisprMaid();

	/**
	 * Create a new client node from an initial snapshot.
	 *
	 * @param token - Token identifying this node
	 * @param snapshot - Initial snapshot data
	 * @throws Error if token or snapshot is invalid
	 */
	constructor(
		public readonly token: WisprToken<T>,
		snapshot: WisprSnapshot,
	) {
		if (!token) {
			error("[WisprNode] Token cannot be nil");
		}
		if (!snapshot || typeOf(snapshot) !== "table") {
			error("[WisprNode] Snapshot cannot be nil and must be a table");
		}
		if (typeOf(snapshot.version) !== "number" || snapshot.version < 0) {
			error("[WisprNode] Snapshot version must be a non-negative number");
		}
		if (snapshot.tokenId !== token.id) {
			error(`[WisprNode] Snapshot tokenId (${snapshot.tokenId}) does not match token id (${token.id})`);
		}
		this.state = snapshot.data as T;
		this.version = snapshot.version;
	}

	/**
	 * Get the current state snapshot.
	 * Returns a deep copy to prevent external mutation.
	 *
	 * @returns Current state
	 */
	public getState(): T {
		// Return a deep copy to prevent mutation
		return game.GetService("HttpService").JSONDecode(game.GetService("HttpService").JSONEncode(this.state)) as T;
	}

	/**
	 * Get a value at a specific path.
	 *
	 * @param path - Path to the value
	 * @returns Value at path, or undefined
	 * @throws Error if path is invalid
	 */
	public getValue(path: WisprPath): unknown {
		if (!isValidPath(path)) {
			error("[WisprNode] Invalid path: path must be a non-empty array of strings or numbers");
		}
		return getValueAtPath(this.state, path);
	}

	/**
	 * Get the current version of this node.
	 */
	public getVersion(): number {
		return this.version;
	}

	/**
	 * Apply a patch to this node.
	 * Called internally by WisprClient when receiving patches.
	 *
	 * @param patch - Patch to apply
	 * @returns true if patch was applied, false if version was too old
	 * @throws Error if patch is invalid
	 */
	public applyPatch(patch: WisprPatch): boolean {
		if (!patch || typeOf(patch) !== "table") {
			error("[WisprNode] Invalid patch: patch must be a table");
		}
		if (patch.tokenId !== this.token.id) {
			error(`[WisprNode] Patch tokenId (${patch.tokenId}) does not match node token id (${this.token.id})`);
		}

		// Ignore patches with lower or equal version
		if (patch.version <= this.version) {
			return false;
		}

		// Fire raw patch signal before applying
		this.rawPatchSignal.fire(patch);

		// Store old state for change detection
		const oldState = game
			.GetService("HttpService")
			.JSONDecode(game.GetService("HttpService").JSONEncode(this.state)) as T;

		// Apply patch operations
		try {
			applyPatch(this.state as Record<string | number, unknown>, patch);
		} catch (err) {
			error(`[WisprNode] Failed to apply patch: ${err}`);
		}

		// Update version
		this.version = patch.version;

		// Fire change signals for affected paths
		for (const operation of patch.operations) {
			// Get path based on operation type
			let path: WisprPath;
			if (operation.type === "mapSet" || operation.type === "mapDelete") {
				// For map operations, the path is pathToMap + id
				path = [...operation.pathToMap, operation.id];
			} else {
				// For other operations, use the path property
				path = operation.path;
			}

			if (isValidPath(path)) {
				const pathKey = this.pathToKey(path);
				const signal = this.changeSignals.get(pathKey);
				if (signal) {
					const newValue = getValueAtPath(this.state, path);
					const oldValue = getValueAtPath(oldState as Record<string | number, unknown>, path);
					if (newValue !== oldValue) {
						signal.fire([newValue, oldValue]);
					}
				}
			}
		}

		// Fire any change signal
		this.anyChangeSignal.fire();

		return true;
	}

	/**
	 * Apply a snapshot to this node.
	 * Called internally by WisprClient when receiving create messages.
	 *
	 * @param snapshot - Snapshot to apply
	 * @throws Error if snapshot is invalid
	 */
	public applySnapshot(snapshot: WisprSnapshot): void {
		if (!snapshot || typeOf(snapshot) !== "table") {
			error("[WisprNode] Snapshot cannot be nil and must be a table");
		}
		if (snapshot.tokenId !== this.token.id) {
			error(`[WisprNode] Snapshot tokenId (${snapshot.tokenId}) does not match node token id (${this.token.id})`);
		}
		if (typeOf(snapshot.version) !== "number" || snapshot.version < 0) {
			error("[WisprNode] Snapshot version must be a non-negative number");
		}

		// Snapshot always supersedes patches
		this.state = snapshot.data as T;
		this.version = snapshot.version;

		// Fire all change signals
		for (const [, signal] of this.changeSignals) {
			signal.fire([undefined, undefined]);
		}
		this.anyChangeSignal.fire();
	}

	/**
	 * Listen for changes at a specific path.
	 * Callback fires after patch application if the value actually changed.
	 *
	 * @param path - Path to watch
	 * @param callback - Function to call on change
	 * @returns Disconnect function
	 * @throws Error if path or callback is invalid
	 */
	public listenForChange(path: WisprPath, callback: WisprChangeCallback): () => void {
		if (!isValidPath(path)) {
			error("[WisprNode] Invalid path: path must be a non-empty array of strings or numbers");
		}
		if (typeOf(callback) !== "function") {
			error("[WisprNode] Callback must be a function");
		}

		const pathKey = this.pathToKey(path);
		let signal = this.changeSignals.get(pathKey);
		if (!signal) {
			signal = new WisprSignal<[unknown, unknown]>();
			this.changeSignals.set(pathKey, signal);
		}

		const disconnect = signal.connect(([newValue, oldValue]) => {
			callback(newValue, oldValue);
		});

		this.maid.giveTask(disconnect);
		return disconnect;
	}

	/**
	 * Listen for any change in this node.
	 * Callback fires after any patch application.
	 *
	 * @param callback - Function to call on change
	 * @returns Disconnect function
	 * @throws Error if callback is invalid
	 */
	public listenForAnyChange(callback: WisprAnyChangeCallback): () => void {
		if (typeOf(callback) !== "function") {
			error("[WisprNode] Callback must be a function");
		}
		const disconnect = this.anyChangeSignal.connect(callback);
		this.maid.giveTask(disconnect);
		return disconnect;
	}

	/**
	 * Listen for raw patches (dev/debug).
	 * Callback fires before patch application.
	 *
	 * @param callback - Function to call on patch
	 * @returns Disconnect function
	 * @throws Error if callback is invalid
	 */
	public listenForRawPatch(callback: WisprRawPatchCallback): () => void {
		if (typeOf(callback) !== "function") {
			error("[WisprNode] Callback must be a function");
		}
		const disconnect = this.rawPatchSignal.connect(callback);
		this.maid.giveTask(disconnect);
		return disconnect;
	}

	/**
	 * Destroy this node and clean up all listeners.
	 */
	public destroy(): void {
		this.maid.destroy();
		this.changeSignals.clear();
		this.anyChangeSignal.disconnectAll();
		this.rawPatchSignal.disconnectAll();
	}

	/**
	 * Convert a path to a string key for signal lookup.
	 */
	private pathToKey(path: WisprPath): string {
		return path.map((key) => tostring(key)).join(".");
	}
}
