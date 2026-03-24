/**
 * DAWG/Trie word validator.
 *
 * Reads the LFWD v1 binary format produced by scripts/buildWordList.ts.
 *
 * Binary layout (recap):
 *   [0-3]   magic "LFWD"
 *   [4-7]   nodeCount (uint32 LE)
 *   [8 … 8+nodeCount*4-1]  offset table: nodeDataOffsets[i] (uint32 LE, relative to data section)
 *   data section:
 *     Per node at dataStart + nodeDataOffsets[i]:
 *       [0]   flags  (bit 0 = isWord)
 *       [1]   childCount
 *       Per child (childCount × 5 bytes):
 *         [0]   letterIndex  (0=A … 25=Z)
 *         [1-4] childNodeIndex (uint32 LE)
 */

export class WordValidator {
	private view: DataView;
	private dataStart: number;

	constructor(buffer: ArrayBuffer) {
		this.view = new DataView(buffer);

		const magic = String.fromCharCode(
			this.view.getUint8(0),
			this.view.getUint8(1),
			this.view.getUint8(2),
			this.view.getUint8(3)
		);
		if (magic !== 'LFWD') {
			throw new Error(`Invalid DAWG binary: expected magic "LFWD", got "${magic}"`);
		}

		const nodeCount = this.view.getUint32(4, true);
		this.dataStart = 8 + nodeCount * 4;
	}

	/** Returns the byte offset of node `index` within the DataView. */
	private nodeOffset(index: number): number {
		const relativeOffset = this.view.getUint32(8 + index * 4, true);
		return this.dataStart + relativeOffset;
	}

	/**
	 * Walks the DAWG following the characters of `text` (upper-cased).
	 * Returns the final node index if every character was found, or -1 if the
	 * path does not exist.
	 */
	private traverse(text: string): number {
		let nodeIndex = 0;
		const upper = text.toUpperCase();
		for (let ci = 0; ci < upper.length; ci++) {
			const charIdx = upper.charCodeAt(ci) - 65; // A=0 … Z=25
			if (charIdx < 0 || charIdx > 25) return -1;

			const base = this.nodeOffset(nodeIndex);
			const childCount = this.view.getUint8(base + 1);

			let next = -1;
			for (let i = 0; i < childCount; i++) {
				const childBase = base + 2 + i * 5;
				if (this.view.getUint8(childBase) === charIdx) {
					next = this.view.getUint32(childBase + 1, true);
					break;
				}
			}

			if (next === -1) return -1;
			nodeIndex = next;
		}
		return nodeIndex;
	}

	/**
	 * Returns true if `word` is a valid word in the dictionary.
	 * Case-insensitive; minimum length 2.
	 */
	isWord(word: string): boolean {
		if (word.length < 2) return false;
		const nodeIndex = this.traverse(word);
		if (nodeIndex === -1) return false;
		const flags = this.view.getUint8(this.nodeOffset(nodeIndex));
		return (flags & 1) === 1;
	}

	/**
	 * Returns true if `prefix` is a valid prefix of at least one word.
	 * An empty prefix is always valid.
	 */
	isPrefix(prefix: string): boolean {
		if (prefix.length === 0) return true;
		return this.traverse(prefix) !== -1;
	}
}

/**
 * Fetches the DAWG binary from `url` and returns a ready WordValidator.
 * Defaults to the pre-built asset at `/wordlist.dawg`.
 */
export async function loadWordValidator(url = '/wordlist.dawg'): Promise<WordValidator> {
	const response = await globalThis.fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load word list from "${url}": HTTP ${response.status}`);
	}
	const buffer = await response.arrayBuffer();
	return new WordValidator(buffer);
}
