/**
 * Wispr server authority and routing.
 *
 * WisprServer is the single source of truth for all replicated state.
 * It:
 * - Creates and manages nodes
 * - Enforces server authority (clients cannot mutate)
 * - Routes patches to appropriate clients based on scope
 * - Handles initial data requests
 *
 * Rules:
 * - Only the server can create nodes
 * - Only the server can mutate state
 * - Clients receive read-only mirrors
 * - Scopes determine visibility
 */

import type {
	WisprScope,
	WisprPatchOp,
	WisprSnapshot,
	WisprCreateMessage,
	WisprDestroyMessage,
	WisprPatch,
} from "./WisprTypes";
import { WisprToken } from "./WisprToken";
import { getRemoteFunction, getRemoteEvent, WISPR_REMOTES } from "./WisprRemotes";
import { WisprRateLimiter } from "./WisprRateLimiter";
import { applyPatchOperation } from "./WisprPatch";

/**
 * Server-side node that owns mutable state.
 *
 * Server nodes are the source of truth for replicated state.
 * They:
 * - Own mutable state
 * - Track version numbers
 * - Determine replication scope
 * - Emit patches when mutated
 */
export class WisprServerNode<T = unknown> {
	public readonly token: WisprToken<T>;
	public readonly scope: WisprScope;
	private state: T;
	private version: number;

	constructor(token: WisprToken<T>, scope: WisprScope, initialState: T) {
		this.token = token;
		this.scope = scope;
		this.state = initialState;
		this.version = 0;
	}

	/**
	 * Get current state (returns reference, not copy).
	 */
	public getState(): T {
		return this.state;
	}

	/**
	 * Get current version.
	 */
	public getVersion(): number {
		return this.version;
	}

	/**
	 * Apply a patch operation and increment version.
	 */
	public applyOperation(operation: WisprPatchOp): void {
		applyPatchOperation(this.state as Record<string | number, unknown>, operation);
		this.version++;
	}

	/**
	 * Create a snapshot of current state.
	 */
	public createSnapshot(): WisprSnapshot {
		return {
			tokenId: this.token.id,
			version: this.version,
			data: game.GetService("HttpService").JSONDecode(game.GetService("HttpService").JSONEncode(this.state)),
		};
	}

	/**
	 * Check if a player should see this node based on scope.
	 */
	public shouldReplicateTo(player: Player): boolean {
		if (this.scope.kind === "all") {
			return true;
		} else if (this.scope.kind === "player") {
			return this.scope.player === player;
		} else if (this.scope.kind === "players") {
			return this.scope.players.includes(player);
		}
		return false;
	}
}

/**
 * Global server registry for Wispr nodes.
 */
class WisprServerRegistry {
	private readonly nodes = new Map<string, WisprServerNode>();
	private readonly stateUpdateRemote: RemoteEvent;
	private readonly requestRemote: RemoteFunction;
	private readonly rateLimiter = new WisprRateLimiter(5, 10); // 5 requests per 10 seconds

	constructor() {
		this.stateUpdateRemote = getRemoteEvent(WISPR_REMOTES.STATE_UPDATES);
		this.requestRemote = getRemoteFunction(WISPR_REMOTES.REQUEST_INITIAL_DATA);
		this.setupRequestHandler();
	}

	/**
	 * Create a new node on the server.
	 *
	 * @param token - Token identifying the node
	 * @param scope - Replication scope
	 * @param initialState - Initial state value
	 * @returns The created node
	 */
	public createNode<T>(token: WisprToken<T>, scope: WisprScope, initialState: T): WisprServerNode<T> {
		if (this.nodes.has(token.id)) {
			error(`[WisprServer] Node with token ${token.id} already exists`);
		}

		const node = new WisprServerNode(token, scope, initialState);
		this.nodes.set(token.id, node);

		// Send create message to all relevant clients
		this.broadcastCreate(node);

		return node;
	}

	/**
	 * Get a node by token.
	 *
	 * @param token - Token to look up
	 * @returns Node if found, undefined otherwise
	 */
	public getNode<T>(token: WisprToken<T>): WisprServerNode<T> | undefined {
		return this.nodes.get(token.id) as WisprServerNode<T> | undefined;
	}

	/**
	 * Destroy a node and notify clients.
	 *
	 * @param token - Token of node to destroy
	 */
	public destroyNode(token: WisprToken<unknown>): void {
		const node = this.nodes.get(token.id);
		if (!node) {
			return;
		}

		// Store scope before deletion
		const scope = node.scope;

		// Send destroy message to all relevant clients (before deletion)
		this.broadcastDestroy(token, scope);

		// Delete node after broadcasting
		this.nodes.delete(token.id);
	}

	/**
	 * Apply a patch operation to a node and replicate to clients.
	 *
	 * @param token - Token of node to patch
	 * @param operation - Patch operation to apply
	 */
	public patchNode(token: WisprToken<unknown>, operation: WisprPatchOp): void {
		const node = this.nodes.get(token.id);
		if (!node) {
			error(`[WisprServer] Cannot patch non-existent node: ${token.id}`);
		}

		// Apply operation (increments version)
		node!.applyOperation(operation);

		// Create patch message
		const patch: WisprPatch = {
			tokenId: token.id,
			version: node!.getVersion(),
			operations: [operation],
		};

		// Broadcast to relevant clients
		this.broadcastPatch(node!, patch);
	}

	/**
	 * Apply multiple patch operations in a single patch.
	 *
	 * @param token - Token of node to patch
	 * @param operations - Patch operations to apply
	 */
	public patchNodeMultiple(token: WisprToken<unknown>, operations: readonly WisprPatchOp[]): void {
		const node = this.nodes.get(token.id);
		if (!node) {
			error(`[WisprServer] Cannot patch non-existent node: ${token.id}`);
		}

		// Apply all operations
		for (const operation of operations) {
			node!.applyOperation(operation);
		}

		// Create patch message
		const patch: WisprPatch = {
			tokenId: token.id,
			version: node!.getVersion(),
			operations: operations,
		};

		// Broadcast to relevant clients
		this.broadcastPatch(node!, patch);
	}

	/**
	 * Broadcast create message to relevant clients.
	 */
	private broadcastCreate(node: WisprServerNode): void {
		const message: WisprCreateMessage = {
			tokenId: node.token.id,
			snapshot: node.createSnapshot(),
		};

		if (node.scope.kind === "all") {
			this.stateUpdateRemote.FireAllClients(message);
		} else if (node.scope.kind === "player") {
			this.stateUpdateRemote.FireClient(node.scope.player, message);
		} else if (node.scope.kind === "players") {
			for (const player of node.scope.players) {
				this.stateUpdateRemote.FireClient(player, message);
			}
		}
	}

	/**
	 * Broadcast patch to relevant clients.
	 */
	private broadcastPatch(node: WisprServerNode, patch: WisprPatch): void {
		if (node.scope.kind === "all") {
			this.stateUpdateRemote.FireAllClients(patch);
		} else if (node.scope.kind === "player") {
			this.stateUpdateRemote.FireClient(node.scope.player, patch);
		} else if (node.scope.kind === "players") {
			for (const player of node.scope.players) {
				this.stateUpdateRemote.FireClient(player, patch);
			}
		}
	}

	/**
	 * Broadcast destroy message to relevant clients.
	 */
	private broadcastDestroy(token: WisprToken<unknown>, scope: WisprScope): void {
		const message: WisprDestroyMessage = {
			tokenId: token.id,
		};

		// Broadcast based on scope
		if (scope.kind === "all") {
			this.stateUpdateRemote.FireAllClients(message);
		} else if (scope.kind === "player") {
			this.stateUpdateRemote.FireClient(scope.player, message);
		} else if (scope.kind === "players") {
			for (const player of scope.players) {
				this.stateUpdateRemote.FireClient(player, message);
			}
		}
	}

	/**
	 * Handle initial data request from client.
	 */
	private handleInitialDataRequest(player: Player): WisprCreateMessage[] {
		// Rate limit check
		const identifier = tostring(player.UserId);
		if (!this.rateLimiter.canRequest(identifier)) {
			warn(`[WisprServer] Rate limited initial data request from ${player.Name}`);
			return [];
		}

		// Collect all nodes this player should see
		const messages: WisprCreateMessage[] = [];
		for (const [, node] of this.nodes) {
			if (node.shouldReplicateTo(player)) {
				messages.push({
					tokenId: node.token.id,
					snapshot: node.createSnapshot(),
				});
			}
		}

		return messages;
	}

	/**
	 * Setup handler for initial data requests.
	 */
	private setupRequestHandler(): void {
		this.requestRemote.OnServerInvoke = (player: Player) => {
			return this.handleInitialDataRequest(player);
		};
	}

	/**
	 * Get all nodes (for debugging).
	 */
	public getAllNodes(): WisprServerNode[] {
		const result: WisprServerNode[] = [];
		for (const [, node] of this.nodes) {
			result.push(node);
		}
		return result;
	}
}

// Global server instance
let serverInstance: WisprServerRegistry | undefined;

/**
 * Get or create the global WisprServer instance.
 */
export function getWisprServer(): WisprServerRegistry {
	if (!serverInstance) {
		serverInstance = new WisprServerRegistry();
	}
	return serverInstance;
}

/**
 * Create a new node on the server.
 */
export function createNode<T>(token: WisprToken<T>, scope: WisprScope, initialState: T): WisprServerNode<T> {
	return getWisprServer().createNode(token, scope, initialState);
}

/**
 * Get a node by token.
 */
export function getNode<T>(token: WisprToken<T>): WisprServerNode<T> | undefined {
	return getWisprServer().getNode(token);
}

/**
 * Destroy a node.
 */
export function destroyNode(token: WisprToken<unknown>): void {
	return getWisprServer().destroyNode(token);
}

/**
 * Apply a patch operation to a node.
 */
export function patchNode(token: WisprToken<unknown>, operation: WisprPatchOp): void {
	return getWisprServer().patchNode(token, operation);
}

/**
 * Apply multiple patch operations to a node.
 */
export function patchNodeMultiple(token: WisprToken<unknown>, operations: readonly WisprPatchOp[]): void {
	return getWisprServer().patchNodeMultiple(token, operations);
}
