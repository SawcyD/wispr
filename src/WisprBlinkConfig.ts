/**
 * Blink integration configuration for Wispr.
 *
 * Allows users to optionally use Blink-generated remotes for improved
 * performance and security. Users must:
 * 1. Import wispr.blink into their Blink setup
 * 2. Import the generated Blink modules
 * 3. Configure Wispr with the imported modules
 * 4. Set casing to match their Blink option Casing
 */

/**
 * Casing conventions supported by Blink.
 */
export type BlinkCasing = "Camel" | "Pascal" | "Snake" | "Kebab";

/**
 * Configuration for Blink integration.
 */
export interface WisprBlinkConfig {
	/** Whether Blink is enabled */
	enabled: boolean;
	/** The imported Blink server module */
	serverBlinkModule?: Record<string, unknown>;
	/** The imported Blink client module */
	clientBlinkModule?: Record<string, unknown>;
	/** Casing convention used in Blink (must match option Casing in .blink file) */
	casing?: BlinkCasing;
}

const blinkConfig: WisprBlinkConfig = {
	enabled: false,
	casing: "Pascal", // Default to PascalCase (WisprRequestInitialData)
};

/**
 * Configure Blink integration for Wispr.
 *
 * ⚠️ **Blink integration is currently disabled and not available for use.**
 * This function is kept for API compatibility but will not enable Blink integration.
 *
 * @param _config - Partial configuration to apply (ignored)
 * @deprecated Blink integration is not currently functional and has been disabled
 */
export function configureBlink(_config: Partial<WisprBlinkConfig>): void {
	warn(
		"[Wispr] Blink integration is currently disabled and not available. Wispr will use standard RemoteFunction/RemoteEvent.",
	);
	// Do not update config - Blink integration is disabled
	// blinkConfig = { ...blinkConfig, ...config };
}

/**
 * Check if Blink integration is enabled.
 *
 * ⚠️ **Blink integration is currently disabled and always returns false.**
 *
 * @returns Always returns false (Blink integration is disabled)
 * @deprecated Blink integration is not currently functional
 */
export function isBlinkEnabled(): boolean {
	// Blink integration is disabled - always return false
	return false;
	// return blinkConfig.enabled;
}

/**
 * Get the current Blink configuration.
 *
 * @returns Read-only copy of the configuration
 */
export function getBlinkConfig(): Readonly<WisprBlinkConfig> {
	return { ...blinkConfig };
}

/**
 * Convert a remote name to the appropriate casing based on Blink config.
 *
 * @param baseName - Base remote name (e.g., "WisprRequestInitialData")
 * @returns Name converted to the configured casing convention
 *
 * @example
 * ```ts
 * // With casing: "Camel"
 * getBlinkRemoteName("WisprRequestInitialData") // "wisprRequestInitialData"
 *
 * // With casing: "Pascal"
 * getBlinkRemoteName("WisprRequestInitialData") // "WisprRequestInitialData"
 *
 * // With casing: "Snake"
 * getBlinkRemoteName("WisprRequestInitialData") // "wispr_request_initial_data"
 * ```
 */
export function getBlinkRemoteName(baseName: string): string {
	const casing = blinkConfig.casing || "Pascal";

	if (casing === "Pascal") {
		// No change needed
		return baseName;
	}

	if (casing === "Camel") {
		// WisprRequestInitialData -> wisprRequestInitialData
		if (baseName.size() === 0) {
			return baseName;
		}
		return baseName.sub(1, 1).lower() + baseName.sub(2);
	}

	if (casing === "Snake") {
		// WisprRequestInitialData -> wispr_request_initial_data
		// Insert underscore before each uppercase letter (except first), then lowercase all
		let result = "";
		for (let i = 1; i <= baseName.size(); i++) {
			const char = baseName.sub(i, i);
			const match = char.match("%u")[0];
			if (match !== undefined) {
				// Uppercase letter
				if (i > 1) {
					result += "_";
				}
				result += char.lower();
			} else {
				result += char;
			}
		}
		return result;
	}

	if (casing === "Kebab") {
		// WisprRequestInitialData -> wispr-request-initial-data
		// Insert dash before each uppercase letter (except first), then lowercase all
		let result = "";
		for (let i = 1; i <= baseName.size(); i++) {
			const char = baseName.sub(i, i);
			const match = char.match("%u")[0];
			if (match !== undefined) {
				// Uppercase letter
				if (i > 1) {
					result += "-";
				}
				result += char.lower();
			} else {
				result += char;
			}
		}
		return result;
	}

	// Fallback to PascalCase
	return baseName;
}
