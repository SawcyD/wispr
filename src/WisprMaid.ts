/**
 * Lifecycle cleanup utility for Wispr.
 *
 * WisprMaid manages cleanup tasks (disconnections, destroys, etc.)
 * Similar to Roblox's Maid pattern, but simpler and explicit.
 *
 * Usage:
 * ```ts
 * const maid = new WisprMaid();
 * maid.giveTask(() => connection.disconnect());
 * maid.giveTask(signal.connect(callback));
 * // Later: maid.destroy() cleans up everything
 * ```
 */

export class WisprMaid {
	private readonly tasks = new Set<() => void>();

	/**
	 * Give a cleanup task to the maid.
	 * The task will be called when destroy() is invoked.
	 *
	 * @param task - Cleanup function or object with destroy() method
	 */
	public giveTask(task: (() => void) | { destroy(): void }): void {
		if (typeOf(task) === "function") {
			this.tasks.add(task as () => void);
		} else {
			this.tasks.add(() => {
				(task as { destroy(): void }).destroy();
			});
		}
	}

	/**
	 * Execute all cleanup tasks and clear the maid.
	 * Safe to call multiple times.
	 */
	public destroy(): void {
		for (const task of this.tasks) {
			try {
				task();
			} catch (_error) {
				warn(`[WisprMaid] Error in cleanup task: ${_error}`);
			}
		}
		this.tasks.clear();
	}

	/**
	 * Check if the maid has been destroyed.
	 */
	public isDestroyed(): boolean {
		return this.tasks.size() === 0;
	}
}
