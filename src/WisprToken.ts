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
	 */
	public static create<T = unknown>(id: WisprTokenId): WisprToken<T> {
		return new WisprToken<T>(id);
	}

	/**
	 * Check if two tokens are equal (same ID).
	 */
	public equals(other: WisprToken<unknown>): boolean {
		return this.id === other.id;
	}
}
