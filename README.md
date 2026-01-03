# Wispr

**Server-authoritative state replication system for Roblox TypeScript**

Wispr provides a simple, safe, and explicit way to replicate state from server to clients using a snapshot + patch model. Built for [roblox-ts](https://roblox-ts.com/).

## Features

- **Server Authoritative**: Only the server can mutate state, ensuring security and consistency
- **Type Safe**: Full TypeScript support with type inference
- **Efficient**: Snapshot + patch model minimizes bandwidth usage
- **Scoped Replication**: Control which clients see which state nodes
- **Versioned Patches**: Automatic handling of out-of-order patches
- **Observable**: Listen to changes at specific paths or any change in a node

## Installation

```bash
npm install @rbxts/wispr
```

## Quick Start

### Server Setup

```typescript
import { WisprToken, createNode, patchNode, pathOf } from "@rbxts/wispr";

// Define a token for your state type
interface PlayerStats {
	gold: number;
	level: number;
	inventory: string[];
}

const PLAYER_STATS = WisprToken.create<PlayerStats>("player.stats");

// Create a node (server-only)
const node = createNode(
	PLAYER_STATS,
	{ kind: "all" }, // Scope: replicate to all clients
	{ gold: 0, level: 1, inventory: [] } // Initial state
);

// Update state with patches
patchNode(PLAYER_STATS, { type: "set", path: pathOf("gold"), value: 100 });
patchNode(PLAYER_STATS, { type: "increment", path: pathOf("level"), delta: 1 });
```

### Client Setup

```typescript
import { waitForNode, requestInitialData, pathOf } from "@rbxts/wispr";

// Initialize (call once on client startup)
await requestInitialData();

// Wait for and get the node
const node = await waitForNode(PLAYER_STATS);
const stats = node.getState();

// Listen for changes
node.listenForChange(pathOf("gold"), (newVal, oldVal) => {
	print(`Gold changed from ${oldVal} to ${newVal}`);
});

// Or listen for any change
node.listenForAnyChange(() => {
	print("Stats updated!");
});
```

## Core Concepts

### Tokens

Tokens are unique identifiers for state nodes. Create them once at module level:

```typescript
const PLAYER_STATS = WisprToken.create<PlayerStats>("player.stats");
const GAME_STATE = WisprToken.create<GameState>("game.state");
```

### Paths

Paths are arrays of keys (never strings) that navigate the state tree:

```typescript
pathOf("inventory", "items", "sword_001")  // ["inventory", "items", "sword_001"]
pathOf("weapons", 0, "cooldown")           // ["weapons", 0, "cooldown"]
```

### Scopes

Control which clients receive state updates:

```typescript
{ kind: "all" }                           // All clients
{ kind: "player", player: somePlayer }    // Single player
{ kind: "players", players: [p1, p2] }    // Multiple players
```

### Patch Operations

Wispr supports various patch operations:

```typescript
// Set a value
{ type: "set", path: pathOf("gold"), value: 100 }

// Delete a value
{ type: "delete", path: pathOf("oldField") }

// Increment a number
{ type: "increment", path: pathOf("level"), delta: 1 }

// Array operations
{ type: "listPush", path: pathOf("inventory"), value: "sword" }
{ type: "listInsert", path: pathOf("inventory"), index: 0, value: "potion" }
{ type: "listRemoveAt", path: pathOf("inventory"), index: 2 }

// Map operations
{ type: "mapSet", pathToMap: pathOf("players"), id: "player123", value: playerData }
{ type: "mapDelete", pathToMap: pathOf("players"), id: "player123" }
```

### Helper Functions

Wispr provides helper functions for creating patch operations:

```typescript
import { opSet, opIncrement, opListPush, opMapSet } from "@rbxts/wispr";

patchNode(PLAYER_STATS, opSet(pathOf("gold"), 100));
patchNode(PLAYER_STATS, opIncrement(pathOf("level"), 1));
patchNode(PLAYER_STATS, opListPush(pathOf("inventory"), "sword"));
patchNode(PLAYER_STATS, opMapSet(pathOf("equipment"), "weapon", swordData));

// Apply multiple operations at once
patchNodeMultiple(PLAYER_STATS, [
	opSet(pathOf("gold"), 200),
	opIncrement(pathOf("level"), 1),
]);
```

## API Reference

### Server API

```typescript
// Create a new state node
createNode<T>(token: WisprToken<T>, scope: WisprScope, initialState: T): WisprServerNode<T>

// Get a node by token (server-side)
getServerNode<T>(token: WisprToken<T>): WisprServerNode<T> | undefined

// Destroy a node
destroyNode(token: WisprToken<unknown>): void

// Apply a single patch operation
patchNode(token: WisprToken<unknown>, operation: WisprPatchOp): void

// Apply multiple patch operations
patchNodeMultiple(token: WisprToken<unknown>, operations: readonly WisprPatchOp[]): void
```

### Client API

```typescript
// Request initial data (call once on startup)
requestInitialData(): Promise<void>

// Wait for a node to be created
waitForNode<T>(token: WisprToken<T>): Promise<WisprNode<T>>

// Get a node (returns undefined if not found)
getClientNode<T>(token: WisprToken<T>): WisprNode<T> | undefined
```

### WisprNode (Client)

```typescript
// Get current state (deep copy)
getState(): T

// Get value at a specific path
getValue(path: WisprPath): unknown

// Get current version
getVersion(): number

// Listen for changes at a specific path
listenForChange(path: WisprPath, callback: (newVal: unknown, oldVal: unknown) => void): () => void

// Listen for any change in the node
listenForAnyChange(callback: () => void): () => void

// Listen for raw patches (dev/debug)
listenForRawPatch(callback: (patch: WisprPatch) => void): () => void

// Destroy the node and clean up listeners
destroy(): void
```

## Architecture

Wispr uses a **snapshot + patch** model:

1. **Initial State**: When a node is created, clients receive a complete snapshot
2. **Updates**: Subsequent changes are sent as small, explicit patch operations
3. **Versioning**: Each patch has a version number; out-of-order patches are ignored
4. **Scoping**: The server determines which clients receive which updates based on scope

This design ensures:
- **Efficiency**: Only changes are transmitted, not full state
- **Security**: Server is the single source of truth
- **Reliability**: Version numbers handle network issues gracefully

## Example: Player Inventory

```typescript
// Server
import { Players } from "@rbxts/services";
import { WisprToken, createNode, patchNode, pathOf, opIncrement, opListPush } from "@rbxts/wispr";

interface Inventory {
	gold: number;
	items: string[];
	equipment: Record<string, EquipmentData>;
}

// Create a token factory for per-player inventories
function getPlayerInventoryToken(player: Player): WisprToken<Inventory> {
	return WisprToken.create<Inventory>(`player.${player.UserId}.inventory`);
}

// Create per-player inventory
Players.PlayerAdded.Connect((player) => {
	const token = getPlayerInventoryToken(player);
	createNode(
		token,
		{ kind: "player", player }, // Scope to this specific player
		{ gold: 0, items: [], equipment: {} }
	);
});

// Update inventory for a specific player
function addGold(player: Player, amount: number) {
	const token = getPlayerInventoryToken(player);
	patchNode(token, opIncrement(pathOf("gold"), amount));
}

function addItem(player: Player, item: string) {
	const token = getPlayerInventoryToken(player);
	patchNode(token, opListPush(pathOf("items"), item));
}
```

```typescript
// Client
import { Players } from "@rbxts/services";
import { waitForNode, requestInitialData, pathOf, WisprToken } from "@rbxts/wispr";

await requestInitialData();

// Get the player's own inventory token
const localPlayer = Players.LocalPlayer;
if (!localPlayer) return;

const inventoryToken = WisprToken.create<Inventory>(`player.${localPlayer.UserId}.inventory`);

const inventory = await waitForNode(inventoryToken);

// Display gold
inventory.listenForChange(pathOf("gold"), (newGold) => {
	updateGoldUI(newGold as number);
});

// Display items
inventory.listenForChange(pathOf("items"), (newItems) => {
	updateItemsUI(newItems as string[]);
});
```

## License

ISC License

Copyright (c) 2026, sawcy

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
