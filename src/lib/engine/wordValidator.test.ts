import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordValidator, loadWordValidator } from './wordValidator.js';
import { buildTrie, minimizeDAWG, serializeDAWG } from '../../../scripts/buildWordList.js';

/**
 * Converts a Node.js Buffer to an ArrayBuffer suitable for WordValidator.
 */
function bufferToArrayBuffer(buf: Uint8Array): ArrayBuffer {
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Builds a WordValidator from an in-memory word list.
 */
function makeValidator(words: string[]): WordValidator {
	const trie = buildTrie(words);
	const { root } = minimizeDAWG(trie);
	const buf = serializeDAWG(root);
	return new WordValidator(bufferToArrayBuffer(buf));
}

// ─── Constructor ────────────────────────────────────────────────────────────

describe('WordValidator constructor', () => {
	it('accepts a valid LFWD buffer without throwing', () => {
		expect(() => makeValidator(['cat'])).not.toThrow();
	});

	it('throws when magic bytes are wrong', () => {
		const badBuf = new ArrayBuffer(8);
		const view = new DataView(badBuf);
		view.setUint8(0, 0x58); // 'X'
		view.setUint8(1, 0x58);
		view.setUint8(2, 0x58);
		view.setUint8(3, 0x58);
		expect(() => new WordValidator(badBuf)).toThrow(/magic/i);
	});
});

// ─── isWord ─────────────────────────────────────────────────────────────────

describe('WordValidator.isWord', () => {
	it('returns true for a word that was inserted', () => {
		const v = makeValidator(['cat', 'dog', 'bird']);
		expect(v.isWord('cat')).toBe(true);
		expect(v.isWord('dog')).toBe(true);
		expect(v.isWord('bird')).toBe(true);
	});

	it('returns false for a word not in the list', () => {
		const v = makeValidator(['cat', 'dog']);
		expect(v.isWord('fox')).toBe(false);
	});

	it('is case-insensitive (lowercase input)', () => {
		const v = makeValidator(['CAT']);
		expect(v.isWord('cat')).toBe(true);
	});

	it('is case-insensitive (mixed-case input)', () => {
		const v = makeValidator(['hello']);
		expect(v.isWord('Hello')).toBe(true);
		expect(v.isWord('HELLO')).toBe(true);
	});

	it('returns false for a prefix that is not a word', () => {
		const v = makeValidator(['cats']);
		expect(v.isWord('cat')).toBe(false);
	});

	it('returns true when a prefix is also a word', () => {
		const v = makeValidator(['cat', 'cats']);
		expect(v.isWord('cat')).toBe(true);
		expect(v.isWord('cats')).toBe(true);
	});

	it('returns false for a word that extends a known word', () => {
		const v = makeValidator(['cat']);
		expect(v.isWord('cats')).toBe(false);
	});

	it('returns false for a 1-character string (minimum length is 2)', () => {
		const v = makeValidator(['a', 'cats']);
		expect(v.isWord('a')).toBe(false);
	});

	it('returns false for an empty string', () => {
		const v = makeValidator(['cat']);
		expect(v.isWord('')).toBe(false);
	});

	it('returns false for strings with non-alpha characters', () => {
		const v = makeValidator(['cat']);
		expect(v.isWord('c4t')).toBe(false);
		expect(v.isWord('ca!')).toBe(false);
	});

	it('handles many words correctly', () => {
		const words = ['bat', 'cat', 'hat', 'mat', 'pat', 'rat', 'sat', 'vat'];
		const v = makeValidator(words);
		for (const w of words) {
			expect(v.isWord(w)).toBe(true);
		}
		expect(v.isWord('fat')).toBe(false);
	});
});

// ─── isPrefix ───────────────────────────────────────────────────────────────

describe('WordValidator.isPrefix', () => {
	it('returns true for an empty string (every string starts with the empty prefix)', () => {
		const v = makeValidator(['cat']);
		expect(v.isPrefix('')).toBe(true);
	});

	it('returns true for a valid prefix', () => {
		const v = makeValidator(['catalog', 'category']);
		expect(v.isPrefix('cat')).toBe(true);
		expect(v.isPrefix('cata')).toBe(true);
		expect(v.isPrefix('cate')).toBe(true);
	});

	it('returns false for a string that is not a prefix of any word', () => {
		const v = makeValidator(['cat', 'dog']);
		expect(v.isPrefix('fox')).toBe(false);
		expect(v.isPrefix('catz')).toBe(false);
	});

	it('returns true for a word itself (which is a prefix of itself)', () => {
		const v = makeValidator(['cat']);
		expect(v.isPrefix('cat')).toBe(true);
	});

	it('returns true for a word that is a prefix of another word', () => {
		const v = makeValidator(['cats']);
		expect(v.isPrefix('cat')).toBe(true);
		expect(v.isPrefix('cats')).toBe(true);
	});

	it('returns false after the end of all matching words', () => {
		const v = makeValidator(['cat']);
		expect(v.isPrefix('cats')).toBe(false);
	});

	it('handles shared prefixes across many words', () => {
		const v = makeValidator(['bat', 'cat', 'hat', 'mat']);
		// All share nothing at root level except their own first letters
		expect(v.isPrefix('b')).toBe(true);
		expect(v.isPrefix('ba')).toBe(true);
		expect(v.isPrefix('bat')).toBe(true);
		expect(v.isPrefix('c')).toBe(true);
		expect(v.isPrefix('z')).toBe(false);
	});
});

// ─── loadWordValidator ───────────────────────────────────────────────────────

describe('loadWordValidator', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('constructs a validator from a successful fetch response', async () => {
		const trie = buildTrie(['cat', 'dog']);
		const { root } = minimizeDAWG(trie);
		const nodeBuf = serializeDAWG(root);
		const arrayBuf = bufferToArrayBuffer(nodeBuf);

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () => Promise.resolve(arrayBuf)
			} as unknown as Response)
		);

		const v = await loadWordValidator('/wordlist.dawg');
		expect(v.isWord('cat')).toBe(true);
		expect(v.isWord('dog')).toBe(true);
		expect(v.isWord('fox')).toBe(false);
	});

	it('throws when fetch returns a non-OK response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404
			} as unknown as Response)
		);

		await expect(loadWordValidator('/wordlist.dawg')).rejects.toThrow(/404/);
	});

	it('uses /wordlist.dawg as the default URL', async () => {
		const trie = buildTrie(['test']);
		const { root } = minimizeDAWG(trie);
		const nodeBuf = serializeDAWG(root);
		const arrayBuf = bufferToArrayBuffer(nodeBuf);

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: () => Promise.resolve(arrayBuf)
		} as unknown as Response);
		vi.stubGlobal('fetch', mockFetch);

		await loadWordValidator();
		expect(mockFetch).toHaveBeenCalledWith('/wordlist.dawg');
	});
});
