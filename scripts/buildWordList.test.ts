import { describe, it, expect } from 'vitest';
import { buildTrie, minimizeDAWG, serializeDAWG } from './buildWordList.js';

// ─── buildTrie ────────────────────────────────────────────────────────────

describe('buildTrie', () => {
	it('creates a root node with no word membership', () => {
		const root = buildTrie(['cat']);
		expect(root.isWord).toBe(false);
	});

	it('adds a single word', () => {
		const root = buildTrie(['cat']);
		const c = root.children.get('C');
		expect(c).toBeDefined();
		const a = c!.children.get('A');
		expect(a).toBeDefined();
		const t = a!.children.get('T');
		expect(t).toBeDefined();
		expect(t!.isWord).toBe(true);
	});

	it('marks only terminal nodes as isWord', () => {
		const root = buildTrie(['cat']);
		const c = root.children.get('C')!;
		const a = c.children.get('A')!;
		expect(c.isWord).toBe(false);
		expect(a.isWord).toBe(false);
	});

	it('handles prefix relationships correctly', () => {
		const root = buildTrie(['cat', 'cats']);
		const t = root.children.get('C')!.children.get('A')!.children.get('T')!;
		expect(t.isWord).toBe(true); // "cat" is a word
		expect(t.children.has('S')).toBe(true); // "cats" extends it
		expect(t.children.get('S')!.isWord).toBe(true);
	});

	it('normalises to uppercase', () => {
		const root = buildTrie(['hello']);
		expect(root.children.has('H')).toBe(true);
		expect(root.children.has('h')).toBe(false);
	});

	it('skips words with non-alpha characters', () => {
		const root = buildTrie(['cat', 'c4t', 'hel-lo', "don't"]);
		// Only 'cat' survives
		expect(root.children.size).toBe(1);
		expect(root.children.has('C')).toBe(true);
	});

	it('skips single-character words', () => {
		const root = buildTrie(['a', 'i', 'cat']);
		expect(root.children.size).toBe(1); // only 'C' from 'cat'
	});

	it('skips empty strings', () => {
		const root = buildTrie(['', '   ', 'cat']);
		expect(root.children.size).toBe(1);
	});

	it('handles multiple words sharing a prefix', () => {
		const root = buildTrie(['cat', 'car', 'can']);
		const a = root.children.get('C')!.children.get('A')!;
		expect(a.children.has('T')).toBe(true);
		expect(a.children.has('R')).toBe(true);
		expect(a.children.has('N')).toBe(true);
	});
});

// ─── minimizeDAWG ─────────────────────────────────────────────────────────

/** Walks the DAWG to check whether a word is present. */
function dagLookup(root: ReturnType<typeof buildTrie>, word: string): boolean {
	let node: ReturnType<typeof buildTrie> | undefined = root;
	for (const ch of word.toUpperCase()) {
		node = node?.children.get(ch);
		if (!node) return false;
	}
	return node?.isWord ?? false;
}

describe('minimizeDAWG', () => {
	it('assigns sequential non-negative IDs', () => {
		const { root: dawgRoot, nodeCount } = minimizeDAWG(buildTrie(['cat', 'car']));
		expect(nodeCount).toBeGreaterThan(0);
		expect(dawgRoot.id).toBeGreaterThanOrEqual(0);
	});

	it('reduces node count by sharing equivalent suffix subtrees', () => {
		// "bat", "cat", "hat" — all share the "AT" suffix
		const trieRoot = buildTrie(['bat', 'cat', 'hat']);
		const { nodeCount } = minimizeDAWG(trieRoot);
		// Full trie would have 10 nodes; DAWG should have fewer
		expect(nodeCount).toBeLessThan(10);
	});

	it('preserves word membership after minimisation', () => {
		const words = ['cat', 'car', 'bat'];
		const { root: dawgRoot } = minimizeDAWG(buildTrie(words));

		expect(dagLookup(dawgRoot, 'cat')).toBe(true);
		expect(dagLookup(dawgRoot, 'car')).toBe(true);
		expect(dagLookup(dawgRoot, 'bat')).toBe(true);
	});

	it('correctly reports absent words after minimisation', () => {
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['cat', 'car']));
		expect(dagLookup(dawgRoot, 'can')).toBe(false);
		expect(dagLookup(dawgRoot, 'ca')).toBe(false);
		expect(dagLookup(dawgRoot, 'dog')).toBe(false);
	});

	it('handles a prefix that is also a word', () => {
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['cat', 'cats']));
		expect(dagLookup(dawgRoot, 'cat')).toBe(true);
		expect(dagLookup(dawgRoot, 'cats')).toBe(true);
		expect(dagLookup(dawgRoot, 'ca')).toBe(false);
	});

	it('handles a single word', () => {
		const { root: dawgRoot, nodeCount } = minimizeDAWG(buildTrie(['hello']));
		expect(nodeCount).toBeGreaterThan(0);
		expect(dagLookup(dawgRoot, 'hello')).toBe(true);
		expect(dagLookup(dawgRoot, 'hell')).toBe(false);
	});

	it('shares all-same-letter leaf nodes', () => {
		// "bat", "cat", "hat" — leaf T nodes are all {isWord:true, children:{}}
		// They should all collapse to a single canonical node
		const trieRoot = buildTrie(['bat', 'cat', 'hat']);
		const { nodeCount } = minimizeDAWG(trieRoot);
		// root + B/C/H (shared) + A (shared) + T (shared) = 4 unique nodes
		expect(nodeCount).toBeLessThanOrEqual(4);
	});
});

// ─── serializeDAWG ────────────────────────────────────────────────────────

describe('serializeDAWG', () => {
	it('starts with magic bytes "LFWD"', () => {
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['cat']));
		const buf = serializeDAWG(dawgRoot);
		expect(buf.toString('ascii', 0, 4)).toBe('LFWD');
	});

	it('encodes correct node count in the header', () => {
		const { root: dawgRoot, nodeCount } = minimizeDAWG(buildTrie(['cat', 'car', 'bat']));
		const buf = serializeDAWG(dawgRoot);
		expect(buf.readUInt32LE(4)).toBe(nodeCount);
	});

	it('root node (index 0) is not a word for normal inputs', () => {
		const { root: dawgRoot, nodeCount } = minimizeDAWG(buildTrie(['cat', 'car']));
		const buf = serializeDAWG(dawgRoot);
		const n = buf.readUInt32LE(4);
		const dataStart = 8 + n * 4;
		const rootOffset = buf.readUInt32LE(8);
		const flags = buf.readUInt8(dataStart + rootOffset);
		expect(flags & 1).toBe(0); // root is not a word
		expect(nodeCount).toBeGreaterThan(0);
	});

	it('root node has at least one child', () => {
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['cat', 'bat']));
		const buf = serializeDAWG(dawgRoot);
		const n = buf.readUInt32LE(4);
		const dataStart = 8 + n * 4;
		const rootOffset = buf.readUInt32LE(8);
		const childCount = buf.readUInt8(dataStart + rootOffset + 1);
		expect(childCount).toBeGreaterThan(0);
	});

	it('encodes letter indices in A=0 … Z=25 format', () => {
		// Single word "ace" → root has one child: 'A' (index 0)
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['ace']));
		const buf = serializeDAWG(dawgRoot);
		const n = buf.readUInt32LE(4);
		const dataStart = 8 + n * 4;
		const rootOffset = buf.readUInt32LE(8);
		// flags(1) + childCount(1) = pos+2; first child letter at pos+2
		const firstLetterIndex = buf.readUInt8(dataStart + rootOffset + 2);
		expect(firstLetterIndex).toBe(0); // 'A' = 0
	});

	it('produces a deterministic output for the same input', () => {
		const words = ['cat', 'car', 'bat', 'bar'];
		const buf1 = serializeDAWG(minimizeDAWG(buildTrie(words)).root);
		const buf2 = serializeDAWG(minimizeDAWG(buildTrie(words)).root);
		expect(buf1.equals(buf2)).toBe(true);
	});

	it('offset table points to valid positions within the data section', () => {
		const { root: dawgRoot } = minimizeDAWG(buildTrie(['cat', 'car', 'bat']));
		const buf = serializeDAWG(dawgRoot);
		const n = buf.readUInt32LE(4);
		const dataStart = 8 + n * 4;
		const dataLen = buf.length - dataStart;
		for (let i = 0; i < n; i++) {
			const offset = buf.readUInt32LE(8 + i * 4);
			expect(offset).toBeGreaterThanOrEqual(0);
			expect(offset).toBeLessThan(dataLen);
		}
	});

	it('child node indices are within [0, nodeCount)', () => {
		const words = ['cat', 'car', 'bat', 'bar', 'hat'];
		const { root: dawgRoot } = minimizeDAWG(buildTrie(words));
		const buf = serializeDAWG(dawgRoot);
		const n = buf.readUInt32LE(4);
		const dataStart = 8 + n * 4;

		for (let i = 0; i < n; i++) {
			const offset = buf.readUInt32LE(8 + i * 4);
			let pos = dataStart + offset;
			pos += 1; // skip flags
			const childCount = buf.readUInt8(pos++);
			for (let c = 0; c < childCount; c++) {
				pos += 1; // letter index
				const childIdx = buf.readUInt32LE(pos);
				pos += 4;
				expect(childIdx).toBeGreaterThanOrEqual(0);
				expect(childIdx).toBeLessThan(n);
			}
		}
	});
});
