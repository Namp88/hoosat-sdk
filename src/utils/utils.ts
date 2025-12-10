import * as bech32Hoosat from '@libs/bech32-hoosat';
import { VALIDATION_PARAMS } from '@constants/validation-params.const';
import { HOOSAT_PARAMS } from '@constants/hoosat-params.const';

export class HoosatUtils {
  // ==================== AMOUNT CONVERSION ====================

  /**
   * Formats an amount from sompi (smallest unit) to HTN (readable format)
   * @param sompi - Amount in sompi as string or bigint
   * @returns Formatted amount in HTN with 8 decimal places
   * @example
   * HoosatUtils.sompiToAmount('100000000') // '1.00000000'
   */
  static sompiToAmount(sompi: string | bigint): string {
    const amount = typeof sompi === 'string' ? BigInt(sompi) : sompi;
    return (Number(amount) / 100000000).toFixed(8);
  }

  /**
   * Parses an amount from HTN (readable format) to sompi (smallest unit)
   * @param htn - Amount in HTN as string
   * @returns Amount in sompi as string
   * @example
   * HoosatUtils.amountToSompi('1.5') // '150000000'
   */
  static amountToSompi(htn: string): string {
    const amount = parseFloat(htn) * 100000000;
    return BigInt(Math.round(amount)).toString();
  }

  /**
   * Formats amount with thousands separators for display
   * @param htn - Amount in HTN as string
   * @param decimals - Number of decimal places (default: 8)
   * @returns Formatted string with separators
   * @example
   * HoosatUtils.formatAmount('1234567.89') // '1,234,567.89000000'
   */
  static formatAmount(htn: string, decimals = 8): string {
    const num = parseFloat(htn);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // ==================== ADDRESS VALIDATION ====================

  /**
   * Validates a Hoosat address format (both mainnet and testnet)
   * @param address - HTN address as string
   * @returns True if valid, false otherwise
   * @example
   * HoosatUtils.isValidAddress('hoosat:qz7ulu...') // mainnet - true
   * HoosatUtils.isValidAddress('hoosattest:qreey20...') // testnet - true
   */
  static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Check both mainnet and testnet prefixes
    const hasValidPrefix =
      address.startsWith(HOOSAT_PARAMS.MAINNET_ADDRESS_PREFIX) || address.startsWith(HOOSAT_PARAMS.TESTNET_ADDRESS_PREFIX);

    if (!hasValidPrefix) {
      return false;
    }

    try {
      const decoded = bech32Hoosat.decode(address);
      return [0x00, 0x01, 0x08].includes(decoded.version);
    } catch {
      return false;
    }
  }

  /**
   * Validates an array of Hoosat addresses
   * @param addresses - Array of addresses to validate
   * @param checkUnique - Whether to check for duplicate addresses (default: false)
   * @returns True if all addresses are valid, false otherwise
   * @example
   * HoosatUtils.isValidAddresses(['hoosat:qz7...', 'hoosat:qyp...']) // true
   */
  static isValidAddresses(addresses: string[], checkUnique = false): boolean {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return false;
    }

    if (addresses.length > VALIDATION_PARAMS.MAX_ADDRESSES_BATCH) {
      return false;
    }

    // Check uniqueness if requested
    if (checkUnique) {
      const uniqueAddresses = new Set(addresses);
      if (uniqueAddresses.size !== addresses.length) {
        return false;
      }
    }

    // Validate each address
    return addresses.every(addr => this.isValidAddress(addr));
  }

  /**
   * Gets the version of a Hoosat address
   * @param address - HTN address as string
   * @returns Version number (0x00, 0x01, 0x08) or null if invalid
   * @example
   * HoosatUtils.getAddressVersion('hoosat:qyp...') // 0x01 (ECDSA)
   */
  static getAddressVersion(address: string): number | null {
    try {
      const decoded = bech32Hoosat.decode(address);
      return decoded.version;
    } catch {
      return null;
    }
  }

  /**
   * Gets the type of a Hoosat address
   * @param address - HTN address as string
   * @returns Address type: 'schnorr' | 'ecdsa' | 'p2sh' | null if invalid
   * @example
   * HoosatUtils.getAddressType('hoosat:qyp...') // 'ecdsa'
   */
  static getAddressType(address: string): 'schnorr' | 'ecdsa' | 'p2sh' | null {
    const version = this.getAddressVersion(address);
    if (version === null) return null;

    switch (version) {
      case 0x00:
        return 'schnorr';
      case 0x01:
        return 'ecdsa';
      case 0x08:
        return 'p2sh';
      default:
        return null;
    }
  }

  /**
   * Gets the network type from a Hoosat address
   * @param address - HTN address as string
   * @returns Network type: 'mainnet' | 'testnet' | null if invalid
   * @example
   * HoosatUtils.getAddressNetwork('hoosat:qz7ulu...') // 'mainnet'
   * HoosatUtils.getAddressNetwork('hoosattest:qreey20...') // 'testnet'
   */
  static getAddressNetwork(address: string): 'mainnet' | 'testnet' | null {
    if (!address || typeof address !== 'string') {
      return null;
    }

    if (address.startsWith(HOOSAT_PARAMS.MAINNET_ADDRESS_PREFIX)) {
      return 'mainnet';
    }

    if (address.startsWith(HOOSAT_PARAMS.TESTNET_ADDRESS_PREFIX)) {
      return 'testnet';
    }

    return null;
  }

  // ==================== HASH VALIDATION ====================

  /**
   * Validates a hexadecimal hash
   * @param hash - Hash string to validate
   * @param length - Expected length in characters (default: 64 for 32 bytes)
   * @returns True if valid hex hash, false otherwise
   * @example
   * HoosatUtils.isValidHash('a1b2c3...') // true if 64 chars
   */
  static isValidHash(hash: string, length: number = VALIDATION_PARAMS.HEX_HASH_LENGTH): boolean {
    if (!hash || typeof hash !== 'string') {
      return false;
    }

    const pattern = new RegExp(`^[a-fA-F0-9]{${length}}$`);
    return pattern.test(hash);
  }

  /**
   * Validates a transaction ID
   * @param txId - Transaction ID to validate
   * @returns True if valid transaction ID, false otherwise
   * @example
   * HoosatUtils.isValidTransactionId('091ea22a707ac840...') // true
   */
  static isValidTransactionId(txId: string): boolean {
    return this.isValidHash(txId, VALIDATION_PARAMS.HEX_HASH_LENGTH);
  }

  /**
   * Validates a block hash
   * @param blockHash - Block hash to validate
   * @returns True if valid block hash, false otherwise
   * @example
   * HoosatUtils.isValidBlockHash('a1b2c3d4e5f6...') // true
   */
  static isValidBlockHash(blockHash: string): boolean {
    return this.isValidHash(blockHash, VALIDATION_PARAMS.HEX_HASH_LENGTH);
  }

  /**
   * Validates an array of hashes
   * @param hashes - Array of hashes to validate
   * @param length - Expected length of each hash (default: 64)
   * @returns True if all hashes are valid, false otherwise
   * @example
   * HoosatUtils.isValidHashes(['a1b2...', 'c3d4...']) // true
   */
  static isValidHashes(hashes: string[], length = VALIDATION_PARAMS.HEX_HASH_LENGTH): boolean {
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return false;
    }

    return hashes.every(hash => this.isValidHash(hash, length));
  }

  // ==================== KEY VALIDATION ====================

  /**
   * Validates a private key
   * @param privateKey - Private key as hex string
   * @returns True if valid 32-byte private key, false otherwise
   * @example
   * HoosatUtils.isValidPrivateKey('33a4a81e...') // true if 64 chars
   */
  static isValidPrivateKey(privateKey: string): boolean {
    return this.isValidHash(privateKey, 64); // 32 bytes = 64 hex chars
  }

  /**
   * Validates a public key
   * @param publicKey - Public key as hex string
   * @param compressed - Whether key is compressed (default: true)
   * @returns True if valid public key, false otherwise
   * @example
   * HoosatUtils.isValidPublicKey('02eddf8d...') // true if 66 chars (compressed)
   */
  static isValidPublicKey(publicKey: string, compressed = true): boolean {
    const expectedLength: number = compressed ? 66 : 130; // 33 or 65 bytes
    return this.isValidHash(publicKey, expectedLength);
  }

  // ==================== AMOUNT VALIDATION ====================

  /**
   * Validates an amount string
   * @param amount - Amount to validate (in HTN or sompi)
   * @param maxDecimals - Maximum decimal places (default: 8)
   * @returns True if valid amount, false otherwise
   * @example
   * HoosatUtils.isValidAmount('1.5') // true
   * HoosatUtils.isValidAmount('1.123456789') // false (too many decimals)
   */
  static isValidAmount(amount: string, maxDecimals = 8): boolean {
    if (!amount || typeof amount !== 'string') {
      return false;
    }

    // Check if it's a valid number
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) {
      return false;
    }

    // Check decimal places
    const parts = amount.split('.');
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      return false;
    }

    return true;
  }

  // ==================== FORMATTING UTILITIES ====================

  /**
   * Truncates an address for display in UI
   * @param address - Full address
   * @param startChars - Characters to show at start (default: 12)
   * @param endChars - Characters to show at end (default: 8)
   * @returns Truncated address with ellipsis
   * @example
   * HoosatUtils.truncateAddress('hoosat:qz7ulu...abc123')
   * // 'hoosat:qz7ul...abc123'
   */
  static truncateAddress(address: string, startChars = 12, endChars = 8): string {
    if (!address || address.length <= startChars + endChars) {
      return address;
    }

    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  /**
   * Truncates a hash for display in UI
   * @param hash - Full hash
   * @param startChars - Characters to show at start (default: 8)
   * @param endChars - Characters to show at end (default: 8)
   * @returns Truncated hash with ellipsis
   * @example
   * HoosatUtils.truncateHash('a1b2c3d4e5f6...xyz') // 'a1b2c3d4...xyz'
   */
  static truncateHash(hash: string, startChars = 8, endChars = 8): string {
    if (!hash || hash.length <= startChars + endChars) {
      return hash;
    }

    return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
  }

  /**
   * Compares two addresses for equality (case-insensitive)
   * @param address1 - First address
   * @param address2 - Second address
   * @returns True if addresses are equal, false otherwise
   * @example
   * HoosatUtils.compareAddresses('hoosat:QZ7...', 'hoosat:qz7...') // true
   */
  static compareAddresses(address1: string, address2: string): boolean {
    if (!address1 || !address2) {
      return false;
    }

    return address1.toLowerCase() === address2.toLowerCase();
  }

  /**
   * Compares two hashes for equality (case-insensitive)
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns True if hashes are equal, false otherwise
   * @example
   * HoosatUtils.compareHashes('A1B2C3...', 'a1b2c3...') // true
   */
  static compareHashes(hash1: string, hash2: string): boolean {
    if (!hash1 || !hash2) {
      return false;
    }

    return hash1.toLowerCase() === hash2.toLowerCase();
  }

  // ==================== HASHRATE / DIFFICULTY FORMATTING ====================

  /**
   * Formats hashrate to human-readable format with automatic unit selection
   * @param hashrate - Hashrate value as number or string (H/s)
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted hashrate string with unit (e.g., '1.50 TH/s')
   * @example
   * HoosatUtils.formatHashrate(1500000000000) // '1.50 TH/s'
   * HoosatUtils.formatHashrate('150000000') // '150.00 MH/s'
   */
  static formatHashrate(hashrate: number | string, decimals = 2): string {
    const rate = typeof hashrate === 'string' ? parseFloat(hashrate) : hashrate;

    if (isNaN(rate) || rate < 0) {
      return '0 H/s';
    }

    const units = [
      { threshold: 1e18, suffix: 'EH/s' }, // Exahash
      { threshold: 1e15, suffix: 'PH/s' }, // Petahash
      { threshold: 1e12, suffix: 'TH/s' }, // Terahash
      { threshold: 1e9, suffix: 'GH/s' }, // Gigahash
      { threshold: 1e6, suffix: 'MH/s' }, // Megahash
      { threshold: 1e3, suffix: 'KH/s' }, // Kilohash
      { threshold: 1, suffix: 'H/s' }, // Hash
    ];

    for (const unit of units) {
      if (rate >= unit.threshold) {
        const value = rate / unit.threshold;
        return `${value.toFixed(decimals)} ${unit.suffix}`;
      }
    }

    return `${rate.toFixed(decimals)} H/s`;
  }

  /**
   * Formats difficulty to human-readable format with automatic unit selection
   * @param difficulty - Difficulty value as number or string
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted difficulty string with unit (e.g., '1.50 T')
   * @example
   * HoosatUtils.formatDifficulty(1500000000000) // '1.50 T'
   * HoosatUtils.formatDifficulty('150000000') // '150.00 M'
   */
  static formatDifficulty(difficulty: number | string, decimals = 2): string {
    const diff = typeof difficulty === 'string' ? parseFloat(difficulty) : difficulty;

    if (isNaN(diff) || diff < 0) {
      return '0';
    }

    const units = [
      { threshold: 1e18, suffix: 'E' }, // Exa
      { threshold: 1e15, suffix: 'P' }, // Peta
      { threshold: 1e12, suffix: 'T' }, // Tera
      { threshold: 1e9, suffix: 'G' }, // Giga
      { threshold: 1e6, suffix: 'M' }, // Mega
      { threshold: 1e3, suffix: 'K' }, // Kilo
      { threshold: 1, suffix: '' },
    ];

    for (const unit of units) {
      if (diff >= unit.threshold) {
        const value = diff / unit.threshold;
        return `${value.toFixed(decimals)}${unit.suffix ? ' ' + unit.suffix : ''}`;
      }
    }

    return diff.toFixed(decimals);
  }

  /**
   * Parses formatted hashrate string to numeric value in H/s
   * @param formatted - Formatted hashrate string (e.g., '1.5 TH/s')
   * @returns Numeric hashrate value in H/s or null if invalid
   * @example
   * HoosatUtils.parseHashrate('1.5 TH/s') // 1500000000000
   */
  static parseHashrate(formatted: string): number | null {
    if (!formatted || typeof formatted !== 'string') {
      return null;
    }

    const match = formatted.match(/^([\d.]+)\s*(EH|PH|TH|GH|MH|KH|H)?\/s$/i);
    if (!match) {
      return null;
    }

    const value = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase() || 'H';

    const multipliers: Record<string, number> = {
      EH: 1e18,
      PH: 1e15,
      TH: 1e12,
      GH: 1e9,
      MH: 1e6,
      KH: 1e3,
      H: 1,
    };

    return value * (multipliers[unit] || 1);
  }

  // ==================== CONVERSION UTILITIES ====================

  /**
   * Converts hex string to Buffer
   * @param hex - Hex string
   * @returns Buffer or null if invalid
   * @example
   * HoosatUtils.hexToBuffer('a1b2c3') // Buffer<a1 b2 c3>
   */
  static hexToBuffer(hex: string): Buffer | null {
    if (!hex || typeof hex !== 'string') {
      return null;
    }

    try {
      return Buffer.from(hex, 'hex');
    } catch {
      return null;
    }
  }

  /**
   * Converts Buffer to hex string
   * @param buffer - Buffer to convert
   * @returns Hex string
   * @example
   * HoosatUtils.bufferToHex(Buffer.from([161, 178, 195])) // 'a1b2c3'
   */
  static bufferToHex(buffer: Buffer): string {
    return buffer.toString('hex');
  }

  // ==================== UTXO UTILITIES ====================

  /**
   * Filters UTXOs to return only mature (spendable) ones
   *
   * Coinbase UTXOs require a minimum number of confirmations (100 blocks) before they can be spent.
   * Regular (non-coinbase) UTXOs are always spendable.
   *
   * @param utxos - Array of UTXOs to filter
   * @param currentDaaScore - Current DAA score from the network (from getBlockDagInfo().virtualDaaScore)
   * @param coinbaseMaturity - Minimum confirmations required for coinbase UTXOs (default: 100)
   * @returns Filtered array containing only mature (spendable) UTXOs
   *
   * @example
   * const dagInfo = await client.getBlockDagInfo();
   * const currentDaa = parseInt(dagInfo.result.virtualDaaScore);
   * const utxos = await client.getUtxosByAddresses([address]);
   * const spendableUtxos = HoosatUtils.filterMatureUtxos(utxos.result.utxos, currentDaa);
   *
   * @example
   * // Custom maturity requirement (e.g., wait for 200 blocks)
   * const extraSafeUtxos = HoosatUtils.filterMatureUtxos(utxos, currentDaa, 200);
   */
  static filterMatureUtxos<T extends { utxoEntry: { isCoinbase: boolean; blockDaaScore: string } }>(
    utxos: T[],
    currentDaaScore: number,
    coinbaseMaturity: number = 100
  ): T[] {
    return utxos.filter(utxo => {
      // Regular UTXOs are always spendable
      if (!utxo.utxoEntry.isCoinbase) {
        return true;
      }

      // Coinbase UTXOs need sufficient confirmations
      const confirmations = currentDaaScore - parseInt(utxo.utxoEntry.blockDaaScore);
      return confirmations >= coinbaseMaturity;
    });
  }

  /**
   * Separates UTXOs into mature and immature groups
   *
   * @param utxos - Array of UTXOs to separate
   * @param currentDaaScore - Current DAA score from the network
   * @param coinbaseMaturity - Minimum confirmations required for coinbase UTXOs (default: 100)
   * @returns Object with 'mature' and 'immature' arrays
   *
   * @example
   * const dagInfo = await client.getBlockDagInfo();
   * const currentDaa = parseInt(dagInfo.result.virtualDaaScore);
   * const utxos = await client.getUtxosByAddresses([address]);
   * const { mature, immature } = HoosatUtils.separateMatureUtxos(utxos.result.utxos, currentDaa);
   *
   * console.log(`Spendable: ${mature.length}, Waiting: ${immature.length}`);
   */
  static separateMatureUtxos<T extends { utxoEntry: { isCoinbase: boolean; blockDaaScore: string } }>(
    utxos: T[],
    currentDaaScore: number,
    coinbaseMaturity: number = 100
  ): { mature: T[]; immature: T[] } {
    const mature: T[] = [];
    const immature: T[] = [];

    for (const utxo of utxos) {
      if (!utxo.utxoEntry.isCoinbase) {
        // Regular UTXOs are always mature
        mature.push(utxo);
      } else {
        // Check coinbase maturity
        const confirmations = currentDaaScore - parseInt(utxo.utxoEntry.blockDaaScore);
        if (confirmations >= coinbaseMaturity) {
          mature.push(utxo);
        } else {
          immature.push(utxo);
        }
      }
    }

    return { mature, immature };
  }

  // ==================== PAYLOAD DECODING ====================

  /**
   * Decodes hex-encoded payload to UTF-8 string
   * @param hexPayload - Hex-encoded payload string (with or without 0x prefix)
   * @returns Decoded UTF-8 string
   * @throws Error if payload is not valid hex
   * @example
   * HoosatUtils.decodePayload('48656c6c6f') // 'Hello'
   */
  static decodePayload(hexPayload: string): string {
    if (!hexPayload || hexPayload.length === 0) {
      return '';
    }

    // Remove 0x prefix if present
    const cleanHex = hexPayload.toLowerCase().replace(/^0x/, '');

    // Validate hex format
    if (!/^[0-9a-f]*$/.test(cleanHex)) {
      throw new Error(`Invalid hex payload format: ${hexPayload}`);
    }

    // Convert hex to buffer and decode as UTF-8
    const buffer = Buffer.from(cleanHex, 'hex');
    return buffer.toString('utf-8');
  }

  /**
   * Decodes hex-encoded payload and parses it as JSON
   * @param hexPayload - Hex-encoded JSON payload string
   * @returns Parsed JSON object
   * @throws Error if payload is not valid hex or JSON
   * @example
   * const data = HoosatUtils.parsePayloadAsJson('7b2274797065223a22766f7465227d');
   * // Returns: { type: 'vote' }
   */
  static parsePayloadAsJson<T = any>(hexPayload: string): T {
    const decoded = this.decodePayload(hexPayload);

    try {
      return JSON.parse(decoded) as T;
    } catch (error) {
      throw new Error(`Payload is not valid JSON: ${decoded}`);
    }
  }

  /**
   * Encodes UTF-8 string to hex payload
   * @param payload - UTF-8 string to encode
   * @returns Hex-encoded payload string
   * @example
   * HoosatUtils.encodePayload('Hello') // '48656c6c6f'
   */
  static encodePayload(payload: string): string {
    if (!payload || payload.length === 0) {
      return '';
    }

    return Buffer.from(payload, 'utf-8').toString('hex');
  }

  /**
   * Encodes JSON object to hex payload
   * @param data - Object to encode as JSON payload
   * @returns Hex-encoded JSON payload string
   * @example
   * HoosatUtils.encodePayloadAsJson({ type: 'vote' }) // '7b2274797065223a22766f7465227d'
   */
  static encodePayloadAsJson(data: any): string {
    const json = JSON.stringify(data);
    return this.encodePayload(json);
  }

  /**
   * Checks if payload is valid JSON after decoding
   * @param hexPayload - Hex-encoded payload string
   * @returns True if payload is valid JSON, false otherwise
   * @example
   * HoosatUtils.isJsonPayload('7b7d') // true (empty object)
   * HoosatUtils.isJsonPayload('48656c6c6f') // false ('Hello' is not JSON)
   */
  static isJsonPayload(hexPayload: string): boolean {
    try {
      this.parsePayloadAsJson(hexPayload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Decodes payload with fallback to raw hex if not valid UTF-8
   * @param hexPayload - Hex-encoded payload string
   * @returns Object with decoded string and metadata
   * @example
   * HoosatUtils.decodePayloadSafe('48656c6c6f')
   * // Returns: { decoded: 'Hello', isValidUtf8: true, isJson: false }
   */
  static decodePayloadSafe(hexPayload: string): {
    decoded: string;
    isValidUtf8: boolean;
    isJson: boolean;
    raw: string;
  } {
    const raw = hexPayload.toLowerCase().replace(/^0x/, '');

    try {
      const decoded = this.decodePayload(hexPayload);
      const isJson = this.isJsonPayload(hexPayload);

      return {
        decoded,
        isValidUtf8: true,
        isJson,
        raw,
      };
    } catch {
      return {
        decoded: raw,
        isValidUtf8: false,
        isJson: false,
        raw,
      };
    }
  }
}
