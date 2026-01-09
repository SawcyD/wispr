/**
 * Centralized remote definitions for Wispr networking.
 *
 * All remote names are defined here to avoid magic strings.
 * Remotes are created lazily on first access.
 *
 * Supports optional Blink integration for improved performance and security.
 * When Blink is enabled, uses Blink-generated remotes instead of standard Roblox remotes.
 */

import { isBlinkEnabled, getBlinkConfig, getBlinkRemoteName } from "./WisprBlinkConfig";

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
	 * RemoteEvent for receiving reliable state updates from server.
	 * Server sends: patches that must be guaranteed delivery.
	 * Message format: { tokenId: string, patch: WisprPatch }
	 */
	STATE_UPDATES_RELIABLE: "WisprStateUpdatesReliable",

	/**
	 * UnreliableRemoteEvent for receiving unreliable state updates from server.
	 * Server sends: patches that can be dropped (only latest value matters).
	 * Message format: { tokenId: string, patch: WisprPatch }
	 */
	STATE_UPDATES_UNRELIABLE: "WisprStateUpdatesUnreliable",
} as const;

/**
 * Get or create a RemoteFunction by name.
 * If Blink is enabled, uses Blink-generated wrapper.
 *
 * @param name - Name of the remote function
 * @returns The RemoteFunction instance
 * @throws Error if name is invalid
 */
export function getRemoteFunction(name: string): RemoteFunction {
	if (typeOf(name) !== "string" || name === "") {
		error("[WisprRemotes] Remote function name must be a non-empty string");
	}

	// Try Blink integration if enabled
	if (isBlinkEnabled()) {
		const config = getBlinkConfig();
		const runService = game.GetService("RunService");
		const blinkModule = runService.IsServer() ? config.serverBlinkModule : config.clientBlinkModule;

		if (blinkModule) {
			const blinkName = getBlinkRemoteName(name);
			const blinkRemote = blinkModule[blinkName];

			if (blinkRemote !== undefined) {
				return blinkRemote as RemoteFunction;
			} else {
				warn(
					`[WisprRemotes] Blink remote function "${blinkName}" not found in module. Falling back to standard RemoteFunction.`,
				);
			}
		}
	}

	// Fallback to standard RemoteFunction
	const replicatedStorage = game.GetService("ReplicatedStorage");
	if (!replicatedStorage) {
		error("[WisprRemotes] Failed to get ReplicatedStorage service");
	}

	let remote = replicatedStorage.FindFirstChild(name) as RemoteFunction | undefined;

	if (!remote) {
		remote = new Instance("RemoteFunction");
		remote.Name = name;
		remote.Parent = replicatedStorage;
	}

	if (!remote) {
		error(`[WisprRemotes] Failed to create RemoteFunction: ${name}`);
	}

	return remote;
}

/**
 * Get or create a RemoteEvent by name.
 * If Blink is enabled, uses Blink-generated wrapper.
 *
 * @param name - Name of the remote event
 * @returns The RemoteEvent instance
 * @throws Error if name is invalid
 */
export function getRemoteEvent(name: string): RemoteEvent {
	if (typeOf(name) !== "string" || name === "") {
		error("[WisprRemotes] Remote event name must be a non-empty string");
	}

	// Try Blink integration if enabled
	if (isBlinkEnabled()) {
		const config = getBlinkConfig();
		const runService = game.GetService("RunService");
		// Events are used on both client and server, but we need the appropriate module
		// Client listens to events from server, server fires events to clients
		const blinkModule = runService.IsServer() ? config.serverBlinkModule : config.clientBlinkModule;

		if (blinkModule) {
			const blinkName = getBlinkRemoteName(name);
			const blinkRemote = blinkModule[blinkName];

			if (blinkRemote !== undefined) {
				return blinkRemote as RemoteEvent;
			} else {
				warn(
					`[WisprRemotes] Blink remote event "${blinkName}" not found in module. Falling back to standard RemoteEvent.`,
				);
			}
		}
	}

	// Fallback to standard RemoteEvent
	const replicatedStorage = game.GetService("ReplicatedStorage");
	if (!replicatedStorage) {
		error("[WisprRemotes] Failed to get ReplicatedStorage service");
	}

	let remote = replicatedStorage.FindFirstChild(name) as RemoteEvent | undefined;

	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = name;
		remote.Parent = replicatedStorage;
	}

	if (!remote) {
		error(`[WisprRemotes] Failed to create RemoteEvent: ${name}`);
	}

	return remote;
}

/**
 * Get or create an UnreliableRemoteEvent by name.
 * If Blink is enabled, uses Blink-generated wrapper.
 *
 * @param name - Name of the unreliable remote event
 * @returns The UnreliableRemoteEvent instance
 * @throws Error if name is invalid
 */
export function getUnreliableRemoteEvent(name: string): UnreliableRemoteEvent {
	if (typeOf(name) !== "string" || name === "") {
		error("[WisprRemotes] Unreliable remote event name must be a non-empty string");
	}

	// Try Blink integration if enabled
	if (isBlinkEnabled()) {
		const config = getBlinkConfig();
		const runService = game.GetService("RunService");
		const blinkModule = runService.IsServer() ? config.serverBlinkModule : config.clientBlinkModule;

		if (blinkModule) {
			const blinkName = getBlinkRemoteName(name);
			const blinkRemote = blinkModule[blinkName];

			if (blinkRemote !== undefined) {
				return blinkRemote as UnreliableRemoteEvent;
			} else {
				warn(
					`[WisprRemotes] Blink unreliable remote event "${blinkName}" not found in module. Falling back to standard UnreliableRemoteEvent.`,
				);
			}
		}
	}

	// Fallback to standard UnreliableRemoteEvent
	const replicatedStorage = game.GetService("ReplicatedStorage");
	if (!replicatedStorage) {
		error("[WisprRemotes] Failed to get ReplicatedStorage service");
	}

	let remote = replicatedStorage.FindFirstChild(name) as UnreliableRemoteEvent | undefined;

	if (!remote) {
		remote = new Instance("UnreliableRemoteEvent");
		remote.Name = name;
		remote.Parent = replicatedStorage;
	}

	if (!remote) {
		error(`[WisprRemotes] Failed to create UnreliableRemoteEvent: ${name}`);
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
		getRemoteEvent(WISPR_REMOTES.STATE_UPDATES_RELIABLE);
		getUnreliableRemoteEvent(WISPR_REMOTES.STATE_UPDATES_UNRELIABLE);
	}
}
