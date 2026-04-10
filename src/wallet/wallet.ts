import { EventEmitter } from 'events';
import { pbkdf2Sync } from 'crypto';
import { HOOSAT_PARAMS } from '@constants/hoosat-params.const';
import { HoosatCrypto } from '@crypto/crypto';
import type { KeyPair } from '@crypto/crypto.types';
import type { HoosatClient } from '@client/client';
import { HoosatUtils } from '@utils/utils';
import type { HoosatNetwork } from '@models/network.type';
import type { Transaction, TransactionOutput } from '@models/transaction.types';
import { deriveChild, derivePath, hdFromSeed, type HdNode } from '@wallet/hd';

export type WalletAddressRole = 'deposit' | 'change' | 'imported' | 'random';

export interface WalletAddressInfo {
  address: string;
  publicKey: string;
  role: WalletAddressRole;
  index?: number;
}

export interface WalletHdConfig {
  /** Compatibility mode for matching external wallet conventions (default: 'sdk') */
  mode?: 'sdk' | 'htnwallet';

  /** Seed for deterministic derivation (Buffer or string; hex is auto-detected) */
  seed?: Buffer | string;

  /** BIP39 mnemonic for deterministic derivation (htnwallet-compatible). If set, overrides `seed`. */
  mnemonic?: string;

  /** Optional BIP39 mnemonic passphrase (default: '') */
  mnemonicPassphrase?: string;

  /** Which address type to derive from child keys (default: 'ecdsa', or 'schnorr' in `mode: 'htnwallet'`) */
  keyType?: 'ecdsa' | 'schnorr';

  /** Purpose index (default: 44) */
  purpose?: number;

  /** Coin type index (default: 0, or 111111 in `mode: 'htnwallet'`) */
  coinType?: number;

  /** Account index (default: 0) */
  account?: number;

  /** Next deposit (external) address index (default: 0, or 1 in `mode: 'htnwallet'`) */
  nextDepositIndex?: number;

  /** Next change (internal) address index (default: 0) */
  nextChangeIndex?: number;
}

/**
 * Wallet configuration options
 */
export interface WalletConfig {
  /** Optional client for balance/UTXO refresh and broadcasting transactions */
  client?: HoosatClient;

  /** Address network for generated/imported keys (default: 'mainnet') */
  network?: HoosatNetwork;

  /** Import a single private key (hex) */
  privateKey?: string;

  /** Import multiple private keys (hex) */
  privateKeys?: string[];

  /** Deterministic wallet config for deriving deposit/change addresses */
  hd?: WalletHdConfig;

  /** Set the active address (must be one of the imported/generated addresses) */
  activeAddress?: string;
}

/**
 * Options for creating/importing a new address.
 */
export interface CreateAddressOptions {
  /** Whether the new address becomes the wallet's active address (default: true) */
  setActive?: boolean;
}

/**
 * UTXO with additional metadata for transaction building
 */
export interface WalletUtxo {
  address: string;
  transactionId: string;
  index: number;
  amount: string;
  scriptPublicKey: string;
  blockDaaScore: string;
  isCoinbase: boolean;
}

/**
 * Transaction build options
 */
export interface SendTransactionOptions {
  to: string;
  amount: string;
  fee?: string;
  changeAddress?: string;

  /** Restrict which wallet addresses can be used as funding sources */
  fromAddresses?: string[];
}

/**
 * HoosatWallet - Lightweight multi-address wallet helper.
 *
 * Features:
 * - Generate/import multiple addresses (ECDSA keypairs)
 * - Track UTXOs/balance for all owned addresses (when `client` provided)
 * - Build/sign/broadcast transactions using owned keys
 */
export class HoosatWallet extends EventEmitter {
  private readonly _client?: HoosatClient;
  private readonly _network: HoosatNetwork;

  private readonly _keyPairsByAddress = new Map<string, KeyPair>();
  private readonly _addressInfoByAddress = new Map<string, WalletAddressInfo>();

  private _hdAccountNode?: HdNode;
  private _hdKeyType: 'ecdsa' | 'schnorr' = 'ecdsa';
  private _nextDepositIndex = 0;
  private _nextChangeIndex = 0;
  private _activeAddress!: string;

  private _utxos: WalletUtxo[] = [];
  private _balance: bigint = 0n;

  constructor(config: WalletConfig = {}) {
    super();

    this._client = config.client;
    this._network = config.network ?? 'mainnet';

    const privateKeys = [...(config.privateKeys ?? []), ...(config.privateKey ? [config.privateKey] : [])].filter(Boolean);

    // 1) Deterministic (HD-like) wallet
    if (config.hd) {
      if (privateKeys.length > 0) {
        throw new Error('WalletConfig.hd cannot be used together with privateKey/privateKeys');
      }

      const mode = config.hd.mode ?? 'sdk';
      const seed = this._seedFromHdConfig(config.hd);

      const purpose = config.hd.purpose ?? 44;
      const coinType = config.hd.coinType ?? (mode === 'htnwallet' ? 111_111 : 0);
      const account = config.hd.account ?? 0;

      this._hdKeyType = config.hd.keyType ?? (mode === 'htnwallet' ? 'schnorr' : 'ecdsa');

      this._nextDepositIndex = config.hd.nextDepositIndex ?? (mode === 'htnwallet' ? 1 : 0);
      this._nextChangeIndex = config.hd.nextChangeIndex ?? 0;

      const root = hdFromSeed(seed);
      // m / purpose' / coinType' / account'
      this._hdAccountNode = derivePath(root, [
        { index: purpose, hardened: true },
        { index: coinType, hardened: true },
        { index: account, hardened: true },
      ]);

      // Ensure wallet starts with at least one deposit address
      const firstDeposit = this.createDepositAddress({ setActive: true });
      this._activeAddress = firstDeposit.address;
    }

    // 2) Imported key wallet (1..n keys)
    if (!config.hd && privateKeys.length > 0) {
      for (const privateKeyHex of privateKeys) {
        const keyPair = HoosatCrypto.importKeyPair(privateKeyHex, this._network);
        this._addKeyPair(keyPair, 'imported', false);
      }
      this._activeAddress = this.addresses[0]!;
    }

    // 3) Random single-key wallet (legacy convenience)
    if (!config.hd && privateKeys.length === 0) {
      const keyPair = HoosatCrypto.generateKeyPair(this._network);
      this._addKeyPair(keyPair, 'random', true);
      this._activeAddress = keyPair.address;
    }

    if (config.activeAddress) {
      this.setActiveAddress(config.activeAddress);
    }
  }

  // ==================== ADDRESS MANAGEMENT ====================

  /** Current wallet network */
  get network(): HoosatNetwork {
    return this._network;
  }

  /** Active address (default address) */
  get address(): string {
    return this._activeAddress;
  }

  /** All owned addresses */
  get addresses(): string[] {
    return Array.from(this._keyPairsByAddress.keys());
  }

  /** Active public key */
  get publicKey(): Buffer {
    return this._getKeyPair(this._activeAddress).publicKey;
  }

  /** Active private key (use with caution!) */
  get privateKey(): Buffer {
    return this._getKeyPair(this._activeAddress).privateKey;
  }

  /** Active private key as hex */
  getPrivateKeyHex(): string {
    return this.privateKey.toString('hex');
  }

  /** Returns metadata for all owned addresses */
  getAddressInfo(): WalletAddressInfo[] {
    return this.addresses.map(address => this._addressInfoByAddress.get(address)).filter((x): x is WalletAddressInfo => Boolean(x));
  }

  /**
   * Creates the next *deposit* address.
   *
   * If the wallet was created with `WalletConfig.hd`, this derives a new key
   * from the wallet seed (deterministic deposit chain).
   */
  createNewAddress(options: CreateAddressOptions = {}): KeyPair {
    return this.createDepositAddress(options);
  }

  /** Creates the next deposit (external) address from the wallet seed */
  createDepositAddress(options: CreateAddressOptions = {}): KeyPair {
    const node = this._requireHd();
    const setActive = options.setActive ?? true;

    // m/.../0/index
    const depositChain = deriveChild(node, 0, false);
    const child = deriveChild(depositChain, this._nextDepositIndex, false);
    const keyPair = this._keyPairFromPrivateKey(child.privateKey);

    const index = this._nextDepositIndex;
    this._nextDepositIndex += 1;

    this._addKeyPair(keyPair, 'deposit', setActive, index);

    this.emit('addressCreated', {
      address: keyPair.address,
      publicKey: keyPair.publicKey.toString('hex'),
      role: 'deposit' as const,
      index,
    });

    return keyPair;
  }

  /** Creates the next change (internal) address from the wallet seed */
  createChangeAddress(options: CreateAddressOptions = {}): KeyPair {
    const node = this._requireHd();
    const setActive = options.setActive ?? false;

    // m/.../1/index
    const changeChain = deriveChild(node, 1, false);
    const child = deriveChild(changeChain, this._nextChangeIndex, false);
    const keyPair = this._keyPairFromPrivateKey(child.privateKey);

    const index = this._nextChangeIndex;
    this._nextChangeIndex += 1;

    this._addKeyPair(keyPair, 'change', setActive, index);

    this.emit('changeAddressCreated', {
      address: keyPair.address,
      publicKey: keyPair.publicKey.toString('hex'),
      role: 'change' as const,
      index,
    });

    return keyPair;
  }

  /**
   * Imports a new address (private key) and adds it to this wallet.
   */
  importAddress(privateKeyHex: string, options: CreateAddressOptions = {}): KeyPair {
    const setActive = options.setActive ?? true;
    const keyPair = HoosatCrypto.importKeyPair(privateKeyHex, this._network);
    this._addKeyPair(keyPair, 'imported', setActive);

    this.emit('addressImported', {
      address: keyPair.address,
      publicKey: keyPair.publicKey.toString('hex'),
      role: 'imported' as const,
    });

    return keyPair;
  }

  /** Switch active address */
  setActiveAddress(address: string): void {
    if (!this._keyPairsByAddress.has(address)) {
      throw new Error('Address not found in wallet');
    }
    this._activeAddress = address;
    this.emit('activeAddressChanged', { address });
  }

  /** Exports active keypair data (WARNING: contains private key!) */
  export(): { address: string; privateKey: string; publicKey: string } {
    const keyPair = this._getKeyPair(this._activeAddress);
    return {
      address: keyPair.address,
      privateKey: keyPair.privateKey.toString('hex'),
      publicKey: keyPair.publicKey.toString('hex'),
    };
  }

  /** Exports all keypairs (WARNING: contains private keys!) */
  exportAll(): Array<{ address: string; privateKey: string; publicKey: string }> {
    return this.addresses.map(address => {
      const keyPair = this._getKeyPair(address);
      return {
        address,
        privateKey: keyPair.privateKey.toString('hex'),
        publicKey: keyPair.publicKey.toString('hex'),
      };
    });
  }

  // ==================== BALANCE & UTXO METHODS ====================

  /** Current total balance (sompi) for refreshed UTXOs */
  get balance(): string {
    return this._balance.toString();
  }

  /** Current total balance (HTN) for refreshed UTXOs */
  get balanceHTN(): string {
    return HoosatUtils.sompiToAmount(this._balance);
  }

  /** All refreshed UTXOs (across wallet addresses) */
  get utxos(): WalletUtxo[] {
    return [...this._utxos];
  }

  /**
   * Refreshes wallet balance and UTXOs from the network.
   * Requires `client` in config.
   */
  async refresh(): Promise<void> {
    const client = this._requireClient();

    const result = await client.getUtxosByAddresses(this.addresses);

    if (!result.ok || !result.result) {
      throw new Error('Failed to fetch UTXOs');
    }

    this._utxos = result.result.utxos.map(utxo => ({
      address: utxo.address,
      transactionId: utxo.outpoint.transactionId,
      index: utxo.outpoint.index,
      amount: utxo.utxoEntry.amount,
      scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
      blockDaaScore: utxo.utxoEntry.blockDaaScore,
      isCoinbase: utxo.utxoEntry.isCoinbase,
    }));

    this._balance = this._utxos.reduce((sum, utxo) => sum + BigInt(utxo.amount), 0n);

    this.emit('balanceUpdated', {
      balance: this.balance,
      balanceHTN: this.balanceHTN,
      utxoCount: this._utxos.length,
      addressCount: this.addresses.length,
    });
  }

  /**
   * Subscribes to real-time UTXO changes for all wallet addresses.
   * Requires `client` in config.
   */
  async subscribeToChanges(): Promise<void> {
    const client = this._requireClient();

    await client.events.subscribeToUtxoChanges(this.addresses);

    client.events.on('utxoChange', async notification => {
      if (!notification?.address) return;
      if (!this._keyPairsByAddress.has(notification.address)) return;

      await this.refresh();
      this.emit('utxoChange', notification);
    });
  }

  /** Unsubscribes from real-time UTXO changes. Requires `client` in config. */
  async unsubscribeFromChanges(): Promise<void> {
    const client = this._requireClient();
    await client.events.unsubscribeFromUtxoChanges();
  }

  // ==================== TRANSACTION METHODS ====================

  /**
   * Builds an unsigned transaction.
   *
   * Notes:
   * - Uses refreshed UTXOs. If wallet has not been refreshed yet, `refresh()` is called.
   * - If `fromAddresses` is provided, only UTXOs belonging to those addresses will be used.
   */
  async buildTransaction(options: SendTransactionOptions): Promise<Transaction> {
    const { to, amount, fee: customFee, changeAddress, fromAddresses } = options;

    if (!HoosatUtils.isValidAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    if (this._utxos.length === 0) {
      await this.refresh();
    }

    const allowedFrom = fromAddresses?.length ? new Set(fromAddresses) : null;
    if (allowedFrom && fromAddresses!.some(addr => !this._keyPairsByAddress.has(addr))) {
      throw new Error('fromAddresses contains an address not owned by this wallet');
    }

    const availableUtxos = allowedFrom ? this._utxos.filter(u => allowedFrom.has(u.address)) : this._utxos;

    const targetAmount = BigInt(amount);
    const changeAddr = changeAddress ?? this.address;

    if (!HoosatUtils.isValidAddress(changeAddr)) {
      throw new Error('Invalid change address');
    }

    // Select UTXOs (simple accumulative selection)
    let selectedAmount = 0n;
    const selectedUtxos: WalletUtxo[] = [];

    for (const utxo of availableUtxos) {
      selectedUtxos.push(utxo);
      selectedAmount += BigInt(utxo.amount);

      const estimatedFee = customFee ? BigInt(customFee) : BigInt(HoosatCrypto.calculateMinFee(selectedUtxos.length, 2));

      if (selectedAmount >= targetAmount + estimatedFee) {
        break;
      }
    }

    const finalFee = customFee ? BigInt(customFee) : BigInt(HoosatCrypto.calculateMinFee(selectedUtxos.length, 2));

    if (selectedAmount < targetAmount + finalFee) {
      throw new Error(`Insufficient balance. Need ${targetAmount + finalFee}, have ${selectedAmount}`);
    }

    const outputs: TransactionOutput[] = [];

    // Recipient output
    const recipientScript = HoosatCrypto.addressToScriptPublicKey(to);
    outputs.push({
      amount: targetAmount.toString(),
      scriptPublicKey: {
        scriptPublicKey: recipientScript.toString('hex'),
        version: 0,
      },
    });

    // Change output (if needed)
    const change = selectedAmount - targetAmount - finalFee;
    if (change > 0n) {
      const changeScript = HoosatCrypto.addressToScriptPublicKey(changeAddr);
      outputs.push({
        amount: change.toString(),
        scriptPublicKey: {
          scriptPublicKey: changeScript.toString('hex'),
          version: 0,
        },
      });
    }

    return {
      version: 0,
      inputs: selectedUtxos.map(utxo => ({
        previousOutpoint: {
          transactionId: utxo.transactionId,
          index: utxo.index,
        },
        signatureScript: '',
        sequence: '0',
        sigOpCount: 1,
        utxoEntry: {
          amount: utxo.amount,
          scriptPublicKey: {
            script: utxo.scriptPublicKey,
            version: 0,
          },
          blockDaaScore: utxo.blockDaaScore,
          isCoinbase: utxo.isCoinbase,
        },
      })),
      outputs,
      lockTime: '0',
      subnetworkId: HOOSAT_PARAMS.SUBNETWORK_ID_NATIVE.toString('hex'),
      gas: '0',
      payload: '',
      fee: finalFee.toString(),
    };
  }

  /**
   * Signs all inputs of a transaction.
   *
   * The wallet resolves which private key to use per input by matching the
   * input's outpoint to the wallet's refreshed UTXO set.
   */
  signTransaction(transaction: Transaction): Transaction {
    const signedTransaction: Transaction = {
      ...transaction,
      inputs: transaction.inputs.map(input => ({ ...input })),
      outputs: transaction.outputs.map(output => ({ ...output })),
    };

    for (let i = 0; i < signedTransaction.inputs.length; i++) {
      const input = signedTransaction.inputs[i];

      if (!input.utxoEntry) {
        throw new Error(`Missing UTXO entry for input ${i}`);
      }

      const keyPair = this._findKeyPairForOutpoint(input.previousOutpoint.transactionId, input.previousOutpoint.index);

      const signature = HoosatCrypto.signTransactionInputAuto(
        signedTransaction,
        i,
        keyPair.privateKey,
        {
          outpoint: input.previousOutpoint,
          utxoEntry: input.utxoEntry,
        },
        {}
      );

      // Build signature script: length + (64-byte sig + sigHashType)
      const sigWithType = Buffer.concat([signature.signature, Buffer.from([signature.sigHashType])]);
      const sigScript = Buffer.concat([Buffer.from([sigWithType.length]), sigWithType]);

      signedTransaction.inputs[i].signatureScript = sigScript.toString('hex');

      // utxoEntry is used only for signing; remove before broadcast
      delete signedTransaction.inputs[i].utxoEntry;
    }

    return signedTransaction;
  }

  /**
   * Builds, signs, and broadcasts a transaction.
   * Requires `client` in config.
   */
  async send(options: SendTransactionOptions): Promise<string> {
    const client = this._requireClient();

    const transaction = await this.buildTransaction(options);
    const signedTransaction = this.signTransaction(transaction);

    const result = await client.submitTransaction(signedTransaction);

    if (!result.ok || !result.result) {
      throw new Error('Failed to submit transaction');
    }

    await this.refresh();

    this.emit('transactionSent', {
      transactionId: result.result.transactionId,
      to: options.to,
      amount: options.amount,
    });

    return result.result.transactionId;
  }

  /** Gets wallet info (safe: no private keys) */
  getInfo(): {
    network: HoosatNetwork;
    activeAddress: string;
    addressCount: number;
    depositAddressCount: number;
    changeAddressCount: number;
    balance: string;
    balanceHTN: string;
    utxoCount: number;
  } {
    const infos = this.getAddressInfo();
    const depositAddressCount = infos.filter(i => i.role === 'deposit').length;
    const changeAddressCount = infos.filter(i => i.role === 'change').length;
    return {
      network: this._network,
      activeAddress: this._activeAddress,
      addressCount: this.addresses.length,
      depositAddressCount,
      changeAddressCount,
      balance: this.balance,
      balanceHTN: this.balanceHTN,
      utxoCount: this._utxos.length,
    };
  }

  // ==================== INTERNAL HELPERS ====================

  private _requireClient(): HoosatClient {
    if (!this._client) {
      throw new Error('Wallet was created without a client. Provide `client` in WalletConfig to use network features.');
    }
    return this._client;
  }

  private _addKeyPair(keyPair: KeyPair, role: WalletAddressRole, setActive: boolean, index?: number): void {
    if (!HoosatUtils.isValidAddress(keyPair.address)) {
      throw new Error('Generated/imported an invalid address');
    }

    const derivedNetwork = HoosatUtils.getAddressNetwork(keyPair.address);
    if (derivedNetwork && derivedNetwork !== this._network) {
      throw new Error(`KeyPair network mismatch. Wallet is '${this._network}' but key is '${derivedNetwork}'`);
    }

    if (this._keyPairsByAddress.has(keyPair.address)) {
      return; // idempotent
    }

    this._keyPairsByAddress.set(keyPair.address, keyPair);
    this._addressInfoByAddress.set(keyPair.address, {
      address: keyPair.address,
      publicKey: keyPair.publicKey.toString('hex'),
      role,
      ...(typeof index === 'number' ? { index } : {}),
    });

    if (setActive) {
      this._activeAddress = keyPair.address;
    }
  }

  private _getKeyPair(address: string): KeyPair {
    const keyPair = this._keyPairsByAddress.get(address);
    if (!keyPair) {
      throw new Error('Address not found in wallet');
    }
    return keyPair;
  }

  private _requireHd(): HdNode {
    if (!this._hdAccountNode) {
      throw new Error('This wallet was not created with `WalletConfig.hd`, so it cannot derive deposit/change addresses.');
    }
    return this._hdAccountNode;
  }

  private _seedFromHdConfig(config: WalletHdConfig): Buffer {
    if (config.mnemonic && String(config.mnemonic).trim().length > 0) {
      return this._bip39MnemonicToSeed(config.mnemonic, config.mnemonicPassphrase ?? '');
    }

    if (!config.seed) {
      throw new Error('WalletConfig.hd requires either `seed` or `mnemonic`');
    }

    return this._normalizeSeed(config.seed);
  }

  private _bip39MnemonicToSeed(mnemonic: string, passphrase: string): Buffer {
    // BIP39: seed = PBKDF2-HMAC-SHA512(mnemonic, "mnemonic" + passphrase, 2048, 64)
    const normalizedMnemonic = mnemonic.normalize('NFKD');
    const normalizedSalt = ('mnemonic' + (passphrase ?? '')).normalize('NFKD');
    return pbkdf2Sync(normalizedMnemonic, normalizedSalt, 2048, 64, 'sha512');
  }

  private _keyPairFromPrivateKey(privateKey: Buffer): KeyPair {
    if (this._hdKeyType === 'schnorr') {
      const publicKey = HoosatCrypto.getSchnorrPublicKey(privateKey);
      const address = HoosatCrypto.publicKeyToAddress(publicKey, this._network);
      return { privateKey, publicKey, address, network: this._network };
    }

    return HoosatCrypto.importKeyPair(privateKey.toString('hex'), this._network);
  }

  private _normalizeSeed(seed: Buffer | string): Buffer {
    if (Buffer.isBuffer(seed)) {
      return seed;
    }

    const s = String(seed);
    const isHex = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
    return isHex ? Buffer.from(s, 'hex') : Buffer.from(s, 'utf8');
  }

  private _findKeyPairForOutpoint(transactionId: string, index: number): KeyPair {
    const utxo = this._utxos.find(u => u.transactionId === transactionId && u.index === index);
    if (!utxo) {
      throw new Error('Cannot sign transaction: input UTXO not found in wallet. Refresh the wallet and rebuild the transaction.');
    }

    const keyPair = this._keyPairsByAddress.get(utxo.address);
    if (!keyPair) {
      throw new Error('Cannot sign transaction: missing private key for input address');
    }

    return keyPair;
  }
}
