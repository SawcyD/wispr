/**
 * Lightweight signal/event system for Wispr.
 *
 * Provides a simple pub/sub mechanism for change notifications.
 * Used internally by WisprNode for change listeners.
 */

/**
 * A signal that can fire events to multiple listeners.
 */
export class WisprSignal<T = void> {
	private readonly listeners = new Set<(value: T) => void>();

	/**
	 * Connect a listener to this signal.
	 *
	 * @param callback - Function to call when signal fires
	 * @returns Disconnect function
	 */
	public connect(callback: (value: T) => void): () => void {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	}

	/**
	 * Fire the signal, calling all connected listeners.
	 *
	 * @param value - Value to pass to listeners
	 */
	public fire(value: T): void {
		for (const listener of this.listeners) {
			try {
				listener(value);
			} catch (error) {
				warn(`[WisprSignal] Error in listener: ${error}`);
			}
		}
	}

	/**
	 * Disconnect all listeners.
	 */
	public disconnectAll(): void {
		this.listeners.clear();
	}

	/**
	 * Get the number of connected listeners.
	 */
	public getListenerCount(): number {
		return this.listeners.size();
	}
}
