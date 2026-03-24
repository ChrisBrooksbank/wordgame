/**
 * Word list compiler: reads a newline-separated word corpus,
 * builds a minimized DAWG (Directed Acyclic Word Graph),
 * and writes the binary to static/wordlist.dawg.
 *
 * Usage:
 *   vite-node scripts/buildWordList.ts [input-file] [output-file]
 *
 * Defaults:
 *   input:  scripts/words.txt
 *   output: static/wordlist.dawg
 *
 * ─── Binary Format (LFWD v1) ────────────────────────────────────────────
 *
 * Header (8 bytes):
 *   [0-3]  magic "LFWD" (ASCII)
 *   [4-7]  nodeCount (uint32 LE)
 *
 * Offset table (nodeCount × 4 bytes):
 *   [8 ... 8+nodeCount*4-1]
 *   nodeDataOffsets[i] (uint32 LE) — byte offset relative to data section
 *
 * Data section:
 *   For each node i (at dataStart + nodeDataOffsets[i]):
 *     [0]   flags: bit 0 = isWord
 *     [1]   childCount
 *     Per child (sorted by letter, childCount times):
 *       [0]   letterIndex (0=A … 25=Z)
 *       [1-4] childNodeIndex (uint32 LE)
 *
 * Root node is always node 0.
 * ────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Data structure ───────────────────────────────────────────────────────

export interface DawgNode {
	children: Map<string, DawgNode>;
	isWord: boolean;
	id: number;
}

function makeNode(): DawgNode {
	return { children: new Map(), isWord: false, id: -1 };
}

// ─── Trie builder ─────────────────────────────────────────────────────────

/**
 * Builds a trie from an array of words.
 * Words are normalised to uppercase; non-alpha characters and words shorter
 * than 2 letters are skipped.
 */
export function buildTrie(words: string[]): DawgNode {
	const root = makeNode();
	for (const raw of words) {
		const word = raw.toUpperCase().trim();
		if (word.length < 2 || !/^[A-Z]+$/.test(word)) continue;
		let node = root;
		for (const ch of word) {
			if (!node.children.has(ch)) {
				node.children.set(ch, makeNode());
			}
			node = node.children.get(ch)!;
		}
		node.isWord = true;
	}
	return root;
}

// ─── DAWG minimiser ───────────────────────────────────────────────────────

/**
 * Minimises a trie into a DAWG by sharing structurally equivalent suffix
 * subtrees (post-order canonical-form memoisation).
 *
 * Returns the canonical root and the total number of unique nodes.
 */
export function minimizeDAWG(root: DawgNode): { root: DawgNode; nodeCount: number } {
	const registry = new Map<string, DawgNode>();
	let nextId = 0;

	function nodeSignature(node: DawgNode): string {
		const parts: string[] = [node.isWord ? '1' : '0'];
		for (const [letter, child] of [...node.children.entries()].sort()) {
			parts.push(`${letter}:${child.id}`);
		}
		return parts.join('|');
	}

	function canonicalize(node: DawgNode): DawgNode {
		// Already registered — return canonical version immediately
		if (node.id >= 0) return node;

		// Post-order: canonicalize all children first
		const entries = [...node.children.entries()];
		for (const [letter, child] of entries) {
			node.children.set(letter, canonicalize(child));
		}

		const sig = nodeSignature(node);
		const existing = registry.get(sig);
		if (existing !== undefined) {
			return existing;
		}
		node.id = nextId++;
		registry.set(sig, node);
		return node;
	}

	const canonicalRoot = canonicalize(root);
	return { root: canonicalRoot, nodeCount: nextId };
}

// ─── Serialiser ───────────────────────────────────────────────────────────

/**
 * Serialises a minimised DAWG into the LFWD binary format.
 * Root node is always assigned index 0 (BFS ordering).
 */
export function serializeDAWG(root: DawgNode): Buffer {
	// BFS traversal to collect nodes and assign sequential IDs (root = 0)
	const visited = new WeakSet<DawgNode>();
	const bfsOrder: DawgNode[] = [];
	visited.add(root);
	const queue: DawgNode[] = [root];
	while (queue.length > 0) {
		const node = queue.shift()!;
		node.id = bfsOrder.length;
		bfsOrder.push(node);
		for (const child of node.children.values()) {
			if (!visited.has(child)) {
				visited.add(child);
				queue.push(child);
			}
		}
	}
	const nodeCount = bfsOrder.length;

	// Compute data section: per-node byte offsets and total size
	const nodeDataOffsets: number[] = new Array(nodeCount);
	let dataSize = 0;
	for (let i = 0; i < nodeCount; i++) {
		nodeDataOffsets[i] = dataSize;
		dataSize += 2 + bfsOrder[i].children.size * 5;
	}

	const HEADER = 8;
	const OFFSET_TABLE = nodeCount * 4;
	const buf = Buffer.alloc(HEADER + OFFSET_TABLE + dataSize);

	// Header
	buf.write('LFWD', 0, 'ascii');
	buf.writeUInt32LE(nodeCount, 4);

	// Offset table
	for (let i = 0; i < nodeCount; i++) {
		buf.writeUInt32LE(nodeDataOffsets[i], 8 + i * 4);
	}

	// Node data (root = node 0)
	let pos = HEADER + OFFSET_TABLE;
	for (let i = 0; i < nodeCount; i++) {
		const node = bfsOrder[i];
		buf.writeUInt8(node.isWord ? 1 : 0, pos++);
		const children = [...node.children.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
		buf.writeUInt8(children.length, pos++);
		for (const [letter, child] of children) {
			buf.writeUInt8(letter.charCodeAt(0) - 65, pos++); // A=0 … Z=25
			buf.writeUInt32LE(child.id, pos);
			pos += 4;
		}
	}

	return buf;
}

// ─── CLI entry point ──────────────────────────────────────────────────────

function main(): void {
	const inputPath = process.argv[2] ?? resolve(__dirname, 'words.txt');
	const outputPath = process.argv[3] ?? resolve(__dirname, '../static/wordlist.dawg');

	if (!existsSync(inputPath)) {
		console.error(`Word list not found: ${inputPath}`);
		console.error('');
		console.error('Obtain a word corpus and save it as a newline-separated text file.');
		console.error('Recommended sources (public domain):');
		console.error('  ENABLE2: https://www.wordgamedictionary.com/enable/download/enable1.txt');
		console.error('  SOWPODS: https://www.wordgamedictionary.com/sowpods/download/sowpods.txt');
		console.error('');
		console.error(`Save the file to: ${inputPath}`);
		process.exit(1);
	}

	console.log(`Reading words from: ${inputPath}`);
	const raw = readFileSync(inputPath, 'utf-8');
	const words = raw
		.split('\n')
		.map((w) => w.trim())
		.filter(Boolean);
	console.log(`  ${words.length.toLocaleString()} lines loaded`);

	console.log('Building trie…');
	const trieRoot = buildTrie(words);

	console.log('Minimising DAWG…');
	const { root, nodeCount } = minimizeDAWG(trieRoot);
	console.log(`  ${nodeCount.toLocaleString()} unique nodes`);

	console.log('Serialising…');
	const buf = serializeDAWG(root);
	console.log(`  ${(buf.length / 1024).toFixed(1)} KB`);

	writeFileSync(outputPath, buf);
	console.log(`Written to: ${outputPath}`);
}

// Run only when executed directly (not when imported by tests)
const isMain =
	typeof process !== 'undefined' &&
	process.argv[1] != null &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
	main();
}
