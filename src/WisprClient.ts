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
	 */
	public async requestInitialData(): Promise<void> {
		if (this.isInitialized) {
			warn("[WisprClient] Already initialized");
			return;
		}

		const remoteFunction = getRemoteFunction(WISPR_REMOTES.REQUEST_INITIAL_DATA);
		const [success, messages] = pcall(() => {
			return remoteFunction.InvokeServer();
		});

		if (!success) {
			warn(`[WisprClient] Failed to request initial data: ${messages}`);
			return;
		}

		// Process initial create messages
		if (typeIs(messages, "table")) {
			const messageArray = messages as WisprMessage[];
			for (const message of messageArray) {
				this.handleMessage(message);
			}
		}

		this.isInitialized = true;
		print("[WisprClient] Initialized");
	}

	/**
	 * Wait for a node with the given token to be created.
	 * Resolves immediately if the node already exists.
	 *
	 * @param token - Token to wait for
	 * @returns Promise that resolves with the node
	 */
	public async waitForNode<T>(token: WisprToken<T>): Promise<WisprNode<T>> {
		// Check if node already exists
		const existing = this.nodes.get(token.id);
		if (existing) {
			return existing as WisprNode<T>;
		}

		// Wait for node creation
		return new Promise<WisprNode<T>>((resolve) => {
			let waiters = this.nodeWaiters.get(token.id);
			if (!waiters) {
				waiters = [];
				this.nodeWaiters.set(token.id, waiters);
			}
			waiters.push((node) => {
				resolve(node as WisprNode<T>);
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
	 * Handle incoming messages from the server.
	 */
	private handleMessage(message: WisprMessage): void {
		if ("snapshot" in message) {
			// Create message
			this.handleCreate(message as WisprCreateMessage);
		} else if ("tokenId" in message && "version" in message && "operations" in message) {
			// Patch message
			this.handlePatch(message as WisprPatch);
		} else if ("tokenId" in message && !("version" in message)) {
			// Destroy message
			this.handleDestroy(message as WisprDestroyMessage);
		}
	}

	/**
	 * Handle node creation message.
	 */
	private handleCreate(message: WisprCreateMessage): void {
		// Check if node already exists (shouldn't happen, but be safe)
		const existing = this.nodes.get(message.tokenId);
		if (existing) {
			existing.applySnapshot(message.snapshot);
			return;
		}

		// Create new node
		const token = { id: message.tokenId } as WisprToken;
		const node = new WisprNode(token, message.snapshot);
		this.nodes.set(message.tokenId, node);

		// Resolve any waiters
		const waiters = this.nodeWaiters.get(message.tokenId);
		if (waiters) {
			for (const waiter of waiters) {
				waiter(node);
			}
			this.nodeWaiters.delete(message.tokenId);
		}
	}

	/**
	 * Handle patch message.
	 */
	private handlePatch(patch: WisprPatch): void {
		const node = this.nodes.get(patch.tokenId);
		if (!node) {
			warn(`[WisprClient] Received patch for unknown node: ${patch.tokenId}`);
			return;
		}

		node.applyPatch(patch);
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
		this.stateUpdateRemote.OnClientEvent.Connect((message: WisprMessage) => {
			this.handleMessage(message);
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
