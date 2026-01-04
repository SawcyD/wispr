/**
 * Wispr Token system for type-safe state replication.
 *
 * Tokens are created once and never change meaning.
 * They provide:
 * - Type safety for state shape
 * - Unique identification
 * - Namespace organization
 *
 * Token IDs follow the pattern: "namespace.key"
 * Examples:
 * - "player.stats"
 * - "player.settings"
 * - "game.inventory"
 *
 * Rules:
 * - Create tokens once at module level
 * - Use flat string IDs (no nested objects)
 * - Never mutate token definitions
 */

import type { WisprTokenId } from "./WisprTypes";

/**
 * A Wispr token that identifies and types a replicated state node.
 *
 * Tokens are created via WisprToken.create<T>() and used to:
 * - Create server nodes
 * - Wait for client nodes
 * - Type-check state access
 */
export class WisprToken<T = unknown> {
	private constructor(public readonly id: WisprTokenId) {}

	/**
	 * Create a new Wispr token with a unique ID.
	 *
	 * @param id - Unique identifier (e.g., "player.stats")
	 * @returns A typed token instance
	 *
	 * @example
	 * ```ts
	 * export const PLAYER_STATS = WisprToken.create<PlayerStats>("player.stats");
	 * ```
	 * @throws Error if id is empty or invalid
	 */
	public static create<T = unknown>(id: WisprTokenId): WisprToken<T> {
		if (typeOf(id) !== "string") {
			error("[WisprToken] Token ID must be a string");
		}
		if (id === "" || id.size() === 0) {
			error("[WisprToken] Token ID cannot be empty");
		}
		return new WisprToken<T>(id);
	}

	/**
	 * Check if two tokens are equal (same ID).
	 *
	 * @param other - Token to compare with
	 * @returns true if tokens have the same ID
	 * @throws Error if other is invalid
	 */
	public equals(other: WisprToken<unknown>): boolean {
		if (!other) {
			error("[WisprToken] Cannot compare with nil token");
		}
		if (typeOf(other) !== "table" || !("id" in other)) {
			error("[WisprToken] Invalid token for comparison");
		}
		return this.id === other.id;
	}
}
