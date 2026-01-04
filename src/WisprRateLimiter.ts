/**
 * Rate limiter for protecting Wispr remotes from abuse.
 *
 * Tracks request timestamps and enforces cooldowns.
 * Used to prevent clients from spamming initial data requests.
 */

export class WisprRateLimiter {
	private readonly requestTimes = new Map<string, number[]>();
	private readonly maxRequests: number;
	private readonly windowSeconds: number;

	/**
	 * Create a new rate limiter.
	 *
	 * @param maxRequests - Maximum requests allowed
	 * @param windowSeconds - Time window in seconds
	 * @throws Error if parameters are invalid
	 */
	constructor(maxRequests: number, windowSeconds: number) {
		if (typeOf(maxRequests) !== "number" || maxRequests < 1) {
			error("[WisprRateLimiter] maxRequests must be a positive number");
		}
		if (typeOf(windowSeconds) !== "number" || windowSeconds <= 0) {
			error("[WisprRateLimiter] windowSeconds must be a positive number");
		}
		this.maxRequests = maxRequests;
		this.windowSeconds = windowSeconds;
	}

	/**
	 * Check if a request from the given identifier should be allowed.
	 *
	 * @param identifier - Unique identifier (e.g., player userId)
	 * @returns true if request is allowed, false if rate limited
	 * @throws Error if identifier is invalid
	 */
	public canRequest(identifier: string): boolean {
		if (typeOf(identifier) !== "string" || identifier === "") {
			error("[WisprRateLimiter] identifier must be a non-empty string");
		}

		const now = tick();
		const times = this.requestTimes.get(identifier) || [];
		const windowStart = now - this.windowSeconds;

		// Remove old requests outside the window
		const recentTimes = times.filter((time) => time > windowStart);

		if (recentTimes.size() >= this.maxRequests) {
			return false;
		}

		// Add current request
		recentTimes.push(now);
		this.requestTimes.set(identifier, recentTimes);

		return true;
	}

	/**
	 * Reset rate limit for a specific identifier.
	 *
	 * @param identifier - Identifier to reset
	 * @throws Error if identifier is invalid
	 */
	public reset(identifier: string): void {
		if (typeOf(identifier) !== "string") {
			error("[WisprRateLimiter] identifier must be a string");
		}
		this.requestTimes.delete(identifier);
	}

	/**
	 * Clear all rate limit data.
	 */
	public clear(): void {
		this.requestTimes.clear();
	}
}
