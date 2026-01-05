/**
 * Wispr client bootstrap and node registry.
 *
 * WisprClient manages:
 * - Initial data requests
 * - Node creation/destruction
 * - Patch application
 * - Node lookup
 *
 * Usage:
 * ```ts
 * await WisprClient.requestInitialData();
 * const node = await WisprClient.waitForNode(PLAYER_STATS);
 * ```
 */

// import { Players } from "@rbxts/services";
import type { WisprMessage, WisprCreateMessage, WisprDestroyMessage, WisprPatch } from "./WisprTypes";
import { WisprToken } from "./WisprToken";
import { WisprNode } from "./WisprNode";
import { getRemoteFunction, getRemoteEvent, WISPR_REMOTES } from "./WisprRemotes";

/**
 * Global client registry for Wispr nodes.
 */
class WisprClientRegistry {
	private readonly nodes = new Map<string, WisprNode>();
	private readonly nodeWaiters = new Map<string, Array<(node: WisprNode) => void>>();
	private readonly patternListeners = new Map<string, Array<(node: WisprNode) => void>>();
	private readonly stateUpdateRemote: RemoteEvent;
	private isInitialized = false;

	constructor() {
		this.stateUpdateRemote = getRemoteEvent(WISPR_REMOTES.STATE_UPDATES);
		this.setupMessageHandler();
	}

	/**
	 * Request initial data from the server.
	 * Should be called once during client bootstrap.
	 *
	 * @returns Promise that resolves when initial data is received
	 * @throws Error if initialization fails
	 */
	public async requestInitialData(): Promise<void> {
		if (this.isInitialized) {
			warn("[WisprClient] Already initialized");
			return;
		}

		try {
			const remoteFunction = getRemoteFunction(WISPR_REMOTES.REQUEST_INITIAL_DATA);
			if (!remoteFunction) {
				error("[WisprClient] Failed to get remote function");
			}

			const [success, messages] = pcall(() => {
				return remoteFunction.InvokeServer();
			});

			if (!success) {
				warn(`[WisprClient] Failed to request initial data: ${tostring(messages)}`);
				return;
			}

			// Process initial create messages
			if (typeIs(messages, "table")) {
				const messageArray = messages as WisprMessage[];
				for (let i = 0; i < messageArray.size(); i++) {
					const message = messageArray[i];
					try {
						this.handleMessage(message);
					} catch (err) {
						warn(`[WisprClient] Error processing message ${i}: ${err}`);
					}
				}
			} else {
				warn(`[WisprClient] Received invalid initial data type: ${typeOf(messages as unknown)}`);
			}

			this.isInitialized = true;
			print("[WisprClient] Initialized");
		} catch (err) {
			error(`[WisprClient] Failed to initialize: ${err}`);
		}
	}

	/**
	 * Wait for a node with the given token to be created.
	 * Resolves immediately if the node already exists.
	 *
	 * @param token - Token to wait for
	 * @returns Promise that resolves with the node
	 * @throws Error if token is invalid
	 */
	public async waitForNode<T>(token: WisprToken<T>): Promise<WisprNode<T>> {
		if (!token) {
			error("[WisprClient] Token cannot be nil");
		}

		// Check if node already exists
		const existing = this.nodes.get(token.id);
		if (existing) {
			return existing as WisprNode<T>;
		}

		// Wait for node creation
		return new Promise<WisprNode<T>>((resolve, reject) => {
			let waiters = this.nodeWaiters.get(token.id);
			if (!waiters) {
				waiters = [];
				this.nodeWaiters.set(token.id, waiters);
			}
			waiters.push((node) => {
				if (node) {
					resolve(node as WisprNode<T>);
				} else {
					reject(`[WisprClient] Node creation failed for token: ${token.id}`);
				}
			});
		});
	}

	/**
	 * Get a node by token (returns undefined if not found).
	 *
	 * @param token - Token to look up
	 * @returns Node if found, undefined otherwise
	 */
	public getNode<T>(token: WisprToken<T>): WisprNode<T> | undefined {
		return this.nodes.get(token.id) as WisprNode<T> | undefined;
	}

	/**
	 * Listen for when nodes matching a token ID pattern are created.
	 * Similar to ReplicaService's ReplicaOfClassCreated.
	 *
	 * @param pattern - Token ID pattern to match (e.g., "player." to match "player.123", "player.456", etc.)
	 * @param callback - Function to call when a matching node is created
	 * @returns Disconnect function
	 *
	 * @example
	 * ```ts
	 * onNodeOfClassCreated("player.", (node) => {
	 *   print(`Player node created: ${node.token.id}`);
	 * });
	 * ```
	 */
	public onNodeOfClassCreated(pattern: string, callback: (node: WisprNode) => void): () => void {
		if (typeOf(pattern) !== "string" || pattern === "") {
			error("[WisprClient] Pattern must be a non-empty string");
		}
		if (typeOf(callback) !== "function") {
			error("[WisprClient] Callback must be a function");
		}

		// Store listener
		let listeners = this.patternListeners.get(pattern);
		if (!listeners) {
			listeners = [];
			this.patternListeners.set(pattern, listeners);
		}
		listeners.push(callback);

		// Check existing nodes that match the pattern
		for (const [, node] of this.nodes) {
			if (node.token.id.sub(1, pattern.size()) === pattern) {
				// Check if the node's token ID matches the pattern
				try {
					callback(node);
				} catch (err) {
					warn(`[WisprClient] Error in pattern listener for existing node: ${err}`);
				}
			}
		}

		// Return disconnect function
		return () => {
			const listenerArray = this.patternListeners.get(pattern);
			if (listenerArray) {
				const index = listenerArray.indexOf(callback);
				if (index !== -1) {
					listenerArray.remove(index);
				}
				if (listenerArray.size() === 0) {
					this.patternListeners.delete(pattern);
				}
			}
		};
	}

	/**
	 * Handle incoming messages from the server.
	 *
	 * @param message - Message to handle
	 * @throws Error if message is invalid
	 */
	private handleMessage(message: WisprMessage): void {
		if (!message || typeOf(message) !== "table") {
			error("[WisprClient] Message cannot be nil and must be a table");
		}
		if (!("tokenId" in message) || typeOf(message.tokenId) !== "string") {
			error("[WisprClient] Message must have a tokenId string property");
		}

		if ("snapshot" in message) {
			// Create message
			this.handleCreate(message as WisprCreateMessage);
		} else if ("tokenId" in message && "version" in message && "operations" in message) {
			// Patch message
			this.handlePatch(message as WisprPatch);
		} else if ("tokenId" in message && !("version" in message)) {
			// Destroy message
			this.handleDestroy(message as WisprDestroyMessage);
		} else {
			warn(`[WisprClient] Unknown message type for token: ${message.tokenId}`);
		}
	}

	/**
	 * Handle node creation message.
	 *
	 * @param message - Create message to handle
	 * @throws Error if message is invalid
	 */
	private handleCreate(message: WisprCreateMessage): void {
		if (!message.snapshot || typeOf(message.snapshot) !== "table") {
			error("[WisprClient] Create message must have a snapshot");
		}
		if (message.tokenId !== message.snapshot.tokenId) {
			error(
				`[WisprClient] Create message tokenId (${message.tokenId}) does not match snapshot tokenId (${message.snapshot.tokenId})`,
			);
		}

		// Check if node already exists (shouldn't happen, but be safe)
		const existing = this.nodes.get(message.tokenId);
		if (existing) {
			try {
				existing.applySnapshot(message.snapshot);
			} catch (err) {
				warn(`[WisprClient] Error applying snapshot to existing node: ${err}`);
			}
			return;
		}

		// Create new node
		try {
			const token = { id: message.tokenId } as WisprToken;
			const node = new WisprNode(token, message.snapshot);
			this.nodes.set(message.tokenId, node);

			// Resolve any waiters
			const waiters = this.nodeWaiters.get(message.tokenId);
			if (waiters) {
				for (const waiter of waiters) {
					try {
						waiter(node);
					} catch (err) {
						warn(`[WisprClient] Error in node waiter: ${err}`);
					}
				}
				this.nodeWaiters.delete(message.tokenId);
			}

			// Fire pattern listeners
			for (const [pattern, listeners] of this.patternListeners) {
				if (message.tokenId.sub(1, pattern.size()) === pattern) {
					for (const listener of listeners) {
						try {
							listener(node);
						} catch (err) {
							warn(`[WisprClient] Error in pattern listener: ${err}`);
						}
					}
				}
			}
		} catch (err) {
			error(`[WisprClient] Failed to create node ${message.tokenId}: ${err}`);
		}
	}

	/**
	 * Handle patch message.
	 */
	private handlePatch(patch: WisprPatch): void {
		if (!patch || typeOf(patch) !== "table") {
			warn("[WisprClient] Patch message cannot be nil and must be a table");
			return;
		}
		if (!("tokenId" in patch) || typeOf(patch.tokenId) !== "string") {
			warn("[WisprClient] Patch must have a tokenId string property");
			return;
		}
		if (!("version" in patch) || typeOf(patch.version) !== "number" || patch.version < 0) {
			warn(`[WisprClient] Patch version must be a non-negative number, got: ${typeOf(patch.version)}`);
			return;
		}
		if (!("operations" in patch) || !typeIs(patch.operations, "table")) {
			warn("[WisprClient] Patch must have an operations array");
			return;
		}

		const node = this.nodes.get(patch.tokenId);
		if (!node) {
			warn(`[WisprClient] Received patch for unknown node: ${patch.tokenId}`);
			return;
		}

		try {
			node.applyPatch(patch);
		} catch (err) {
			warn(`[WisprClient] Failed to apply patch to node ${patch.tokenId}: ${err}`);
		}
	}

	/**
	 * Handle node destruction message.
	 */
	private handleDestroy(message: WisprDestroyMessage): void {
		const node = this.nodes.get(message.tokenId);
		if (!node) {
			return;
		}

		node.destroy();
		this.nodes.delete(message.tokenId);
	}

	/**
	 * Setup handler for ongoing state updates.
	 */
	private setupMessageHandler(): void {
		if (!this.stateUpdateRemote) {
			error("[WisprClient] Failed to get state update remote");
		}
		this.stateUpdateRemote.OnClientEvent.Connect((message: WisprMessage) => {
			try {
				this.handleMessage(message);
			} catch (err) {
				warn(`[WisprClient] Error handling message: ${err}`);
			}
		});
	}

	/**
	 * Get all registered nodes (for debugging).
	 */
	public getAllNodes(): WisprNode[] {
		const result: WisprNode[] = [];
		for (const [, node] of this.nodes) {
			result.push(node);
		}
		return result;
	}
}

// Global client instance
let clientInstance: WisprClientRegistry | undefined;

/**
 * Get or create the global WisprClient instance.
 */
export function getWisprClient(): WisprClientRegistry {
	if (!clientInstance) {
		clientInstance = new WisprClientRegistry();
	}
	return clientInstance;
}

/**
 * Request initial data from the server.
 * Must be called once during client bootstrap.
 */
export async function requestInitialData(): Promise<void> {
	return getWisprClient().requestInitialData();
}

/**
 * Wait for a node with the given token to be created.
 */
export async function waitForNode<T>(token: WisprToken<T>): Promise<WisprNode<T>> {
	return getWisprClient().waitForNode(token);
}

/**
 * Get a node by token (returns undefined if not found).
 */
export function getNode<T>(token: WisprToken<T>): WisprNode<T> | undefined {
	return getWisprClient().getNode(token);
}

/**
 * Listen for when nodes matching a token ID pattern are created.
 * Similar to ReplicaService's ReplicaOfClassCreated.
 *
 * @param pattern - Token ID pattern to match (e.g., "player." to match "player.123", "player.456", etc.)
 * @param callback - Function to call when a matching node is created
 * @returns Disconnect function
 *
 * @example
 * ```ts
 * onNodeOfClassCreated("player.", (node) => {
 *   print(`Player node created: ${node.token.id}`);
 * });
 * ```
 */
export function onNodeOfClassCreated(pattern: string, callback: (node: WisprNode) => void): () => void {
	return getWisprClient().onNodeOfClassCreated(pattern, callback);
}
