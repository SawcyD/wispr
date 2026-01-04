/**
 * Path utilities for Wispr state tree navigation.
 *
 * Paths are arrays of keys that navigate the state tree.
 * This module provides helpers for path construction and validation.
 */

import type { WisprPath } from "./WisprTypes";

/**
 * Create a path from a sequence of keys.
 *
 * @param keys - Keys to construct the path from
 * @returns A readonly path array
 *
 * @example
 * ```ts
 * const path = pathOf("inventory", "items", "sword_001");
 * // Returns: ["inventory", "items", "sword_001"]
 * ```
 * @throws Error if keys are invalid
 */
export function pathOf(...keys: (string | number)[]): WisprPath {
	if (keys.size() === 0) {
		error("[WisprPath] Path cannot be empty. At least one key is required.");
	}
	for (let i = 0; i < keys.size(); i++) {
		const key = keys[i];
		const keyType = typeOf(key);
		if (keyType !== "string" && keyType !== "number") {
			error(`[WisprPath] Invalid key type at index ${i}: expected string or number, got ${keyType}`);
		}
		if (keyType === "number") {
			const numKey = key as number;
			if (numKey < 0 || numKey !== math.floor(numKey)) {
				error(`[WisprPath] Invalid number key at index ${i}: must be a non-negative integer`);
			}
		}
	}
	return keys;
}

/**
 * Check if a path is valid (non-empty, all keys are string or number).
 */
export function isValidPath(path: unknown): path is WisprPath {
	if (!typeIs(path, "table")) {
		return false;
	}
	const arr = path as unknown[];
	if (arr.size() === 0) {
		return false;
	}
	for (const key of arr) {
		if (typeOf(key) !== "string" && typeOf(key) !== "number") {
			return false;
		}
	}
	return true;
}

/**
 * Get a value from an object using a path.
 * Returns undefined if path is invalid or value doesn't exist.
 *
 * @param obj - Object to traverse
 * @param path - Path to follow
 * @returns Value at path, or undefined
 * @throws Error if path is invalid
 */
export function getValueAtPath(obj: unknown, path: WisprPath): unknown {
	if (!isValidPath(path)) {
		error("[WisprPath] Invalid path: path must be a non-empty array of strings or numbers");
	}
	if (obj === undefined) {
		return undefined;
	}

	let current: unknown = obj;
	for (const key of path) {
		if (typeOf(current) !== "table") {
			return undefined;
		}
		const objAtPath = current as Record<string | number, unknown>;
		current = objAtPath[key];
		if (current === undefined) {
			return undefined;
		}
	}
	return current;
}

/**
 * Set a value at a path in an object (creates intermediate objects/arrays as needed).
 * Mutates the object in place.
 *
 * @param obj - Object to mutate
 * @param path - Path to set
 * @param value - Value to set
 * @throws Error if path or object is invalid
 */
export function setValueAtPath(obj: Record<string | number, unknown>, path: WisprPath, value: unknown): void {
	if (!isValidPath(path)) {
		error("[WisprPath] Invalid path: path must be a non-empty array of strings or numbers");
	}
	if (!obj || typeOf(obj) !== "table") {
		error("[WisprPath] Invalid object: cannot set value on nil or non-table object");
	}

	let current: Record<string | number, unknown> = obj;
	for (let i = 0; i < path.size() - 1; i++) {
		const key = path[i];
		const objAtPath = current as Record<string | number, unknown>;
		if (objAtPath[key] === undefined || typeOf(objAtPath[key]) !== "table") {
			// Determine if next key is number (array) or string (object)
			const nextKey = path[i + 1];
			objAtPath[key] = typeOf(nextKey) === "number" ? [] : {};
		}
		const _next = objAtPath[key];
		if (typeIs(_next, "table")) {
			current = _next as Record<string | number, unknown>;
		} else {
			warn(`[WisprPath] Cannot set value: intermediate path key "${key}" at index ${i} is not a table`);
			return;
		}
	}

	const finalKey = path[path.size() - 1];
	current[finalKey] = value;
}

/**
 * Delete a value at a path in an object.
 * Mutates the object in place.
 *
 * @param obj - Object to mutate
 * @param path - Path to delete
 * @throws Error if path is invalid
 */
export function deleteValueAtPath(obj: Record<string | number, unknown>, path: WisprPath): void {
	if (!isValidPath(path)) {
		error("[WisprPath] Invalid path: path must be a non-empty array of strings or numbers");
	}
	if (!obj || typeOf(obj) !== "table") {
		warn("[WisprPath] Cannot delete: object is nil or not a table");
		return;
	}

	let current: Record<string | number, unknown> = obj;
	for (let i = 0; i < path.size() - 1; i++) {
		const key = path[i];
		if (typeOf(current) !== "table") {
			return;
		}
		const objAtPath = current as Record<string | number, unknown>;
		const _next = objAtPath[key];
		if (_next === undefined || typeOf(_next) !== "table") {
			return;
		}
		current = _next as Record<string | number, unknown>;
	}

	const finalKey = path[path.size() - 1];
	const objAtPath = current as Record<string | number, unknown>;
	delete objAtPath[finalKey];
}
