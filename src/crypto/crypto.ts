import * as blake3 from 'blake3';
import * as secp256k1 from 'secp256k1';
import { createHash, randomBytes } from 'node:crypto';
import * as bech32Hoosat from '@libs/bech32-hoosat';
import { HOOSAT_PARAMS } from '@constants/hoosat-params.const';
import { Transaction, UtxoForSigning } from '@models/transaction.types';
import { KeyPair, SighashReusedValues, TransactionSignature } from '@crypto/crypto.types';
import { HOOSAT_MASS } from '@constants/hoosat-mass.const';
import { HoosatNetwork } from '@models/network.type';

export class HoosatCrypto {
  // ==================== HASHING ====================

  /**
   * Computes Blake3 hash (single pass)
   * @param data - Data to hash
   * @returns 32-byte hash
   * @example
   * const hash = HoosatCrypto.blake3Hash(Buffer.from('hello'));
   */
  static blake3Hash(data: Buffer): Buffer {
    return Buffer.from(blake3.hash(data));
  }

  /**
   * Computes double Blake3 hash (for transaction IDs)
   * @param data - Data to hash
   * @returns 32-byte double hash
   * @example
   * const doubleHash = HoosatCrypto.doubleBlake3Hash(txData);
   */
  static doubleBlake3Hash(data: Buffer): Buffer {
    return this.blake3Hash(this.blake3Hash(data));
  }

  /**
   * Computes Blake3 keyed hash (Hoosat-specific)
   * Used internally for signature hashing
   * @param key - 32-byte key or string (auto-padded with zeros)
   * @param data - Data to hash
   * @returns 32-byte keyed hash
   * @example
   * const hash = HoosatCrypto.blake3KeyedHash('TransactionSigningHash', data);
   */
  static blake3KeyedHash(key: Buffer | string, data: Buffer): Buffer {
    let keyBuffer: Uint8Array;

    if (typeof key === 'string') {
      const encoder = new TextEncoder();
      const fixedSizeKey = new Uint8Array(32);
      encoder.encodeInto(key, fixedSizeKey);
      keyBuffer = fixedSizeKey;
    } else if (key.length === 32) {
      keyBuffer = new Uint8Array(key);
    } else {
      throw new Error(`Blake3 key must be 32 bytes, got ${key.length}`);
    }

    return Buffer.from(blake3.keyedHash(Buffer.from(keyBuffer), data));
  }

  /**
   * Calculates transaction ID (double Blake3 hash)
   * @param transaction - Signed transaction object
   * @returns 64-character hex transaction ID
   * @example
   * const txId = HoosatCrypto.getTransactionId(signedTx);
   */
  static getTransactionId(transaction: Transaction): string {
    const txData = this.serializeTransactionForID(transaction);
    const hash = this.doubleBlake3Hash(txData);
    return hash.toString('hex');
  }

  // ==================== KEY MANAGEMENT ====================

  /**
   * Generates a new ECDSA key pair with Hoosat address
   * @param network - Network type: 'mainnet' or 'testnet' (default: 'mainnet')
   * @returns KeyPair object containing privateKey, publicKey, and address
   * @example
   * const mainnetWallet = HoosatCrypto.generateKeyPair();
   * const testnetWallet = HoosatCrypto.generateKeyPair('testnet');
   */
  static generateKeyPair(network: HoosatNetwork = 'mainnet'): KeyPair {
    let privateKey: Buffer;
    let publicKey: Buffer;

    do {
      privateKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privateKey));

    publicKey = Buffer.from(secp256k1.publicKeyCreate(privateKey, true));
    const address = this.publicKeyToAddressECDSA(publicKey, network);

    return { privateKey, publicKey, address };
  }

  /**
   * Derives public key from private key
   * @param privateKey - 32-byte private key buffer
   * @returns 33-byte compressed ECDSA public key
   * @example
   * const publicKey = HoosatCrypto.getPublicKey(privateKey);
   */
  static getPublicKey(privateKey: Buffer): Buffer {
    if (!secp256k1.privateKeyVerify(privateKey)) {
      throw new Error('Invalid private key');
    }
    return Buffer.from(secp256k1.publicKeyCreate(privateKey, true));
  }

  /**
   * Derives Schnorr (x-only) public key from private key.
   *
   * Hoosat Schnorr addresses (version 0x00) use a 32-byte x-only public key.
   * This is the x-coordinate of the secp256k1 public point.
   */
  static getSchnorrPublicKey(privateKey: Buffer): Buffer {
    const compressed = this.getPublicKey(privateKey);
    // Compressed public key format: 0x02/0x03 + 32-byte X coordinate
    return compressed.subarray(1, 33);
  }

  /**
   * Imports wallet from hex-encoded private key
   * @param privateKeyHex - 64-character hex string (32 bytes)
   * @param network - Network type: 'mainnet' or 'testnet' (default: 'mainnet')
   * @throws Error if private key is invalid
   * @example
   * const mainnetWallet = HoosatCrypto.importKeyPair('33a4a81e...');
   * const testnetWallet = HoosatCrypto.importKeyPair('33a4a81e...', 'testnet');
   */
  static importKeyPair(privateKeyHex: string, network: HoosatNetwork = 'mainnet'): KeyPair {
    const privateKey = Buffer.from(privateKeyHex, 'hex');

    if (privateKey.length !== 32) {
      throw new Error(`Private key must be 32 bytes, got ${privateKey.length}`);
    }

    if (!secp256k1.privateKeyVerify(privateKey)) {
      throw new Error('Invalid private key');
    }

    const publicKey = this.getPublicKey(privateKey);
    const address = this.publicKeyToAddressECDSA(publicKey, network);

    return { privateKey, publicKey, address };
  }

  // ==================== ADDRESS OPERATIONS ====================

  /**
   * Converts Schnorr public key to Hoosat address (version 0x00)
   * @param publicKey - 32-byte Schnorr public key
   * @param network - Network type: 'mainnet' or 'testnet' (default: 'mainnet')
   * @returns Bech32-encoded address
   * @example
   * const mainnetAddr = HoosatCrypto.publicKeyToAddress(schnorrPubkey);
   * const testnetAddr = HoosatCrypto.publicKeyToAddress(schnorrPubkey, 'testnet');
   */
  static publicKeyToAddress(publicKey: Buffer, network: HoosatNetwork = 'mainnet'): string {
    if (publicKey.length !== 32) {
      throw new Error(`Schnorr public key must be 32 bytes, got ${publicKey.length}`);
    }

    const prefix = network === 'testnet' ? HOOSAT_PARAMS.TESTNET_PREFIX : HOOSAT_PARAMS.MAINNET_PREFIX;

    return bech32Hoosat.encode(prefix, publicKey, 0x00);
  }

  /**
   * Converts ECDSA public key to Hoosat address (version 0x01)
   * @param publicKey - 33-byte compressed ECDSA public key
   * @param network - Network type: 'mainnet' or 'testnet' (default: 'mainnet')
   * @returns Bech32-encoded address with network prefix
   * @example
   * const mainnetAddr = HoosatCrypto.publicKeyToAddressECDSA(pubkey);
   * const testnetAddr = HoosatCrypto.publicKeyToAddressECDSA(pubkey, 'testnet');
   */
  static publicKeyToAddressECDSA(publicKey: Buffer, network: HoosatNetwork = 'mainnet'): string {
    if (publicKey.length !== 33) {
      throw new Error(`ECDSA public key must be 33 bytes, got ${publicKey.length}`);
    }

    const prefix = network === 'testnet' ? HOOSAT_PARAMS.TESTNET_PREFIX : HOOSAT_PARAMS.MAINNET_PREFIX;

    return bech32Hoosat.encode(prefix, publicKey, 0x01);
  }

  /**
   * Converts Hoosat address to ScriptPublicKey for transaction outputs
   * @param address - Bech32-encoded Hoosat address
   * @returns Script buffer (format: length + pubkey + opcode)
   * @throws Error for unsupported address versions
   * @example
   * const script = HoosatCrypto.addressToScriptPublicKey('hoosat:qyp...');
   * // For ECDSA: 0x21 + 33-byte pubkey + 0xAB (OP_CHECKSIGECDSA)
   */
  static addressToScriptPublicKey(address: string): Buffer {
    const decoded = bech32Hoosat.decode(address);

    // P2PK Schnorr (version 0x00)
    if (decoded.version === 0x00) {
      const dataLength = decoded.payload.length;
      return Buffer.concat([
        Buffer.from([dataLength]),
        decoded.payload,
        Buffer.from([0xac]), // OP_CHECKSIG
      ]);
    }

    // P2PK ECDSA (version 0x01)
    if (decoded.version === 0x01) {
      const dataLength = decoded.payload.length;
      return Buffer.concat([
        Buffer.from([dataLength]),
        decoded.payload,
        Buffer.from([0xab]), // OP_CHECKSIGECDSA
      ]);
    }

    // P2SH (version 0x08)
    if (decoded.version === 0x08) {
      return Buffer.concat([
        Buffer.from([0xaa]), // OP_BLAKE3
        Buffer.from([0x20]), // OP_DATA_32
        decoded.payload,
        Buffer.from([0x87]), // OP_EQUAL
      ]);
    }

    throw new Error(`Unsupported address version: ${decoded.version}`);
  }

  // ==================== TRANSACTION UTILITIES ====================

  /**
   * Calculates minimum transaction fee using MASS-BASED calculation
   * Based on HTND implementation (util\txmass\calculator.go)
   *
   * Formula:
   * 1. size = overhead + (inputs × inputSize) + (outputs × outputSize)
   * 2. massForSize = size × 1
   * 3. massForScriptPubKey = (outputs × scriptPubKeySize) × 10
   * 4. massForSigOps = inputs × 1000
   * 5. totalMass = massForSize + massForScriptPubKey + massForSigOps
   * 6. fee = totalMass (since minimumRelayTxFee = 1000, and fee = (totalMass × 1000) / 1000)
   *
   * @param inputCount - Number of inputs
   * @param outputCount - Number of outputs
   * @param payloadSize - Size of payload in bytes (default: 0). Required for subnetwork transactions with payload.
   * @returns Minimum fee amount in sompi as string
   *
   * @example
   * const fee = HoosatCrypto.calculateMinFee(5, 2);
   * // Returns: "7170" (for 5 inputs, 2 outputs)
   *
   * @example
   * // Transaction with 256-byte payload on subnetwork 0x03
   * const feeWithPayload = HoosatCrypto.calculateMinFee(5, 2, 256);
   */
  static calculateMinFee(inputCount: number, outputCount: number, payloadSize: number = 0): string {
    // 1. Calculate full transaction size (including inputs AND outputs)
    const txSize = HOOSAT_MASS.BaseTxOverhead + inputCount * HOOSAT_MASS.EstimatedInputSize + outputCount * HOOSAT_MASS.EstimatedOutputSize;

    // 2. Calculate script-only size for extra mass
    // From HTND: version(2) + script(len)
    const scriptPubKeySize = outputCount * HOOSAT_MASS.ScriptPubKeyBytesPerOutput;

    // 3. Calculate mass components
    const massForSize = txSize * HOOSAT_MASS.MassPerTxByte;
    const massForScriptPubKey = scriptPubKeySize * HOOSAT_MASS.MassPerScriptPubKeyByte;
    const massForSigOps = inputCount * HOOSAT_MASS.MassPerSigOp;

    // 4. Add payload mass if present (payload contributes directly to tx size)
    const massForPayload = payloadSize * HOOSAT_MASS.MassPerTxByte;

    const totalMass = massForSize + massForScriptPubKey + massForSigOps + massForPayload;

    // 5. Calculate fee: totalMass (minimumRelayTxFee = 1000, so fee = totalMass)
    const fee = totalMass;

    return fee.toString();
  }

  /**
   * Calculates a transaction fee estimate using a fee-rate-per-byte, with a safe
   * lower bound based on Hoosat's MASS-based minimum fee.
   *
   * This method exists for backward compatibility with earlier SDK versions and
   * for simple fee estimation when you only know input/output counts.
   *
   * @param inputCount - Number of inputs
   * @param outputCount - Number of outputs
   * @param feePerByte - Fee rate per byte (default: 1)
   * @param payloadSize - Optional payload size in bytes (default: 0)
   * @returns Fee in sompi as string
   */
  static calculateFee(inputCount: number, outputCount: number, feePerByte: number = 1, payloadSize: number = 0): string {
    if (!Number.isFinite(inputCount) || inputCount < 0) {
      throw new Error('inputCount must be a non-negative number');
    }
    if (!Number.isFinite(outputCount) || outputCount < 0) {
      throw new Error('outputCount must be a non-negative number');
    }
    if (!Number.isFinite(feePerByte) || feePerByte <= 0) {
      throw new Error('feePerByte must be a positive number');
    }
    if (!Number.isFinite(payloadSize) || payloadSize < 0) {
      throw new Error('payloadSize must be a non-negative number');
    }

    const estimatedSize =
      HOOSAT_MASS.BaseTxOverhead +
      inputCount * HOOSAT_MASS.EstimatedInputSize +
      outputCount * HOOSAT_MASS.EstimatedOutputSize +
      payloadSize;

    const sizeBasedFee = BigInt(Math.ceil(estimatedSize * feePerByte));
    const minFee = BigInt(this.calculateMinFee(inputCount, outputCount, payloadSize));

    return (sizeBasedFee > minFee ? sizeBasedFee : minFee).toString();
  }

  // ==================== TRANSACTION SIGNING ====================

  /**
   * Computes Schnorr signature hash (intermediate step)
   * Uses Blake3 keyed hash with "TransactionSigningHash" domain
   * @param transaction - Transaction to sign
   * @param inputIndex - Index of input to sign (0-based)
   * @param utxo - UTXO being spent
   * @param reusedValues - Cache for hash optimization (optional)
   * @returns 32-byte signature hash
   * @internal Exposed for testing/debugging only
   */
  static getSignatureHashSchnorr(
    transaction: Transaction,
    inputIndex: number,
    utxo: UtxoForSigning,
    reusedValues: SighashReusedValues = {}
  ): Buffer {
    const input = transaction.inputs[inputIndex];
    const hashType = HOOSAT_PARAMS.SIGHASH_ALL;
    const buffers: Buffer[] = [];

    const versionBuf = Buffer.alloc(2);
    versionBuf.writeUInt16LE(transaction.version, 0);
    buffers.push(versionBuf);

    buffers.push(this._getPreviousOutputsHash(transaction, hashType, reusedValues));
    buffers.push(this._getSequencesHash(transaction, hashType, reusedValues));
    buffers.push(this._getSigOpCountsHash(transaction, hashType, reusedValues));

    buffers.push(Buffer.from(input.previousOutpoint.transactionId, 'hex'));
    const indexBuf = Buffer.alloc(4);
    indexBuf.writeUInt32LE(input.previousOutpoint.index, 0);
    buffers.push(indexBuf);

    const scriptVersionBuf = Buffer.alloc(2);
    scriptVersionBuf.writeUInt16LE(0, 0);
    buffers.push(scriptVersionBuf);

    const prevScript = Buffer.from(utxo.utxoEntry.scriptPublicKey.script, 'hex');
    const scriptLengthBuf = Buffer.alloc(8);
    scriptLengthBuf.writeBigUInt64LE(BigInt(prevScript.length), 0);
    buffers.push(scriptLengthBuf);
    buffers.push(prevScript);

    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(utxo.utxoEntry.amount), 0);
    buffers.push(amountBuf);

    const sequenceBuf = Buffer.alloc(8);
    sequenceBuf.writeBigUInt64LE(BigInt(input.sequence), 0);
    buffers.push(sequenceBuf);

    buffers.push(Buffer.from([input.sigOpCount]));

    buffers.push(this._getOutputsHash(transaction, inputIndex, hashType, reusedValues));

    const lockTimeBuf = Buffer.alloc(8);
    lockTimeBuf.writeBigUInt64LE(BigInt(transaction.lockTime), 0);
    buffers.push(lockTimeBuf);

    buffers.push(Buffer.from(transaction.subnetworkId, 'hex'));

    const gasBuf = Buffer.alloc(8);
    gasBuf.writeBigUInt64LE(BigInt(transaction.gas), 0);
    buffers.push(gasBuf);

    buffers.push(this._getPayloadHash(transaction, reusedValues));

    buffers.push(Buffer.from([hashType]));

    const dataToHash = Buffer.concat(buffers);
    return this.blake3KeyedHash('TransactionSigningHash', dataToHash);
  }

  /**
   * Computes ECDSA signature hash (final step)
   * Formula: SHA256(SHA256("TransactionSigningHashECDSA") + schnorrHash)
   * @param transaction - Transaction to sign
   * @param inputIndex - Index of input to sign (0-based)
   * @param utxo - UTXO being spent
   * @param reusedValues - Cache for hash optimization (optional)
   * @returns 32-byte ECDSA signature hash
   * @internal Exposed for testing/debugging only
   */
  static getSignatureHashECDSA(
    transaction: Transaction,
    inputIndex: number,
    utxo: UtxoForSigning,
    reusedValues: SighashReusedValues = {}
  ): Buffer {
    const schnorrHash = this.getSignatureHashSchnorr(transaction, inputIndex, utxo, reusedValues);

    const domainHash = createHash('sha256').update('TransactionSigningHashECDSA').digest();
    const preimage = Buffer.concat([domainHash, schnorrHash]);

    return createHash('sha256').update(preimage).digest();
  }

  /**
   * Signs single transaction input with ECDSA
   * @param transaction - Transaction to sign
   * @param inputIndex - Index of input to sign (0-based)
   * @param privateKey - 32-byte private key
   * @param utxo - UTXO being spent (includes scriptPubKey)
   * @param reusedValues - Cache for hash optimization (optional)
   * @returns Signature object with 64-byte raw signature + pubkey
   * @internal Used by TxBuilder
   */
  static signTransactionInput(
    transaction: Transaction,
    inputIndex: number,
    privateKey: Buffer,
    utxo: UtxoForSigning,
    reusedValues: SighashReusedValues = {}
  ): TransactionSignature {
    const sigHash = this.getSignatureHashECDSA(transaction, inputIndex, utxo, reusedValues);

    const signature = secp256k1.ecdsaSign(sigHash, privateKey);
    const publicKey = this.getPublicKey(privateKey);

    return {
      signature: Buffer.from(signature.signature),
      publicKey,
      sigHashType: HOOSAT_PARAMS.SIGHASH_ALL,
    };
  }

  /**
   * Signs single transaction input with Schnorr.
   *
   * Note: Unlike ECDSA inputs, Schnorr scripts (OP_CHECKSIG) use the Schnorr
   * signature hash directly.
   */
  static signTransactionInputSchnorr(
    transaction: Transaction,
    inputIndex: number,
    privateKey: Buffer,
    utxo: UtxoForSigning,
    reusedValues: SighashReusedValues = {}
  ): TransactionSignature {
    const sigHash = this.getSignatureHashSchnorr(transaction, inputIndex, utxo, reusedValues);

    const schnorrSign = (secp256k1 as any).schnorrSign as undefined | ((msg32: Buffer, seckey: Buffer) => Uint8Array);
    if (!schnorrSign) {
      throw new Error('Schnorr signing is not supported by the installed secp256k1 library');
    }

    const signature = schnorrSign(sigHash, privateKey);
    const publicKey = this.getSchnorrPublicKey(privateKey);

    return {
      signature: Buffer.from(signature),
      publicKey,
      sigHashType: HOOSAT_PARAMS.SIGHASH_ALL,
    };
  }

  /**
   * Signs an input using the script opcode to choose Schnorr vs ECDSA.
   *
   * - OP_CHECKSIG (0xac) => Schnorr
   * - OP_CHECKSIGECDSA (0xab) => ECDSA
   */
  static signTransactionInputAuto(
    transaction: Transaction,
    inputIndex: number,
    privateKey: Buffer,
    utxo: UtxoForSigning,
    reusedValues: SighashReusedValues = {}
  ): TransactionSignature {
    const scriptHex = utxo?.utxoEntry?.scriptPublicKey?.script;
    if (typeof scriptHex === 'string' && scriptHex.length >= 2) {
      try {
        const script = Buffer.from(scriptHex, 'hex');
        const lastOpcode = script[script.length - 1];
        if (lastOpcode === 0xac) {
          return this.signTransactionInputSchnorr(transaction, inputIndex, privateKey, utxo, reusedValues);
        }
        if (lastOpcode === 0xab) {
          return this.signTransactionInput(transaction, inputIndex, privateKey, utxo, reusedValues);
        }
      } catch {
        // Fall through to default below
      }
    }

    // Default to legacy ECDSA signing
    return this.signTransactionInput(transaction, inputIndex, privateKey, utxo, reusedValues);
  }

  /**
   * Verifies ECDSA signature for transaction input
   * @param transaction - Transaction containing the input
   * @param inputIndex - Index of input to verify
   * @param signature - 64-byte raw ECDSA signature
   * @param publicKey - 33-byte compressed public key
   * @param utxo - UTXO that was spent
   * @returns true if signature is valid
   * @internal Used for testing/validation
   */
  static verifyTransactionSignature(
    transaction: Transaction,
    inputIndex: number,
    signature: Buffer,
    publicKey: Buffer,
    utxo: UtxoForSigning
  ): boolean {
    try {
      const sigHash = this.getSignatureHashECDSA(transaction, inputIndex, utxo);
      return secp256k1.ecdsaVerify(signature, sigHash, publicKey);
    } catch {
      return false;
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private static _getPreviousOutputsHash(tx: Transaction, hashType: number, reused: SighashReusedValues): Buffer {
    if (hashType & HOOSAT_PARAMS.SIGHASH_ANYONECANPAY) {
      return Buffer.alloc(32, 0);
    }

    if (!reused.previousOutputsHash) {
      const buffers: Buffer[] = [];
      for (const input of tx.inputs) {
        buffers.push(Buffer.from(input.previousOutpoint.transactionId, 'hex'));
        const indexBuf = Buffer.alloc(4);
        indexBuf.writeUInt32LE(input.previousOutpoint.index, 0);
        buffers.push(indexBuf);
      }
      reused.previousOutputsHash = this.blake3KeyedHash('TransactionSigningHash', Buffer.concat(buffers));
    }

    return reused.previousOutputsHash;
  }

  private static _getSequencesHash(tx: Transaction, hashType: number, reused: SighashReusedValues): Buffer {
    if (
      (hashType & 0x07) === HOOSAT_PARAMS.SIGHASH_SINGLE ||
      (hashType & 0x07) === HOOSAT_PARAMS.SIGHASH_NONE ||
      hashType & HOOSAT_PARAMS.SIGHASH_ANYONECANPAY
    ) {
      return Buffer.alloc(32, 0);
    }

    if (!reused.sequencesHash) {
      const buffers: Buffer[] = [];
      for (const input of tx.inputs) {
        const seqBuf = Buffer.alloc(8);
        seqBuf.writeBigUInt64LE(BigInt(input.sequence), 0);
        buffers.push(seqBuf);
      }
      reused.sequencesHash = this.blake3KeyedHash('TransactionSigningHash', Buffer.concat(buffers));
    }

    return reused.sequencesHash;
  }

  private static _getSigOpCountsHash(tx: Transaction, hashType: number, reused: SighashReusedValues): Buffer {
    if (hashType & HOOSAT_PARAMS.SIGHASH_ANYONECANPAY) {
      return Buffer.alloc(32, 0);
    }

    if (!reused.sigOpCountsHash) {
      const sigOpCounts = tx.inputs.map(input => input.sigOpCount);
      reused.sigOpCountsHash = this.blake3KeyedHash('TransactionSigningHash', Buffer.from(sigOpCounts));
    }

    return reused.sigOpCountsHash;
  }

  private static _getOutputsHash(tx: Transaction, inputIndex: number, hashType: number, reused: SighashReusedValues): Buffer {
    if ((hashType & 0x07) === HOOSAT_PARAMS.SIGHASH_NONE) {
      return Buffer.alloc(32, 0);
    }

    if ((hashType & 0x07) === HOOSAT_PARAMS.SIGHASH_SINGLE) {
      if (inputIndex >= tx.outputs.length) {
        return Buffer.alloc(32, 0);
      }

      const buffers: Buffer[] = [];
      const output = tx.outputs[inputIndex];

      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(BigInt(output.amount), 0);
      buffers.push(amountBuf);

      const versionBuf = Buffer.alloc(2);
      versionBuf.writeUInt16LE(0, 0);
      buffers.push(versionBuf);

      const script = Buffer.from(output.scriptPublicKey.scriptPublicKey, 'hex');
      const scriptLengthBuf = Buffer.alloc(8);
      scriptLengthBuf.writeBigUInt64LE(BigInt(script.length), 0);
      buffers.push(scriptLengthBuf);
      buffers.push(script);

      return this.blake3KeyedHash('TransactionSigningHash', Buffer.concat(buffers));
    }

    if (!reused.outputsHash) {
      const buffers: Buffer[] = [];

      for (const output of tx.outputs) {
        const amountBuf = Buffer.alloc(8);
        amountBuf.writeBigUInt64LE(BigInt(output.amount), 0);
        buffers.push(amountBuf);

        const versionBuf = Buffer.alloc(2);
        versionBuf.writeUInt16LE(0, 0);
        buffers.push(versionBuf);

        const script = Buffer.from(output.scriptPublicKey.scriptPublicKey, 'hex');
        const scriptLengthBuf = Buffer.alloc(8);
        scriptLengthBuf.writeBigUInt64LE(BigInt(script.length), 0);
        buffers.push(scriptLengthBuf);
        buffers.push(script);
      }

      reused.outputsHash = this.blake3KeyedHash('TransactionSigningHash', Buffer.concat(buffers));
    }

    return reused.outputsHash;
  }

  private static _getPayloadHash(tx: Transaction, reused: SighashReusedValues): Buffer {
    const isNative = Buffer.from(tx.subnetworkId, 'hex').equals(HOOSAT_PARAMS.SUBNETWORK_ID_NATIVE);
    if (isNative) {
      return Buffer.alloc(32, 0);
    }

    if (!reused.payloadHash) {
      const payload = Buffer.from(tx.payload, 'hex');
      const payloadLenBuf = Buffer.alloc(8);
      payloadLenBuf.writeBigUInt64LE(BigInt(payload.length), 0);
      reused.payloadHash = this.blake3KeyedHash('TransactionSigningHash', Buffer.concat([payloadLenBuf, payload]));
    }

    return reused.payloadHash;
  }

  static serializeTransactionForID(transaction: Transaction): Buffer {
    const buffers: Buffer[] = [];

    const versionBuf = Buffer.alloc(2);
    versionBuf.writeUInt16LE(transaction.version, 0);
    buffers.push(versionBuf);

    const inputsLengthBuf = Buffer.alloc(8);
    inputsLengthBuf.writeBigUInt64LE(BigInt(transaction.inputs.length), 0);
    buffers.push(inputsLengthBuf);

    for (const input of transaction.inputs) {
      buffers.push(Buffer.from(input.previousOutpoint.transactionId, 'hex').reverse());
      const indexBuf = Buffer.alloc(4);
      indexBuf.writeUInt32LE(input.previousOutpoint.index, 0);
      buffers.push(indexBuf);

      const sigScript = Buffer.from(input.signatureScript, 'hex');
      const sigScriptLengthBuf = Buffer.alloc(8);
      sigScriptLengthBuf.writeBigUInt64LE(BigInt(sigScript.length), 0);
      buffers.push(sigScriptLengthBuf);
      buffers.push(sigScript);

      const seqBuf = Buffer.alloc(8);
      seqBuf.writeBigUInt64LE(BigInt(input.sequence), 0);
      buffers.push(seqBuf);
    }

    const outputsLengthBuf = Buffer.alloc(8);
    outputsLengthBuf.writeBigUInt64LE(BigInt(transaction.outputs.length), 0);
    buffers.push(outputsLengthBuf);

    for (const output of transaction.outputs) {
      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(BigInt(output.amount), 0);
      buffers.push(amountBuf);

      const versionBuf = Buffer.alloc(2);
      versionBuf.writeUInt16LE(output.scriptPublicKey.version, 0);
      buffers.push(versionBuf);

      const script = Buffer.from(output.scriptPublicKey.scriptPublicKey, 'hex');
      const scriptLengthBuf = Buffer.alloc(8);
      scriptLengthBuf.writeBigUInt64LE(BigInt(script.length), 0);
      buffers.push(scriptLengthBuf);
      buffers.push(script);
    }

    const lockTimeBuf = Buffer.alloc(8);
    lockTimeBuf.writeBigUInt64LE(BigInt(transaction.lockTime), 0);
    buffers.push(lockTimeBuf);

    buffers.push(Buffer.from(transaction.subnetworkId, 'hex'));

    const gasBuf = Buffer.alloc(8);
    gasBuf.writeBigUInt64LE(BigInt(transaction.gas || '0'), 0);
    buffers.push(gasBuf);

    const payload = transaction.payload ? Buffer.from(transaction.payload, 'hex') : Buffer.alloc(32, 0);
    buffers.push(payload);

    return Buffer.concat(buffers);
  }
}
