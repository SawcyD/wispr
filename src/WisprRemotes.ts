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
	 * RemoteEvent for receiving state updates from server.
	 * Server sends: create, patch, destroy messages.
	 */
	STATE_UPDATES: "WisprStateUpdates",
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
		const blinkPath = runService.IsServer()
			? config.serverBlinkPath
			: config.clientBlinkPath;

		if (blinkPath) {
			const [success, blinkModule] = pcall(() => {
				// Type assertion: require() accepts string paths at runtime in roblox-ts
				return require(blinkPath as unknown as ModuleScript) as Record<string, unknown>;
			});

			if (success && blinkModule) {
				const blinkName = getBlinkRemoteName(name);
				const blinkRemote = blinkModule[blinkName];

				if (blinkRemote) {
					return blinkRemote as RemoteFunction;
				} else {
					warn(
						`[WisprRemotes] Blink remote function "${blinkName}" not found in module. Falling back to standard RemoteFunction.`,
					);
				}
			} else {
				warn(
					`[WisprRemotes] Failed to require Blink module at "${blinkPath}". Falling back to standard RemoteFunction.`,
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
		const blinkPath = runService.IsServer()
			? config.serverBlinkPath
			: config.clientBlinkPath;

		if (blinkPath) {
			const [success, blinkModule] = pcall(() => {
				// Type assertion: require() accepts string paths at runtime in roblox-ts
				return require(blinkPath as unknown as ModuleScript) as Record<string, unknown>;
			});

			if (success && blinkModule) {
				const blinkName = getBlinkRemoteName(name);
				const blinkRemote = blinkModule[blinkName];

				if (blinkRemote) {
					return blinkRemote as RemoteEvent;
				} else {
					warn(
						`[WisprRemotes] Blink remote event "${blinkName}" not found in module. Falling back to standard RemoteEvent.`,
					);
				}
			} else {
				warn(
					`[WisprRemotes] Failed to require Blink module at "${blinkPath}". Falling back to standard RemoteEvent.`,
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
