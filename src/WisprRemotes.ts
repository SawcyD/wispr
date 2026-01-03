/**
 * Centralized remote definitions for Wispr networking.
 *
 * All remote names are defined here to avoid magic strings.
 * Remotes are created lazily on first access.
 */

/**
 * Remote names used by Wispr.
 */
export const WISPR_REMOTES = {
	/**
	 * RemoteFunction for requesting initial snapshot data.
	 * Client calls this once on bootstrap.
	 */
	REQUEST_INITIAL_DATA: "WisprRequestInitialData",

	/**
	 * RemoteEvent for receiving state updates from server.
	 * Server sends: create, patch, destroy messages.
	 */
	STATE_UPDATES: "WisprStateUpdates",
} as const;

/**
 * Get or create a RemoteFunction by name.
 */
export function getRemoteFunction(name: string): RemoteFunction {
	const replicatedStorage = game.GetService("ReplicatedStorage");
	let remote = replicatedStorage.FindFirstChild(name) as RemoteFunction | undefined;

	if (!remote) {
		remote = new Instance("RemoteFunction");
		remote.Name = name;
		remote.Parent = replicatedStorage;
	}

	return remote;
}

/**
 * Get or create a RemoteEvent by name.
 */
export function getRemoteEvent(name: string): RemoteEvent {
	const replicatedStorage = game.GetService("ReplicatedStorage");
	let remote = replicatedStorage.FindFirstChild(name) as RemoteEvent | undefined;

	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = name;
		remote.Parent = replicatedStorage;
	}

	return remote;
}

/**
 * Initialize Wispr remotes (creates them if they don't exist).
 * Should be called once on server startup.
 */
export function initializeRemotes(): void {
	const runService = game.GetService("RunService");
	if (runService.IsServer()) {
		getRemoteFunction(WISPR_REMOTES.REQUEST_INITIAL_DATA);
		getRemoteEvent(WISPR_REMOTES.STATE_UPDATES);
	}
}
