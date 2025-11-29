import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { BaseResult } from '@models/base.result';
import { HoosatEventManager } from '@events/event-manager';
import { NodeManager } from '@client/node-manager';

// Services
import { AddressService } from '@client/services/address.service';
import { BlockchainService } from '@client/services/blockchain.service';
import { MempoolService } from '@client/services/mempool.service';
import { NetworkService } from '@client/services/network.service';
import { NodeInfoService } from '@client/services/node-info.service';
import { TransactionService } from '@client/services/transaction.service';
import { TransactionStatusService } from '@client/services/transaction-status.service';
import { TransactionFeeService } from '@client/services/fee.service';

// Result types
import { GetInfo } from '@client/models/result/get-info';
import { GetBlockDagInfo } from '@client/models/result/get-block-dag-info';
import { GetBlockCount } from '@client/models/result/get-block-count';
import { GetBlock } from '@client/models/result/get-block';
import { GetBlockByTransactionId } from '@client/models/result/get-block-by-transaction-id';
import { GetBlocks } from '@client/models/result/get-blocks';
import { GetSelectedTipHash } from '@client/models/result/get-selected-tip-hash';
import { GetVirtualSelectedParentBlueScore } from '@client/models/result/get-virtual-selected-parent-blue-score';
import { GetBalanceByAddress } from '@client/models/result/get-balance-by-address';
import { GetBalancesByAddresses } from '@client/models/result/get-balances-by-addresses';
import { GetUtxosByAddresses } from '@client/models/result/get-utxos-by-addresses';
import { GetMempoolEntry } from '@client/models/result/get-mempool-entry';
import { GetMempoolEntries } from '@client/models/result/get-mempool-entries';
import { GetMempoolEntriesByAddresses } from '@client/models/result/get-mempool-entries-by-addresses';
import { GetPeerAddresses } from '@client/models/result/get-peer-addresses';
import { GetConnectedPeerInfo } from '@client/models/result/get-connected-peer-info';
import { GetCurrentNetwork } from '@client/models/result/get-current-network';
import { EstimateNetworkHashesPerSecond } from '@client/models/result/estimate-network-hashes-per-second';
import { GetCoinSupply } from '@client/models/result/get-coin-supply';
import { SubmitTransaction } from '@client/models/result/submit-transaction';
import { GetTransactionStatus } from '@client/models/result/get-transaction-status';
import { Transaction } from '@models/transaction.types';
import { HoosatClientConfig } from '@client/client.types';

const GRPC_CONFIG = {
  MAX_MESSAGE_SIZE: 1024 * 1024 * 1024, // 1GB
} as const;

const CLIENT_DEFAULT_CONFIG = {
  HOST: '127.0.0.1',
  PORT: 42420,
  TIMEOUT: 10000,
} as const;

/**
 * HoosatClient - Main client for interacting with Hoosat blockchain nodes
 *
 * This class provides a complete interface for blockchain operations including:
 * - Node information and network status
 * - Blockchain queries (blocks, DAG info, etc.)
 * - Address and balance operations
 * - Transaction submission and status tracking
 * - Mempool queries
 * - Real-time event streaming via `client.events`
 * - Multi-node configuration with automatic failover (high availability)
 *
 * **Single-node mode** - Connect to one Hoosat node (simple setup)
 * **Multi-node mode** - Connect to multiple nodes with automatic health monitoring and failover
 *
 * @example
 * ```typescript
 * // Single-node configuration
 * const client = new HoosatClient({
 *   host: '54.38.176.95',
 *   port: 42420,
 *   timeout: 10000
 * });
 *
 * // Multi-node configuration with automatic failover
 * const client = new HoosatClient({
 *   nodes: [
 *     { host: '54.38.176.95', port: 42420, primary: true, name: 'Primary' },
 *     { host: 'backup.example.com', port: 42420, name: 'Backup' }
 *   ],
 *   healthCheckInterval: 30000,
 *   retryAttempts: 3,
 *   requireUtxoIndex: true,
 *   requireSynced: true
 * });
 *
 * // Request/response operations (work the same in both modes)
 * const balance = await client.getBalance('hoosat:qz7ulu...');
 * if (balance.ok) {
 *   console.log('Balance:', balance.result.balance);
 * }
 *
 * // Monitor node health (multi-node mode only)
 * const nodesStatus = client.getNodesStatus();
 * if (nodesStatus) {
 *   nodesStatus.forEach(node => {
 *     console.log(`${node.config.name}: ${node.health.isHealthy ? '✅' : '❌'}`);
 *   });
 * }
 *
 * // Real-time event streaming
 * await client.events.subscribeToUtxoChanges(['hoosat:qz7ulu...']);
 * client.events.on('utxoChange', (notification) => {
 *   console.log('UTXO changed:', notification);
 * });
 *
 * // Cleanup
 * client.disconnect();
 * ```
 */
export class HoosatClient {
  private readonly _host: string;
  private readonly _port: number;
  private readonly _timeout: number;
  private readonly _retryAttempts: number;
  private readonly _retryDelay: number;
  private readonly _isMultiNode: boolean;

  private _client: any;
  private _nodeManager?: NodeManager;

  // Services
  private _networkService: NetworkService | null = null;
  private _blockchainService: BlockchainService | null = null;
  private _mempoolService: MempoolService | null = null;
  private _addressService: AddressService | null = null;
  private _nodeInfoService: NodeInfoService | null = null;
  private _transactionService: TransactionService | null = null;
  private _transactionStatusService: TransactionStatusService | null = null;
  private _feeService: TransactionFeeService | null = null;

  /**
   * Event manager for real-time blockchain events
   *
   * Provides access to event subscriptions such as:
   * - UTXO changes
   * - Block additions (future)
   * - Chain reorganizations (future)
   *
   * @example
   * ```typescript
   * // Subscribe to UTXO changes
   * await client.events.subscribeToUtxoChanges(['hoosat:qz7ulu...']);
   *
   * // Listen for events
   * client.events.on('utxoChange', (notification) => {
   *   console.log('UTXO changed for', notification.address);
   * });
   *
   * // Check connection status
   * console.log('Connected:', client.events.isConnected());
   *
   * // Get statistics
   * const stats = client.events.getStats();
   * console.log('Active subscriptions:', stats.utxoSubscriptions.length);
   * ```
   */
  public readonly events: HoosatEventManager;

  /**
   * Creates a new HoosatClient instance
   *
   * Supports both single-node and multi-node configurations:
   * - **Single-node**: Connect to one Hoosat node (simple setup)
   * - **Multi-node**: Connect to multiple nodes with automatic failover (high availability)
   *
   * @param config - Client configuration options
   *
   * **Single-node configuration:**
   * @param config.host - Hostname or IP address of the Hoosat node (default: '127.0.0.1')
   * @param config.port - Port number of the Hoosat node (default: 42420)
   * @param config.timeout - Request timeout in milliseconds (default: 10000)
   *
   * **Multi-node configuration:**
   * @param config.nodes - Array of node configurations for automatic failover
   * @param config.healthCheckInterval - Health check interval in ms (default: 30000)
   * @param config.retryAttempts - Number of retry attempts per request (default: 3)
   * @param config.retryDelay - Delay between retries in ms (default: 1000)
   * @param config.requireUtxoIndex - Only use nodes with UTXO index enabled (default: true)
   * @param config.requireSynced - Only use synced nodes (default: true)
   *
   * **Common configuration:**
   * @param config.events - Event manager configuration (optional)
   * @param config.debug - Enable debug logging (default: false)
   *
   * @example
   * ```typescript
   * // Single-node configuration
   * const client = new HoosatClient({
   *   host: '54.38.176.95',
   *   port: 42420,
   *   timeout: 10000
   * });
   *
   * // Multi-node configuration with automatic failover
   * const client = new HoosatClient({
   *   nodes: [
   *     { host: '54.38.176.95', port: 42420, primary: true, name: 'Primary' },
   *     { host: 'backup.example.com', port: 42420, name: 'Backup' }
   *   ],
   *   healthCheckInterval: 30000,
   *   retryAttempts: 3,
   *   requireUtxoIndex: true,
   *   requireSynced: true,
   *   debug: true
   * });
   *
   * // With event manager config
   * const client = new HoosatClient({
   *   host: '54.38.176.95',
   *   port: 42420,
   *   events: {
   *     maxReconnectAttempts: 10,
   *     reconnectDelay: 3000,
   *     debug: true
   *   }
   * });
   * ```
   */
  constructor(config: HoosatClientConfig = {}) {
    // Determine if this is a multi-node configuration
    this._isMultiNode = !!(config.nodes && config.nodes.length > 0);

    if (this._isMultiNode) {
      // Multi-node mode
      this._host = config.nodes![0].host;
      this._port = config.nodes![0].port;
      this._timeout = config.nodes![0].timeout || config.timeout || CLIENT_DEFAULT_CONFIG.TIMEOUT;
    } else {
      // Single node mode
      this._host = config.host || CLIENT_DEFAULT_CONFIG.HOST;
      this._port = config.port || CLIENT_DEFAULT_CONFIG.PORT;
      this._timeout = config.timeout || CLIENT_DEFAULT_CONFIG.TIMEOUT;
    }

    this._retryAttempts = config.retryAttempts || 3;
    this._retryDelay = config.retryDelay || 1000;

    // Initialize client (single or multi-node)
    if (this._isMultiNode) {
      this._initializeMultiNodeClient(config);
    } else {
      this._initializeSingleNodeClient();
    }

    // Initialize services
    this._initializeServices();

    // Initialize event manager (always uses primary/current client)
    const eventClient = this._nodeManager ? this._nodeManager.getCurrentClient() : this._client;
    this.events = new HoosatEventManager(eventClient, config.events);
  }

  /**
   * Initializes a single-node gRPC client connection
   * @private
   */
  private _initializeSingleNodeClient(): void {
    try {
      const PROTO_PATH = join(__dirname, '..', 'protos', 'messages.proto');

      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [join(__dirname, '..', 'protos')],
      });

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

      this._client = new protoDescriptor.protowire.RPC(`${this._host}:${this._port}`, grpc.credentials.createInsecure(), {
        'grpc.max_receive_message_length': GRPC_CONFIG.MAX_MESSAGE_SIZE,
        'grpc.max_send_message_length': GRPC_CONFIG.MAX_MESSAGE_SIZE,
      });
    } catch (error) {
      throw new Error(`Failed to initialize gRPC client: ${error}`);
    }
  }

  /**
   * Initializes multi-node client with NodeManager and automatic failover
   * @private
   */
  private _initializeMultiNodeClient(config: HoosatClientConfig): void {
    try {
      if (!config.nodes || config.nodes.length === 0) {
        throw new Error('Multi-node configuration requires at least one node');
      }

      // Initialize NodeManager which creates clients for all nodes
      this._nodeManager = new NodeManager(config.nodes, {
        requireUtxoIndex: config.requireUtxoIndex,
        requireSynced: config.requireSynced,
        healthCheckInterval: config.healthCheckInterval,
        debug: config.debug,
      });

      // Set the primary client for direct access (used by event manager)
      this._client = this._nodeManager.getCurrentClient();
    } catch (error) {
      throw new Error(`Failed to initialize multi-node client: ${error}`);
    }
  }

  /**
   * Initializes all service instances
   * @private
   */
  private _initializeServices(): void {
    this._networkService = new NetworkService(this._client, this._timeout, this._nodeManager, this._retryAttempts, this._retryDelay);
    this._blockchainService = new BlockchainService(
      this._client,
      this._timeout,
      this._nodeManager,
      this._retryAttempts,
      this._retryDelay
    );
    this._mempoolService = new MempoolService(this._client, this._timeout, this._nodeManager, this._retryAttempts, this._retryDelay);
    this._addressService = new AddressService(this._client, this._timeout, this._nodeManager, this._retryAttempts, this._retryDelay);
    this._nodeInfoService = new NodeInfoService(this._client, this._timeout, this._nodeManager, this._retryAttempts, this._retryDelay);
    this._transactionService = new TransactionService(this._client, this._timeout, this._nodeManager, this._retryAttempts, this._retryDelay);
    this._transactionStatusService = new TransactionStatusService(
      this._client,
      this._timeout,
      this._mempoolService,
      this._addressService
    );
    this._feeService = new TransactionFeeService(this._addressService);
  }

  // ==================== NODE INFORMATION ====================

  /**
   * Gets information about the connected Hoosat node
   *
   * @returns Node information including version, sync status, and UTXO index status
   *
   * @example
   * ```typescript
   * const info = await client.getInfo();
   * if (info.ok) {
   *   console.log('Server version:', info.result.serverVersion);
   *   console.log('Is synced:', info.result.isSynced);
   *   console.log('UTXO indexed:', info.result.isUtxoIndexed);
   * }
   * ```
   */
  async getInfo(): Promise<BaseResult<GetInfo>> {
    return this._nodeInfoService!.getInfo();
  }

  /**
   * Gets the virtual selected parent blue score
   * This represents the current height/score of the blockchain
   *
   * @returns Blue score of the virtual selected parent
   *
   * @example
   * ```typescript
   * const result = await client.getVirtualSelectedParentBlueScore();
   * if (result.ok) {
   *   console.log('Current blue score:', result.result.blueScore);
   * }
   * ```
   */
  async getVirtualSelectedParentBlueScore(): Promise<BaseResult<GetVirtualSelectedParentBlueScore>> {
    return this._nodeInfoService!.getVirtualSelectedParentBlueScore();
  }

  /**
   * Estimates the network hashrate over a specified window
   *
   * @param windowSize - Number of blocks to analyze (default: 1000)
   * @param startHash - Optional starting block hash
   * @returns Estimated network hashrate in hashes per second
   *
   * @example
   * ```typescript
   * const result = await client.estimateNetworkHashesPerSecond(1000);
   * if (result.ok) {
   *   console.log('Network hashrate:', result.result.networkHashesPerSecond, 'H/s');
   * }
   * ```
   */
  async estimateNetworkHashesPerSecond(windowSize = 1000, startHash?: string): Promise<BaseResult<EstimateNetworkHashesPerSecond>> {
    return this._nodeInfoService!.estimateNetworkHashesPerSecond(windowSize, startHash);
  }

  /**
   * Gets information about the coin supply
   *
   * @returns Circulating and maximum coin supply
   *
   * @example
   * ```typescript
   * const result = await client.getCoinSupply();
   * if (result.ok) {
   *   console.log('Circulating supply:', result.result.circulatingSompi);
   *   console.log('Max supply:', result.result.maxSompi);
   * }
   * ```
   */
  async getCoinSupply(): Promise<BaseResult<GetCoinSupply>> {
    return this._nodeInfoService!.getCoinSupply();
  }

  // ==================== NETWORK METHODS ====================

  /**
   * Gets the current network name (mainnet/testnet)
   *
   * @returns Current network identifier
   *
   * @example
   * ```typescript
   * const result = await client.getCurrentNetwork();
   * if (result.ok) {
   *   console.log('Network:', result.result.currentNetwork);
   * }
   * ```
   */
  async getCurrentNetwork(): Promise<BaseResult<GetCurrentNetwork>> {
    return this._networkService!.getCurrentNetwork();
  }

  /**
   * Gets list of known peer addresses
   *
   * @returns List of peer addresses including banned addresses
   *
   * @example
   * ```typescript
   * const result = await client.getPeerAddresses();
   * if (result.ok) {
   *   console.log('Known peers:', result.result.addresses.length);
   *   console.log('Banned peers:', result.result.bannedAddresses.length);
   * }
   * ```
   */
  async getPeerAddresses(): Promise<BaseResult<GetPeerAddresses>> {
    return this._networkService!.getPeerAddresses();
  }

  /**
   * Gets information about currently connected peers
   *
   * @returns List of connected peers with connection details
   *
   * @example
   * ```typescript
   * const result = await client.getConnectedPeerInfo();
   * if (result.ok) {
   *   console.log('Connected peers:', result.result.peers.length);
   *   result.result.peers.forEach(peer => {
   *     console.log(`- ${peer.address} (${peer.userAgent})`);
   *   });
   * }
   * ```
   */
  async getConnectedPeerInfo(): Promise<BaseResult<GetConnectedPeerInfo>> {
    return this._networkService!.getConnectedPeerInfo();
  }

  // ==================== BLOCKCHAIN METHODS ====================

  /**
   * Gets the hash of the current selected tip block
   *
   * @returns Selected tip block hash
   *
   * @example
   * ```typescript
   * const result = await client.getSelectedTipHash();
   * if (result.ok) {
   *   console.log('Tip hash:', result.result.selectedTipHash);
   * }
   * ```
   */
  async getSelectedTipHash(): Promise<BaseResult<GetSelectedTipHash>> {
    return this._blockchainService!.getSelectedTipHash();
  }

  /**
   * Gets a block by its hash
   *
   * @param blockHash - Hash of the block to retrieve
   * @param includeTransactions - Whether to include full transaction data (default: true)
   * @returns Block data including header, transactions, and verbose data
   *
   * @example
   * ```typescript
   * const result = await client.getBlock('abc123...', true);
   * if (result.ok) {
   *   console.log('Block transactions:', result.result.transactions?.length);
   *   console.log('Block timestamp:', result.result.header.timestamp);
   * }
   * ```
   */
  async getBlock(blockHash: string, includeTransactions = true): Promise<BaseResult<GetBlock>> {
    return this._blockchainService!.getBlock(blockHash, includeTransactions);
  }

  /**
   * Gets multiple blocks starting from a specified hash
   *
   * @param lowHash - Starting block hash
   * @param includeTransactions - Whether to include transaction data (default: false)
   * @returns Array of blocks
   *
   * @example
   * ```typescript
   * const result = await client.getBlocks('abc123...', false);
   * if (result.ok) {
   *   console.log('Retrieved blocks:', result.result.blocks.length);
   * }
   * ```
   */
  async getBlocks(lowHash: string, includeTransactions = false): Promise<BaseResult<GetBlocks>> {
    return this._blockchainService!.getBlocks(lowHash, includeTransactions);
  }

  /**
   * Gets a block by transaction ID
   *
   * Returns the block that contains the specified transaction.
   * Useful for finding which block a transaction was included in.
   *
   * @param transactionId - Transaction ID to search for
   * @param includeTransactions - Whether to include full transaction data (default: true)
   * @returns Block containing the transaction
   *
   * @example
   * ```typescript
   * const result = await client.getBlockByTransactionId('a1b2c3d4e5f6...', true);
   * if (result.ok) {
   *   console.log('Block hash:', result.result.verboseData.hash);
   *   console.log('Block timestamp:', result.result.header.timestamp);
   *   console.log('Transactions:', result.result.transactions?.length);
   * }
   * ```
   */
  async getBlockByTransactionId(transactionId: string, includeTransactions = true): Promise<BaseResult<GetBlockByTransactionId>> {
    return this._blockchainService!.getBlockByTransactionId(transactionId, includeTransactions);
  }

  /**
   * Gets the current blockchain height
   *
   * @returns Block count and header count
   *
   * @example
   * ```typescript
   * const result = await client.getBlockCount();
   * if (result.ok) {
   *   console.log('Block count:', result.result.blockCount);
   *   console.log('Header count:', result.result.headerCount);
   * }
   * ```
   */
  async getBlockCount(): Promise<BaseResult<GetBlockCount>> {
    return this._blockchainService!.getBlockCount();
  }

  /**
   * Gets comprehensive information about the block DAG
   *
   * @returns DAG info including network name, block count, difficulty, etc.
   *
   * @example
   * ```typescript
   * const result = await client.getBlockDagInfo();
   * if (result.ok) {
   *   console.log('Network:', result.result.networkName);
   *   console.log('Block count:', result.result.blockCount);
   *   console.log('Difficulty:', result.result.difficulty);
   * }
   * ```
   */
  async getBlockDagInfo(): Promise<BaseResult<GetBlockDagInfo>> {
    return this._blockchainService!.getBlockDagInfo();
  }

  // ==================== ADDRESS & BALANCE METHODS ====================

  /**
   * Gets the balance of a single address
   *
   * @param address - Hoosat address to query
   * @returns Balance in sompi (smallest unit)
   *
   * @example
   * ```typescript
   * const result = await client.getBalance('hoosat:qz7ulu...');
   * if (result.ok) {
   *   console.log('Balance:', result.result.balance, 'sompi');
   * }
   * ```
   */
  async getBalance(address: string): Promise<BaseResult<GetBalanceByAddress>> {
    return this._addressService!.getBalance(address);
  }

  /**
   * Gets balances for multiple addresses
   *
   * @param addresses - Array of Hoosat addresses to query
   * @returns Array of balances for each address
   *
   * @example
   * ```typescript
   * const result = await client.getBalancesByAddresses([
   *   'hoosat:qz7ulu...',
   *   'hoosat:qyp...'
   * ]);
   * if (result.ok) {
   *   result.result.balances.forEach(b => {
   *     console.log(`${b.address}: ${b.balance} sompi`);
   *   });
   * }
   * ```
   */
  async getBalancesByAddresses(addresses: string[]): Promise<BaseResult<GetBalancesByAddresses>> {
    return this._addressService!.getBalancesByAddresses(addresses);
  }

  /**
   * Gets all UTXOs for specified addresses
   *
   * @param addresses - Array of Hoosat addresses to query
   * @returns Array of UTXOs with outpoint and amount information
   *
   * @example
   * ```typescript
   * const result = await client.getUtxosByAddresses(['hoosat:qz7ulu...']);
   * if (result.ok) {
   *   console.log('Total UTXOs:', result.result.utxos.length);
   *   result.result.utxos.forEach(utxo => {
   *     console.log(`UTXO: ${utxo.utxoEntry.amount} sompi`);
   *   });
   * }
   * ```
   */
  async getUtxosByAddresses(addresses: string[]): Promise<BaseResult<GetUtxosByAddresses>> {
    return this._addressService!.getUtxosByAddresses(addresses);
  }

  // ==================== MEMPOOL METHODS ====================

  /**
   * Gets a single mempool entry by transaction ID
   *
   * @param txId - Transaction ID to look up
   * @param includeOrphanPool - Whether to include orphan pool (default: true)
   * @param filterTransactionPool - Whether to filter transaction pool (default: false)
   * @returns Mempool entry with transaction data and fee
   *
   * @example
   * ```typescript
   * const result = await client.getMempoolEntry('abc123...', true, false);
   * if (result.ok) {
   *   console.log('Fee:', result.result.fee);
   *   console.log('Is orphan:', result.result.isOrphan);
   * }
   * ```
   */
  async getMempoolEntry(txId: string, includeOrphanPool = true, filterTransactionPool = false): Promise<BaseResult<GetMempoolEntry>> {
    return this._mempoolService!.getMempoolEntry(txId, includeOrphanPool, filterTransactionPool);
  }

  /**
   * Gets all mempool entries
   *
   * @param includeOrphanPool - Whether to include orphan pool (default: true)
   * @param filterTransactionPool - Whether to filter transaction pool (default: false)
   * @returns Array of all mempool entries
   *
   * @example
   * ```typescript
   * const result = await client.getMempoolEntries(true, false);
   * if (result.ok) {
   *   console.log('Mempool size:', result.result.entries.length);
   *   const totalFees = result.result.entries.reduce((sum, e) => sum + BigInt(e.fee), 0n);
   *   console.log('Total fees:', totalFees);
   * }
   * ```
   */
  async getMempoolEntries(includeOrphanPool = true, filterTransactionPool = false): Promise<BaseResult<GetMempoolEntries>> {
    return this._mempoolService!.getMempoolEntries(includeOrphanPool, filterTransactionPool);
  }

  /**
   * Gets mempool entries by addresses
   *
   * @param addresses - Array of addresses to filter by
   * @param includeOrphanPool - Whether to include orphan pool (default: true)
   * @param filterTransactionPool - Whether to filter transaction pool (default: false)
   * @returns Mempool entries related to specified addresses
   *
   * @example
   * ```typescript
   * const result = await client.getMempoolEntriesByAddresses(['hoosat:qz7ulu...']);
   * if (result.ok) {
   *   console.log('Pending transactions:', result.result.entries.length);
   * }
   * ```
   */
  async getMempoolEntriesByAddresses(
    addresses: string[],
    includeOrphanPool = true,
    filterTransactionPool = false
  ): Promise<BaseResult<GetMempoolEntriesByAddresses>> {
    return this._mempoolService!.getMempoolEntriesByAddresses(addresses, includeOrphanPool, filterTransactionPool);
  }

  // ==================== TRANSACTION METHODS ====================

  /**
   * Submits a signed transaction to the network
   *
   * @param transaction - Signed transaction object
   * @param allowOrphan - Whether to allow orphan transactions (default: false)
   * @returns Transaction ID if successful
   *
   * @example
   * ```typescript
   * const signedTx = builder.sign();
   * const result = await client.submitTransaction(signedTx);
   * if (result.ok) {
   *   console.log('Transaction ID:', result.result.transactionId);
   * } else {
   *   console.error('Error:', result.error);
   * }
   * ```
   */
  async submitTransaction(transaction: Transaction, allowOrphan = false): Promise<BaseResult<SubmitTransaction>> {
    return this._transactionService!.submitTransaction(transaction, allowOrphan);
  }

  /**
   * Gets the status of a transaction
   *
   * This method checks:
   * 1. Mempool for PENDING transactions
   * 2. Recipient address UTXOs for CONFIRMED transactions
   * 3. Sender address UTXOs for change outputs (additional confirmation check)
   *
   * **Important:** Node must be started with `--utxoindex` flag for CONFIRMED status detection.
   *
   * @param txId - Transaction ID to check
   * @param senderAddress - Sender address (for additional verification via change outputs)
   * @param recipientAddress - Recipient address (required for CONFIRMED status detection)
   * @returns Transaction status: PENDING, CONFIRMED, or NOT_FOUND
   *
   * @example
   * ```typescript
   * const status = await client.getTransactionStatus(
   *   'a1b2c3d4e5f6...',
   *   'hoosat:qzsender123...',
   *   'hoosat:qzrecipient456...'
   * );
   *
   * if (status.ok) {
   *   console.log('Status:', status.result.status);
   *
   *   if (status.result.status === 'PENDING') {
   *     console.log('Fee:', status.result.details.fee);
   *     console.log('Is Orphan:', status.result.details.isOrphan);
   *   }
   *
   *   if (status.result.status === 'CONFIRMED') {
   *     console.log('Block DAA Score:', status.result.details.blockDaaScore);
   *     console.log('Confirmed Amount:', status.result.details.confirmedAmount);
   *   }
   *
   *   if (status.result.status === 'NOT_FOUND') {
   *     console.log('Message:', status.result.details.message);
   *   }
   * }
   * ```
   */
  async getTransactionStatus(
    txId: string,
    senderAddress: string,
    recipientAddress: string
  ): Promise<BaseResult<GetTransactionStatus>> {
    return this._transactionStatusService!.getTransactionStatus(txId, senderAddress, recipientAddress);
  }

  /**
   * Calculate minimum transaction fee for sender address
   *
   * Automatically fetches UTXOs for the sender address and calculates
   * the minimum fee based on actual inputs/outputs count.
   *
   * This method:
   * 1. Fetches UTXOs for sender address via `getUtxosByAddresses()`
   * 2. Counts inputs (number of UTXOs)
   * 3. Assumes 2 outputs (recipient + change)
   * 4. Calculates minimum fee using MASS-based formula
   *
   * @param address - Sender address to calculate fee for
   * @param payloadSize - Payload size in bytes (default: 0, for future use)
   * @returns Minimum fee in sompi
   *
   * @example
   * ```typescript
   * // Calculate minimum fee for address
   * const minFee = await client.calculateMinFee('hoosat:qz7ulu...');
   * console.log('Minimum fee:', minFee, 'sompi');
   * ```
   *
   * @example
   * ```typescript
   * // With payload (for future subnetwork usage)
   * const minFeeWithPayload = await client.calculateMinFee('hoosat:qz7ulu...', 256);
   * ```
   */
  async calculateMinFee(address: string, payloadSize: number = 0): Promise<string> {
    return this._feeService!.calculateMinFee(address, payloadSize);
  }

  // ==================== NODE MANAGEMENT ====================

  /**
   * Gets the status of all nodes in multi-node configuration
   *
   * Returns null if client is in single-node mode.
   * In multi-node mode, returns health and configuration info for all nodes.
   *
   * @returns Array of node statuses or null if single-node mode
   *
   * @example
   * ```typescript
   * const nodesStatus = client.getNodesStatus();
   * if (nodesStatus) {
   *   nodesStatus.forEach(node => {
   *     console.log(`Node: ${node.config.name || node.config.host}`);
   *     console.log(`  Healthy: ${node.health.isHealthy}`);
   *     console.log(`  Synced: ${node.health.isSynced}`);
   *     console.log(`  UTXO Indexed: ${node.health.isUtxoIndexed}`);
   *   });
   * }
   * ```
   */
  getNodesStatus() {
    if (!this._nodeManager) {
      return null;
    }
    return this._nodeManager.getNodesStatus();
  }

  // ==================== CLEANUP ====================

  /**
   * Disconnects from the node and cleans up all resources
   *
   * This method should be called when shutting down the client to:
   * - Close gRPC connection(s)
   * - Disconnect NodeManager (if multi-node)
   * - Unsubscribe from all event streams
   * - Clean up event listeners
   *
   * @example
   * ```typescript
   * // Cleanup on application shutdown
   * process.on('SIGINT', () => {
   *   client.disconnect();
   *   process.exit(0);
   * });
   * ```
   */
  disconnect(): void {
    // Disconnect event manager and all streams
    this.events.disconnect();

    // Disconnect NodeManager (if multi-node mode)
    if (this._nodeManager) {
      this._nodeManager.disconnect();
    }

    // Close gRPC connection (if single-node mode)
    if (this._client && !this._nodeManager) {
      this._client.close();
    }
  }
}
