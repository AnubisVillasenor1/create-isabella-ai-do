/**
 * Reed–Solomon over GF(2^8), systematic 6+3 layout.
 *
 * Any six distinct shards reconstruct the original bytes. This is erasure
 * coding, not encryption; callers must encrypt before encoding.
 */
export const DATA_SHARDS = 6 as const;
export const TOTAL_SHARDS = 9 as const;
export const PARITY_SHARDS = TOTAL_SHARDS - DATA_SHARDS;
export const ERASURE_ALGORITHM = 'RS_GF256_6_9_V1' as const;

const EXP = new Uint16Array(512);
const LOG = new Uint16Array(256);

(function initializeGaloisField(): void {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if ((value & 0x100) !== 0) value ^= 0x11d;
  }
  for (let i = 255; i < EXP.length; i += 1) EXP[i] = EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a]! + LOG[b]!) % 255]!;
}

function gfInv(value: number): number {
  if (value === 0) throw new Error('TERMINUS_RS_MATRIX_SINGULAR');
  return EXP[255 - LOG[value]!]!;
}

function gfPow(value: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (value === 0) return 0;
  return EXP[(LOG[value]! * exponent) % 255]!;
}

type Matrix = number[][];

function invertMatrix(input: Matrix): Matrix {
  const size = input.length;
  if (size === 0 || input.some((row) => row.length !== size)) {
    throw new Error('TERMINUS_RS_MATRIX_INVALID');
  }
  const augmented = input.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, column) => Number(index === column)),
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    while (pivot < size && augmented[pivot]![column] === 0) pivot += 1;
    if (pivot === size) throw new Error('TERMINUS_RS_MATRIX_SINGULAR');
    if (pivot !== column) {
      const tmp = augmented[column]!;
      augmented[column] = augmented[pivot]!;
      augmented[pivot] = tmp;
    }

    const pivotRow = augmented[column]!;
    const inversePivot = gfInv(pivotRow[column]!);
    for (let j = 0; j < size * 2; j += 1) {
      pivotRow[j] = gfMul(pivotRow[j]!, inversePivot);
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const target = augmented[row]!;
      const factor = target[column]!;
      if (factor === 0) continue;
      for (let j = 0; j < size * 2; j += 1) {
        target[j] = target[j]! ^ gfMul(factor, pivotRow[j]!);
      }
    }
  }
  return augmented.map((row) => row.slice(size));
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  if (left.length === 0 || right.length === 0 || left[0]!.length !== right.length) {
    throw new Error('TERMINUS_RS_MATRIX_DIMENSIONS');
  }
  return left.map((row) =>
    right[0]!.map((_, column) => {
      let value = 0;
      for (let k = 0; k < right.length; k += 1) value ^= gfMul(row[k]!, right[k]![column]!);
      return value;
    })
  );
}

function buildGeneratorMatrix(): Matrix {
  const vandermonde = Array.from({ length: TOTAL_SHARDS }, (_, row) =>
    Array.from({ length: DATA_SHARDS }, (_, column) => gfPow(row, column))
  );
  const top = vandermonde.slice(0, DATA_SHARDS);
  return multiplyMatrices(vandermonde, invertMatrix(top));
}

const GENERATOR = buildGeneratorMatrix();

export interface EncodedShards {
  algorithm: typeof ERASURE_ALGORITHM;
  dataShards: typeof DATA_SHARDS;
  totalShards: typeof TOTAL_SHARDS;
  originalLength: number;
  shardLength: number;
  shards: Uint8Array[];
}

export interface ShardPiece {
  index: number;
  bytes: Uint8Array;
}

/** Encode bytes into nine shards, with any six sufficient for reconstruction. */
export function encodeShards(input: Uint8Array): EncodedShards {
  const originalLength = input.byteLength;
  const shardLength = Math.ceil(originalLength / DATA_SHARDS);
  const source = Array.from({ length: DATA_SHARDS }, (_, index) => {
    const block = new Uint8Array(shardLength);
    const start = index * shardLength;
    block.set(input.subarray(start, Math.min(start + shardLength, originalLength)));
    return block;
  });

  const shards = GENERATOR.map((row) => {
    const output = new Uint8Array(shardLength);
    for (let sourceIndex = 0; sourceIndex < DATA_SHARDS; sourceIndex += 1) {
      const coefficient = row[sourceIndex]!;
      if (coefficient === 0) continue;
      const sourceBlock = source[sourceIndex]!;
      for (let position = 0; position < shardLength; position += 1) {
        output[position] = output[position]! ^ gfMul(coefficient, sourceBlock[position]!);
      }
    }
    return output;
  });

  return {
    algorithm: ERASURE_ALGORITHM,
    dataShards: DATA_SHARDS,
    totalShards: TOTAL_SHARDS,
    originalLength,
    shardLength,
    shards,
  };
}

/** Reconstruct from any six valid, unique shard indexes. Extra shards are ignored. */
export function decodeShards(pieces: readonly ShardPiece[], originalLength: number): Uint8Array {
  if (!Number.isSafeInteger(originalLength) || originalLength < 0) {
    throw new Error('TERMINUS_RS_ORIGINAL_LENGTH_INVALID');
  }
  const unique = new Map<number, Uint8Array>();
  for (const piece of pieces) {
    if (!Number.isInteger(piece.index) || piece.index < 0 || piece.index >= TOTAL_SHARDS) continue;
    if (!(piece.bytes instanceof Uint8Array) || unique.has(piece.index)) continue;
    unique.set(piece.index, piece.bytes);
  }
  if (unique.size < DATA_SHARDS) throw new Error('TERMINUS_RS_INSUFFICIENT_SHARDS');
  const chosen = [...unique.entries()].slice(0, DATA_SHARDS);
  const shardLength = chosen[0]![1].byteLength;
  if (chosen.some(([, bytes]) => bytes.byteLength !== shardLength)) {
    throw new Error('TERMINUS_RS_SHARD_LENGTH_MISMATCH');
  }
  if (originalLength > shardLength * DATA_SHARDS)
    throw new Error('TERMINUS_RS_LENGTH_EXCEEDS_CAPACITY');

  const selectedMatrix = chosen.map(([index]) => GENERATOR[index]!);
  const inverse = invertMatrix(selectedMatrix);
  const source = Array.from({ length: DATA_SHARDS }, (_, sourceIndex) => {
    const output = new Uint8Array(shardLength);
    for (let selectedIndex = 0; selectedIndex < DATA_SHARDS; selectedIndex += 1) {
      const coefficient = inverse[sourceIndex]![selectedIndex]!;
      if (coefficient === 0) continue;
      const input = chosen[selectedIndex]![1];
      for (let position = 0; position < shardLength; position += 1) {
        output[position] = output[position]! ^ gfMul(coefficient, input[position]!);
      }
    }
    return output;
  });

  const padded = new Uint8Array(shardLength * DATA_SHARDS);
  source.forEach((block, index) => padded.set(block, index * shardLength));
  return padded.slice(0, originalLength);
}
