import { createHmac } from 'node:crypto';
import { HoosatCrypto } from '@crypto/crypto';

// secp256k1 curve order (n)
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export interface HdNode {
  privateKey: Buffer;
  chainCode: Buffer;
}

function hmacSha512(key: Buffer | string, data: Buffer): Buffer {
  return createHmac('sha512', key).update(data).digest();
}

function ser32(i: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(i >>> 0, 0);
  return b;
}

function toBigInt32(bytes: Buffer): bigint {
  return BigInt('0x' + bytes.toString('hex'));
}

function ser256(privKey: Buffer): Buffer {
  if (privKey.length !== 32) {
    throw new Error(`Expected 32-byte private key, got ${privKey.length}`);
  }
  return privKey;
}

function addModN(a: Buffer, b: Buffer): Buffer {
  const sum = (toBigInt32(a) + toBigInt32(b)) % SECP256K1_N;
  if (sum === 0n) {
    throw new Error('Invalid derived private key (zero)');
  }

  const hex = sum.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

/**
 * Creates an HD root node from a seed using the standard BIP32 root derivation.
 *
 * Note: Uses the conventional key string "Bitcoin seed".
 */
export function hdFromSeed(seed: Buffer): HdNode {
  if (!Buffer.isBuffer(seed) || seed.length < 16) {
    throw new Error('Seed must be a Buffer (>= 16 bytes)');
  }

  const I = hmacSha512('Bitcoin seed', seed);
  const IL = I.subarray(0, 32);
  const IR = I.subarray(32, 64);

  const ilInt = toBigInt32(IL);
  if (ilInt === 0n || ilInt >= SECP256K1_N) {
    throw new Error('Invalid seed (derived key is out of range)');
  }

  return {
    privateKey: Buffer.from(IL),
    chainCode: Buffer.from(IR),
  };
}

/**
 * Derives a child node from a parent node.
 *
 * This is a minimal BIP32 private-key derivation implementation.
 */
export function deriveChild(parent: HdNode, index: number, hardened: boolean): HdNode {
  if (index < 0 || index > 0x7fffffff) {
    throw new Error('Child index out of range');
  }

  const childIndex = hardened ? (index | 0x80000000) >>> 0 : index >>> 0;

  const data = hardened
    ? Buffer.concat([Buffer.from([0x00]), ser256(parent.privateKey), ser32(childIndex)])
    : Buffer.concat([HoosatCrypto.getPublicKey(parent.privateKey), ser32(childIndex)]);

  const I = hmacSha512(parent.chainCode, data);
  const IL = I.subarray(0, 32);
  const IR = I.subarray(32, 64);

  const ilInt = toBigInt32(IL);
  if (ilInt === 0n || ilInt >= SECP256K1_N) {
    throw new Error('Invalid child derivation (IL out of range)');
  }

  return {
    privateKey: addModN(parent.privateKey, Buffer.from(IL)),
    chainCode: Buffer.from(IR),
  };
}

export interface PathComponent {
  index: number;
  hardened: boolean;
}

export function derivePath(root: HdNode, path: PathComponent[]): HdNode {
  let node = root;
  for (const component of path) {
    node = deriveChild(node, component.index, component.hardened);
  }
  return node;
}
