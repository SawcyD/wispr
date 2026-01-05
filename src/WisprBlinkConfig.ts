/**
 * Blink integration configuration for Wispr.
 *
 * Allows users to optionally use Blink-generated remotes for improved
 * performance and security. Users must:
 * 1. Import wispr.blink into their Blink setup
 * 2. Configure paths to their generated Blink code
 * 3. Set casing to match their Blink option Casing
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
	/** Path to the generated Blink server code (relative to project root) */
	serverBlinkPath?: string;
	/** Path to the generated Blink client code (relative to project root) */
	clientBlinkPath?: string;
	/** Casing convention used in Blink (must match option Casing in .blink file) */
	casing?: BlinkCasing;
}

let blinkConfig: WisprBlinkConfig = {
	enabled: false,
	serverBlinkPath: "./src/server/network/network",
	clientBlinkPath: "./src/shared/network/network",
	casing: "Pascal", // Default to PascalCase (WisprRequestInitialData)
};

/**
 * Configure Blink integration for Wispr.
 *
 * @param config - Partial configuration to apply
 *
 * @example
 * ```ts
 * configureBlink({
 *   enabled: true,
 *   serverBlinkPath: "./src/server/network/network",
 *   clientBlinkPath: "./src/shared/network/network",
 *   casing: "Camel"
 * });
 * ```
 */
export function configureBlink(config: Partial<WisprBlinkConfig>): void {
	blinkConfig = { ...blinkConfig, ...config };
}

/**
 * Check if Blink integration is enabled.
 *
 * @returns true if Blink is enabled
 */
export function isBlinkEnabled(): boolean {
	return blinkConfig.enabled;
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
