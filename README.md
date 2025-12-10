# hoosat-sdk

[![npm version](https://badge.fury.io/js/hoosat-sdk.svg)](https://badge.fury.io/js/hoosat-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-Vitest-green.svg)](https://vitest.dev/)

**Professional TypeScript SDK for the [Hoosat](https://hoosat.fi) blockchain.** Full-featured toolkit for building production-ready applications with robust error handling, real-time monitoring, and advanced transaction management.

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Core Modules](#-core-modules)
- [Detailed API Documentation](#-detailed-api-documentation)
- [Usage Examples](#-usage-examples)
- [Error Handling](#-error-handling)
- [UTXO Management](#-utxo-management)
- [Spam Protection](#-spam-protection)
- [Best Practices](#-best-practices)
- [Testing](#-testing)
- [Development](#-development)
- [Contributing](#-contributing)
- [Support](#-support)

---

## ✨ Key Features

### Core Functionality

- 🔗 **Full Node Integration** - Connect to any Hoosat node via gRPC
- 🔐 **Cryptographic Utilities** - Key generation, address creation, transaction signing (ECDSA secp256k1)
- 🏗️ **Transaction Builder** - Intuitive API with automatic fee calculation and change handling
- 📊 **Network Analytics** - Block data, mempool analysis, hashrate estimation
- 💰 **Balance & UTXO Management** - Query balances, manage UTXOs efficiently
- 🎨 **QR Code Generation** - Payment URIs and address QR codes
- 📦 **Payload Support** - Encode/decode transaction payloads for voting, mining data, and custom applications

### Advanced Features

- 📡 **Real-time Event System** - `HoosatEventManager` with automatic reconnection and error handling
- 🎯 **Automatic Fee Calculation** - MASS-based minimum fee calculation with payload support
- 🔍 **Transaction Status Tracking** - Check if transactions are PENDING, CONFIRMED, or NOT_FOUND
- 🔄 **UTXO Selection Strategies** - Optimize fees and privacy (largest-first, smallest-first, random)
- 📦 **Batch Payments** - Send to multiple recipients efficiently (2 recipients per tx)
- ⚡ **UTXO Consolidation** - Optimize wallet structure by combining small UTXOs
- 🔀 **UTXO Splitting** - Prepare for future payments by splitting large UTXOs

### Production-Ready

- 🛡️ **Spam Protection Compliance** - Built-in limits (max 2 recipients per tx) following Kaspa inheritance
- ⚠️ **Comprehensive Error Handling** - Robust error categorization and recovery
- 🔄 **Multi-Node Failover** - Automatic node switching with health monitoring for high availability
- 🔁 **Retry Strategies** - Exponential backoff, circuit breaker patterns
- 📈 **Network Monitoring** - Real-time statistics and health checks
- 🔒 **Type Safety** - Full TypeScript support with comprehensive types
- ✅ **Test Coverage** - Unit tests with Vitest (90%+ coverage for critical components)

---

## 📦 Installation

```bash
npm install hoosat-sdk
```

### Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0.0 (optional but recommended)

---

## 🚀 Quick Start

### 1. Connect to Node

```typescript
import { HoosatClient } from 'hoosat-sdk';

const client = new HoosatClient({
  host: '54.38.176.95',
  port: 42420,
  timeout: 10000,
  events: {
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    debug: false
  }
});

// Get node info
const info = await client.getInfo();
if (info.ok) {
  console.log('Node version:', info.result.serverVersion);
  console.log('Is synced:', info.result.isSynced);
  console.log('Mempool size:', info.result.mempoolSize);
}
```

### 2. Multi-Node Setup (High Availability)

```typescript
import { HoosatClient } from 'hoosat-sdk';

// Configure multiple nodes with automatic failover
const client = new HoosatClient({
  nodes: [
    {
      host: '54.38.176.95',
      port: 42420,
      primary: true, // Primary node
      name: 'Primary Node',
    },
    {
      host: 'backup1.example.com',
      port: 42420,
      name: 'Backup Node 1',
    },
    {
      host: 'backup2.example.com',
      port: 42420,
      name: 'Backup Node 2',
    },
  ],
  healthCheckInterval: 30000, // Check health every 30 seconds
  requireUtxoIndex: true, // Only use nodes with UTXO index
  requireSynced: true, // Only use synced nodes
  retryAttempts: 3, // Retry failed requests up to 3 times
  retryDelay: 1000, // Wait 1 second between retries
  debug: true, // Enable debug logging
});

// All SDK methods automatically benefit from failover
const balance = await client.getBalance(wallet.address);

// Monitor node health
const nodesStatus = client.getNodesStatus();
nodesStatus?.forEach((node) => {
  console.log(`${node.config.name}: ${node.health.isHealthy ? '✅' : '❌'}`);
});
```

**Key Benefits:**
- ✅ Automatic failover when primary node fails
- ✅ Health checks with sync and UTXO index validation
- ✅ Transparent request retry without code changes
- ✅ Real-time node status monitoring

**See:** `examples/advanced/02-multi-node-failover.ts`

### 3. Generate Wallet

```typescript
import { HoosatCrypto } from 'hoosat-sdk';

// Generate new keypair
const wallet = HoosatCrypto.generateKeyPair();
console.log('Address:', wallet.address);
console.log('Private key:', wallet.privateKey.toString('hex'));

// Or import existing wallet
const imported = HoosatCrypto.importKeyPair('your_private_key_hex');
```

### 3. Check Balance

```typescript
import { HoosatUtils } from 'hoosat-sdk';

const balance = await client.getBalance(wallet.address);
if (balance.ok) {
  const htn = HoosatUtils.sompiToAmount(balance.result.balance);
  console.log('Balance:', htn, 'HTN');
}
```

### 4. Build and Send Transaction

```typescript
import { HoosatTxBuilder, HoosatCrypto } from 'hoosat-sdk';

// Get UTXOs
const utxosResult = await client.getUtxosByAddresses([wallet.address]);
const utxos = utxosResult.result.utxos;

// Calculate minimum fee
const minFee = await client.calculateMinFee(wallet.address);
console.log('Minimum fee:', minFee, 'sompi');

// Build transaction
const builder = new HoosatTxBuilder();

// Add inputs
for (const utxo of utxos) {
  builder.addInput(utxo, wallet.privateKey);
}

// Add recipient
builder.addOutput('hoosat:recipient_address', '100000000'); // 1 HTN

// Set fee and add change
builder.setFee(minFee);
builder.addChangeOutput(wallet.address);

// Sign and submit
const signedTx = builder.sign();
const submitResult = await client.submitTransaction(signedTx);

if (submitResult.ok) {
  console.log('Transaction submitted:', submitResult.result.transactionId);
}
```

### 5. Check Transaction Status

```typescript
// Check if transaction is pending, confirmed, or not found
const status = await client.getTransactionStatus(
  'transaction_id_here',
  'sender_address_here',
  'recipient_address_here'
);

if (status.ok) {
  switch (status.result.status) {
    case 'PENDING':
      console.log('Transaction in mempool');
      console.log('Fee:', status.result.details.fee);
      break;

    case 'CONFIRMED':
      console.log('Transaction confirmed!');
      console.log('Block DAA Score:', status.result.details.blockDaaScore);
      break;

    case 'NOT_FOUND':
      console.log('Transaction not found');
      console.log('Reason:', status.result.details.message);
      break;
  }
}

// Poll for confirmation
async function waitForConfirmation(txId, sender, recipient) {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    const status = await client.getTransactionStatus(txId, sender, recipient);

    if (status.ok && status.result.status === 'CONFIRMED') {
      console.log('✅ Confirmed!');
      return true;
    }

    console.log(`⏳ Attempt ${i + 1}/${maxAttempts}...`);
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}
```

**Note:** Node must be started with `--utxoindex` flag for CONFIRMED status detection.

### 6. Real-time UTXO Monitoring

```typescript
import { EventType } from 'hoosat-sdk';

// Subscribe to UTXO changes
await client.events.subscribeToUtxoChanges([wallet.address]);

// Listen for events
client.events.on(EventType.UtxoChange, (notification) => {
  console.log('Address:', notification.address);
  console.log('Added UTXOs:', notification.changes.added.length);
  console.log('Removed UTXOs:', notification.changes.removed.length);
  
  notification.changes.added.forEach(utxo => {
    console.log(`Received: ${HoosatUtils.sompiToAmount(utxo.amount)} HTN`);
  });
});

// Error handling
client.events.on(EventType.Error, (error) => {
  console.error('Streaming error:', error);
});

// Connection events
client.events.on(EventType.Disconnect, () => {
  console.log('Disconnected from node');
});

client.events.on(EventType.Reconnected, () => {
  console.log('Reconnected successfully');
});

// Check connection status
console.log('Streaming active:', client.events.isConnected());

// Get statistics
const stats = client.events.getStats();
console.log('Subscribed addresses:', stats.utxoSubscriptions.length);
console.log('Reconnect attempts:', stats.reconnectAttempts);

// Cleanup
await client.events.unsubscribeFromUtxoChanges();
client.disconnect();
```

### 7. Generate Payment QR Codes

```typescript
import { HoosatQR } from 'hoosat-sdk';

// Simple address QR
const qr = await HoosatQR.generateAddressQR('hoosat:your_address');
// Use in HTML: <img src="${qr}" alt="Scan to send HTN" />

// Payment request with amount and metadata
const paymentQR = await HoosatQR.generatePaymentQR({
  address: 'hoosat:your_address',
  amount: 100,           // 100 HTN
  label: 'Coffee Shop',
  message: 'Order #12345'
});

// Parse scanned QR from mobile wallet
const parsed = HoosatQR.parsePaymentURI('hoosat:address?amount=100');
console.log('Amount:', HoosatUtils.sompiToAmount(parsed.amount!), 'HTN');
```

---

## 🧩 Core Modules

### HoosatClient
Main class for interacting with Hoosat nodes via gRPC. Provides methods for querying blockchain data, managing UTXOs, submitting transactions, and event streaming via integrated `HoosatEventManager`.

**Key Features:**
- Node information and network statistics
- Block and blockchain data queries
- Address balances and UTXO management
- Transaction submission
- Integrated event manager for real-time subscriptions
- Mempool analysis

### HoosatEventManager
Event management system for real-time blockchain notifications. Accessible via `client.events` property.

**Key Features:**
- UTXO change notifications for monitored addresses
- Automatic reconnection with exponential backoff
- Connection state management and statistics
- Multiple event types (disconnect, reconnect, errors)
- Configurable limits and retry strategies
- Future support for block notifications and chain updates

### HoosatCrypto
Cryptographic operations for Hoosat blockchain using ECDSA secp256k1.

**Key Features:**
- Key pair generation and import
- Address creation (ECDSA, Schnorr, P2SH)
- Transaction signing with BLAKE3 hashing
- ECDSA signature verification
- Fee calculation using mass-based formula

### HoosatTxBuilder
Intuitive transaction builder with automatic change calculation.

**Key Features:**
- Fluent API for transaction building
- Automatic change output calculation
- Input/output management with validation
- Spam protection compliance (max 2 recipients)
- Fee estimation and validation
- Support for multiple inputs and outputs

### TransactionFeeService
Automatic minimum fee calculation based on actual transaction requirements.

**Key Features:**
- Automatic UTXO fetching for sender address
- MASS-based fee calculation (HTND compatible)
- Payload size support for future subnetwork usage
- Input/output count optimization
- No need for manual mempool analysis

### HoosatQR
QR code generation and parsing for addresses and payment URIs.

**Key Features:**
- Address QR codes
- Payment request QR codes with amount and metadata
- Multiple formats (Data URL, Buffer, SVG, Terminal)
- URI parsing and validation
- Customizable QR options (size, error correction, colors)

### HoosatUtils
Comprehensive utility functions for validation, conversion, and formatting.

**Key Features:**
- Amount conversion (HTN ↔ sompi)
- Address validation and type detection
- Hash validation (transaction IDs, block hashes)
- Key validation (private keys, public keys)
- Formatting utilities (truncation, amounts)
- Hashrate conversion and formatting
- Payload encoding/decoding (hex ↔ UTF-8, JSON support)
- UTXO maturity filtering (coinbase handling)

---

## 📚 Detailed API Documentation

### HoosatClient

**Constructor**
```typescript
const client = new HoosatClient(config?: HoosatClientConfig);

interface HoosatClientConfig {
  // Single node configuration (legacy)
  host?: string;     // Default: '127.0.0.1'
  port?: number;     // Default: 42420
  timeout?: number;  // Default: 10000 (ms)

  // Multi-node configuration (high availability)
  nodes?: NodeConfig[];  // Array of nodes for failover
  healthCheckInterval?: number;  // Health check interval in ms (default: 30000)
  retryAttempts?: number;        // Retry attempts per request (default: 3)
  retryDelay?: number;           // Delay between retries in ms (default: 1000)
  requireUtxoIndex?: boolean;    // Only use nodes with UTXO index (default: true)
  requireSynced?: boolean;       // Only use synced nodes (default: true)

  // Event manager configuration
  events?: EventManagerConfig;
  debug?: boolean;  // Enable debug logging (default: false)
}

interface NodeConfig {
  host: string;      // Node hostname or IP
  port: number;      // Node port
  timeout?: number;  // Request timeout for this node
  primary?: boolean; // Designate as primary node
  name?: string;     // Optional node name for logging
}

interface EventManagerConfig {
  maxReconnectAttempts?: number;      // Default: 5
  reconnectDelay?: number;            // Default: 2000 (ms)
  maxSubscribedAddresses?: number;    // Default: 1000
  debug?: boolean;                    // Default: false
}
```

**Single-Node Example:**
```typescript
const client = new HoosatClient({
  host: '54.38.176.95',
  port: 42420,
  timeout: 10000
});
```

**Multi-Node Example:**
```typescript
const client = new HoosatClient({
  nodes: [
    { host: '54.38.176.95', port: 42420, primary: true, name: 'Primary' },
    { host: 'backup.example.com', port: 42420, name: 'Backup' }
  ],
  healthCheckInterval: 30000,
  retryAttempts: 3,
  requireUtxoIndex: true,
  requireSynced: true,
  debug: true
});
```

**Node Information**
- `getInfo()` - Get node information and status
- `getCurrentNetwork()` - Get network type (mainnet/testnet)
- `getConnectedPeerInfo()` - Get connected peers information

**Blockchain Queries**
- `getSelectedTipHash()` - Get current tip block hash
- `getBlock(blockHash, includeTransactions?)` - Get block data
- `getBlockByTransactionId(transactionId, includeTransactions?)` - Find block containing specific transaction
- `getBlocks(lowHash, includeTransactions?)` - Get multiple blocks
- `getBlockCount()` - Get blockchain height
- `getBlockDagInfo()` - Get DAG structure information

**Balances and UTXOs**
- `getBalance(address)` - Get single address balance
- `getBalancesByAddresses(addresses)` - Get multiple address balances
- `getUtxosByAddresses(addresses)` - Get UTXOs for addresses

**Transactions**
- `submitTransaction(transaction, allowOrphan?)` - Submit transaction to network
- `getTransactionStatus(txId, senderAddress, recipientAddress)` - Check transaction status (PENDING/CONFIRMED/NOT_FOUND)

**Mempool**
- `getMempoolEntry(txId, includeOrphanPool?, filterTransactionPool?)` - Get single mempool entry
- `getMempoolEntries(includeOrphanPool?, filterTransactionPool?)` - Get all mempool entries

**Events**
- `client.events` - Access to HoosatEventManager (see below)

**Node Management**
- `getNodesStatus()` - Get health status of all nodes (multi-node mode only)

**Connection**
- `disconnect()` - Close all connections and clean up resources

---

### HoosatEventManager

**Accessed via `client.events` property**

The event manager handles all real-time blockchain notifications with automatic reconnection and error handling.

**Event Subscription Methods**

```typescript
// Subscribe to UTXO changes
await client.events.subscribeToUtxoChanges(addresses: string[]): Promise<void>

// Unsubscribe from specific addresses or all
await client.events.unsubscribeFromUtxoChanges(addresses?: string[]): Promise<void>

// Unsubscribe from all events
await client.events.unsubscribeFromAll(): Promise<void>
```

**Event Listening**

```typescript
// Import EventType enum
import { EventType } from 'hoosat-sdk';

// Listen for UTXO changes
client.events.on(EventType.UtxoChange, (notification: UtxoChangeNotification) => {
  console.log('Address:', notification.address);
  console.log('Added:', notification.changes.added);
  console.log('Removed:', notification.changes.removed);
});

// Listen for errors
client.events.on(EventType.Error, (error: Error) => {
  console.error('Streaming error:', error);
});

// Listen for connection events
client.events.on(EventType.Disconnect, () => {
  console.log('Disconnected from node');
});

client.events.on(EventType.Reconnecting, () => {
  console.log('Attempting to reconnect...');
});

client.events.on(EventType.Reconnected, () => {
  console.log('Reconnected successfully');
});

client.events.on(EventType.MaxReconnectAttemptsReached, () => {
  console.error('Max reconnection attempts reached');
});
```

**Event Types**

```typescript
enum EventType {
  UtxoChange = 'utxoChange',                          // UTXO changes detected
  Error = 'error',                                     // Streaming error
  Disconnect = 'disconnect',                           // Disconnected from node
  Reconnecting = 'reconnecting',                       // Attempting reconnect
  Reconnected = 'reconnected',                         // Reconnected successfully
  MaxReconnectAttemptsReached = 'maxReconnectAttemptsReached'  // Max attempts reached
}
```

**Event Data Types**

```typescript
interface UtxoChangeNotification {
  address: string;
  changes: UtxoChanges;
}

interface UtxoChanges {
  added: UtxoChangeEntry[];    // Newly received UTXOs
  removed: UtxoChangeEntry[];  // Spent UTXOs
}

interface UtxoChangeEntry {
  outpoint: {
    transactionId: string;
    index: number;
  };
  amount: string;              // Amount in sompi
  isCoinbase: boolean;
  blockDaaScore?: string;
  scriptPublicKey?: any;
}
```

**Status and Statistics**

```typescript
// Check if streaming is active
client.events.isConnected(): boolean

// Get detailed statistics
client.events.getStats(): EventManagerStats

interface EventManagerStats {
  isConnected: boolean;              // Streaming connection status
  utxoSubscriptions: string[];       // Currently monitored addresses
  reconnectAttempts: number;         // Current reconnect attempts
  maxReconnectAttempts: number;      // Maximum allowed attempts
  lastError: string | null;          // Last error message (if any)
}
```

**Cleanup**

```typescript
// Disconnect event manager and close streams
client.events.disconnect(): void

// Also called automatically by client.disconnect()
client.disconnect();
```

**Configuration Example**

```typescript
const client = new HoosatClient({
  host: '54.38.176.95',
  port: 42420,
  events: {
    maxReconnectAttempts: 10,        // Try reconnecting up to 10 times
    reconnectDelay: 3000,            // Wait 3 seconds between attempts
    maxSubscribedAddresses: 500,     // Allow up to 500 addresses
    debug: true                      // Enable debug logging
  }
});

// Subscribe to addresses
await client.events.subscribeToUtxoChanges([
  'hoosat:qz7ulu...',
  'hoosat:qq8xdv...'
]);

// Monitor events
client.events.on(EventType.UtxoChange, (notification) => {
  // Handle UTXO changes
});

// Check status
const stats = client.events.getStats();
console.log('Connected:', stats.isConnected);
console.log('Monitoring:', stats.utxoSubscriptions.length, 'addresses');
```

**Best Practices**

1. **Always handle errors:**
```typescript
client.events.on(EventType.Error, (error) => {
  console.error('Error:', error);
  // Implement your error handling logic
});
```

2. **Monitor connection state:**
```typescript
client.events.on(EventType.Disconnect, () => {
  // Update UI to show disconnected state
});

client.events.on(EventType.Reconnected, () => {
  // Update UI to show connected state
});
```

3. **Clean up on application shutdown:**
```typescript
process.on('SIGINT', async () => {
  await client.events.unsubscribeFromAll();
  client.disconnect();
  process.exit(0);
});
```

4. **Check connection before operations:**
```typescript
if (!client.events.isConnected()) {
  console.warn('Not connected to event stream');
  // Resubscribe or alert user
}
```

---

### HoosatCrypto

**Key Generation and Import**
```typescript
HoosatCrypto.generateKeyPair(): KeyPair
HoosatCrypto.importKeyPair(privateKeyHex: string): KeyPair

interface KeyPair {
  address: string;
  publicKey: Buffer;
  privateKey: Buffer;
}
```

**Address Operations**
```typescript
HoosatCrypto.publicKeyToAddressECDSA(publicKey: Buffer): string
HoosatCrypto.addressToScriptPublicKey(address: string): Buffer
```

**Transaction Operations**
```typescript
HoosatCrypto.getTransactionId(transaction: Transaction): string
HoosatCrypto.signTransaction(transaction: Transaction, privateKey: Buffer, sighashType?: number): Transaction

// Calculate minimum transaction fee
HoosatCrypto.calculateMinFee(
  inputsCount: number,
  outputsCount: number,
  payloadSize?: number  // Optional: additional data size in bytes (default: 0)
): string

// Example:
const fee = HoosatCrypto.calculateMinFee(5, 2);
// Returns: "6727" (for 5 inputs, 2 outputs)
```

**Hashing**
```typescript
HoosatCrypto.blake3Hash(data: Buffer | string): Buffer
```

---

### HoosatSigner

Message signing utilities for DApp authentication, proof of address ownership, and off-chain signing.

**Key Features:**
- ECDSA message signatures with BLAKE3 hashing
- Deterministic signatures (RFC6979)
- Public key recovery from signatures
- DApp authentication with metadata support
- Compatible with Bitcoin-style message signing

**Basic Signing**
```typescript
// Sign message
const signature = HoosatSigner.signMessage(privateKeyHex: string, message: string): string

// Verify signature
const isValid = HoosatSigner.verifyMessage(
  signatureHex: string,
  message: string,
  publicKeyHex: string
): boolean

// Example
import { HoosatSigner, HoosatCrypto } from 'hoosat-sdk';

const wallet = HoosatCrypto.generateKeyPair();
const message = 'Authenticate with MyDApp';

const signature = HoosatSigner.signMessage(
  wallet.privateKey.toString('hex'),
  message
);

const isValid = HoosatSigner.verifyMessage(
  signature,
  message,
  wallet.publicKey.toString('hex')
);
console.log('Valid:', isValid); // true
```

**Public Key Operations**
```typescript
// Derive public key from private key
HoosatSigner.getPublicKey(privateKeyHex: string): string

// Recover public key from signature (best effort)
HoosatSigner.recoverPublicKey(signatureHex: string, message: string): string | null
```

**DApp Authentication**
```typescript
// Create signed message with metadata
HoosatSigner.createSignedMessage(
  privateKeyHex: string,
  message: string,
  network?: HoosatNetwork,
  options?: { appId?: string; nonce?: string }
): SignedMessage

// Verify signed message
HoosatSigner.verifySignedMessage(
  signedMessage: SignedMessage,
  network?: HoosatNetwork
): VerificationResult

interface SignedMessage {
  message: string;
  signature: string;         // 128-char hex (64 bytes)
  publicKey: string;         // 66-char hex (33 bytes compressed)
  address: string;           // Hoosat address
  timestamp: string;         // ISO 8601
  appId?: string;
  nonce?: string;
}

interface VerificationResult {
  isValid: boolean;
  recoveredPublicKey?: string;
  recoveredAddress?: string;
  error?: string;
}

// Example: DApp login flow
// Client-side
const signedMsg = HoosatSigner.createSignedMessage(
  privateKey,
  'Login to MyDApp',
  'mainnet',
  { appId: 'my-dapp', nonce: '123456' }
);

// Send to server
fetch('/api/auth', {
  method: 'POST',
  body: JSON.stringify(signedMsg)
});

// Server-side
const result = HoosatSigner.verifySignedMessage(signedMsg);
if (result.isValid) {
  console.log('Authenticated as:', result.recoveredAddress);
  // Grant access
} else {
  console.error('Authentication failed:', result.error);
}
```

**Use Cases:**

1. **DApp Authentication**
```typescript
// User signs login message
const loginMsg = HoosatSigner.createSignedMessage(
  privateKey,
  'Login to MyDApp at ' + new Date().toISOString(),
  'mainnet',
  { appId: 'my-dapp' }
);

// Server verifies and authenticates
const result = HoosatSigner.verifySignedMessage(loginMsg);
if (result.isValid) {
  // Create session for result.recoveredAddress
}
```

2. **Proof of Address Ownership**
```typescript
// User proves they own an address
const proof = HoosatSigner.createSignedMessage(
  privateKey,
  'I own this Hoosat address',
  'mainnet'
);

// Anyone can verify
const verification = HoosatSigner.verifySignedMessage(proof);
console.log('Address owner:', verification.recoveredAddress);
```

3. **Off-chain Message Signing**
```typescript
// Sign arbitrary data
const data = JSON.stringify({ action: 'approve', amount: '100' });
const signature = HoosatSigner.signMessage(privateKey, data);

// Verify later
const isValid = HoosatSigner.verifyMessage(signature, data, publicKey);
```

**Technical Details:**

- **Hashing:** BLAKE3 with "Hoosat Signed Message:\n" prefix
- **Signature:** 64-byte ECDSA (r + s components)
- **Determinism:** RFC6979 (same message + key = same signature)
- **Encoding:** Variable-length integer (varint) for message length
- **Public Key:** 33-byte compressed ECDSA public key

**Important Notes:**

- Signatures are deterministic (RFC6979) - same input always produces same signature
- Message prefix prevents signature reuse as transaction signatures
- Public key recovery is best-effort due to library limitations
- For production use, always verify signature + address together

---

### HoosatTxBuilder

**Constructor**
```typescript
const builder = new HoosatTxBuilder(options?: TxBuilderOptions);

interface TxBuilderOptions {
  debug?: boolean; // Enable debug logging
}
```

**Building Transactions**
```typescript
// Add inputs and outputs
builder.addInput(utxo: UtxoForSigning, privateKey?: Buffer): this
builder.addOutput(address: string, amount: string): this
builder.addChangeOutput(changeAddress: string): this

// Configuration
builder.setFee(fee: string): this
builder.setLockTime(lockTime: string): this

// Build and sign
builder.build(): Transaction
builder.sign(globalPrivateKey?: Buffer): Transaction
builder.buildAndSign(globalPrivateKey?: Buffer): Transaction

// Validation and info
builder.validate(): void
builder.estimateFee(feePerByte?: number): string
builder.getTotalInputAmount(): bigint
builder.getTotalOutputAmount(): bigint
builder.getInputCount(): number
builder.getOutputCount(): number

// State management
builder.clear(): this
```

---

### TransactionFeeService

**Constructor**
```typescript
const feeService = new TransactionFeeService(addressService: AddressService);
```

**Fee Calculation**
```typescript
// Calculate minimum fee for sender address
await feeService.calculateMinFee(
  address: string,
  payloadSize?: number  // Default: 0 (for future subnetwork usage)
): Promise<string>

// Example usage
const minFee = await feeService.calculateMinFee('hoosat:qz7ulu...');
console.log('Minimum fee:', minFee, 'sompi');

// With payload (future use)
const minFeeWithPayload = await feeService.calculateMinFee('hoosat:qz7ulu...', 256);
```

**How it works:**
1. Fetches UTXOs for the sender address
2. Counts inputs (number of UTXOs)
3. Assumes 2 outputs (recipient + change)
4. Calculates minimum fee using MASS-based formula
5. Returns fee in sompi as string

**Note:** This service is automatically available via `client.calculateMinFee()` - no need to instantiate manually.

---

### HoosatQR

**QR Code Generation**
```typescript
// Address QR (returns Data URL)
await HoosatQR.generateAddressQR(address: string, options?: QRCodeOptions): Promise<string>

// Payment request QR
await HoosatQR.generatePaymentQR(params: PaymentURIParams, options?: QRCodeOptions): Promise<string>

interface PaymentURIParams {
  address: string;
  amount?: string | number;  // Amount in HTN (not sompi)
  label?: string;
  message?: string;
}

interface QRCodeOptions {
  width?: number;                          // Default: 300
  errorCorrectionLevel?: 'L'|'M'|'Q'|'H'; // Default: 'M'
  margin?: number;                         // Default: 2
  color?: {
    dark?: string;   // Hex color (default: '#000000')
    light?: string;  // Hex color (default: '#FFFFFF')
  };
}

// Other formats
await HoosatQR.generateQRBuffer(address: string, options?: QRCodeOptions): Promise<Buffer>
await HoosatQR.generateQRSVG(address: string, options?: QRCodeOptions): Promise<string>
await HoosatQR.generateQRTerminal(address: string): Promise<void>
```

**URI Operations**
```typescript
HoosatQR.buildPaymentURI(params: PaymentURIParams): string
HoosatQR.parsePaymentURI(uri: string): ParsedPaymentURI
HoosatQR.isValidPaymentURI(uri: string): boolean

interface ParsedPaymentURI {
  address: string;
  amount?: string;    // Amount in sompi
  label?: string;
  message?: string;
  rawUri: string;
}
```

---

### HoosatUtils

**Amount Conversion**
```typescript
HoosatUtils.amountToSompi(htn: string): string
HoosatUtils.sompiToAmount(sompi: string | bigint): string
HoosatUtils.formatAmount(htn: string, decimals?: number): string
```

**Address Validation**
```typescript
HoosatUtils.isValidAddress(address: string): boolean
HoosatUtils.isValidAddresses(addresses: string[], checkUnique?: boolean): boolean
HoosatUtils.getAddressVersion(address: string): number | null  // 0x00, 0x01, 0x08
HoosatUtils.getAddressType(address: string): 'schnorr' | 'ecdsa' | 'p2sh' | null
HoosatUtils.getAddressNetwork(address: string): 'mainnet' | 'testnet' | null
```

**Hash Validation**
```typescript
HoosatUtils.isValidHash(hash: string, length?: number): boolean
HoosatUtils.isValidTransactionId(txId: string): boolean
HoosatUtils.isValidBlockHash(blockHash: string): boolean
HoosatUtils.isValidHashes(hashes: string[], length?: number): boolean
```

**Key Validation**
```typescript
HoosatUtils.isValidPrivateKey(privateKey: string): boolean
HoosatUtils.isValidPublicKey(publicKey: string, compressed?: boolean): boolean
```

**Amount Validation**
```typescript
HoosatUtils.isValidAmount(amount: string, maxDecimals?: number): boolean
```

**Formatting**
```typescript
HoosatUtils.truncateAddress(address: string, startChars?: number, endChars?: number): string
HoosatUtils.truncateHash(hash: string, startChars?: number, endChars?: number): string
HoosatUtils.compareAddresses(addr1: string, addr2: string): boolean
HoosatUtils.compareHashes(hash1: string, hash2: string): boolean
```

**Hashrate Formatting**
```typescript
HoosatUtils.formatHashrate(hashrate: number | string, decimals?: number): string
HoosatUtils.formatDifficulty(difficulty: number | string, decimals?: number): string
HoosatUtils.parseHashrate(formatted: string): number | null
```

**Conversion Utilities**
```typescript
HoosatUtils.hexToBuffer(hex: string): Buffer | null
HoosatUtils.bufferToHex(buffer: Buffer): string
```

**Payload Decoding and Encoding**
```typescript
// Decode hex payload to UTF-8 string
HoosatUtils.decodePayload(hexPayload: string): string

// Decode and parse payload as JSON
HoosatUtils.parsePayloadAsJson<T>(hexPayload: string): T

// Encode UTF-8 string to hex payload
HoosatUtils.encodePayload(payload: string): string

// Encode JSON object to hex payload
HoosatUtils.encodePayloadAsJson(data: any): string

// Check if payload is valid JSON
HoosatUtils.isJsonPayload(hexPayload: string): boolean

// Safe decoding with metadata (fallback for invalid UTF-8)
HoosatUtils.decodePayloadSafe(hexPayload: string): {
  decoded: string;
  isValidUtf8: boolean;
  isJson: boolean;
  raw: string;
}
```

**Examples:**
```typescript
// Decode mining payload
const miningHex = '52721f0600000000...';
const decoded = HoosatUtils.decodePayload(miningHex);
// Returns: "Rr...1.6.2/'hoo_gpu/1.2.12' via htn-stratum-bridge..."

// Decode and parse vote transaction payload
const voteHex = '7b2274797065223a22766f7465227d';
const voteData = HoosatUtils.parsePayloadAsJson(voteHex);
// Returns: { type: 'vote' }

// Encode data for payload transaction
const data = { type: 'poll_create', title: 'Test Poll' };
const hexPayload = HoosatUtils.encodePayloadAsJson(data);
// Returns: '7b2274797065223a22706f6c6c5f637265617465...'

// Safe decode with validation
const safe = HoosatUtils.decodePayloadSafe(someHex);
if (safe.isJson) {
  const data = JSON.parse(safe.decoded);
  console.log('JSON payload:', data);
} else if (safe.isValidUtf8) {
  console.log('Text payload:', safe.decoded);
} else {
  console.log('Binary payload:', safe.raw);
}
```

**UTXO Utilities**
```typescript
// Filter only mature (spendable) UTXOs
// Coinbase UTXOs require 100 confirmations before they can be spent
HoosatUtils.filterMatureUtxos<T>(
  utxos: T[],
  currentDaaScore: number,
  coinbaseMaturity?: number
): T[]

// Separate UTXOs into mature and immature groups
HoosatUtils.separateMatureUtxos<T>(
  utxos: T[],
  currentDaaScore: number,
  coinbaseMaturity?: number
): { mature: T[], immature: T[] }
```

**Example: Filter Mature UTXOs**
```typescript
import { HoosatClient, HoosatUtils } from 'hoosat-sdk';

const client = new HoosatClient({ host: 'node.hoosat.fi', port: 42420 });

// Get current DAA score
const dagInfo = await client.getBlockDagInfo();
const currentDaa = parseInt(dagInfo.result.virtualDaaScore);

// Get UTXOs for address
const utxosResponse = await client.getUtxosByAddresses([address]);

// Filter only spendable UTXOs (handles coinbase maturity automatically)
const spendableUtxos = HoosatUtils.filterMatureUtxos(
  utxosResponse.result.utxos,
  currentDaa
);

console.log(`Total UTXOs: ${utxosResponse.result.utxos.length}`);
console.log(`Spendable: ${spendableUtxos.length}`);

// Or get detailed breakdown
const { mature, immature } = HoosatUtils.separateMatureUtxos(
  utxosResponse.result.utxos,
  currentDaa
);

console.log(`Mature (spendable): ${mature.length}`);
console.log(`Immature (waiting): ${immature.length}`);
if (immature.length > 0) {
  console.log('Immature UTXOs need to wait for more confirmations');
}
```

**Why is this needed?**
- Coinbase UTXOs (from mining) require **100 block confirmations** before they can be spent
- Regular UTXOs are spendable immediately
- These utilities automatically check confirmations using DAA score
- Prevents "immature UTXO" errors when building transactions

---

## 📋 Usage Examples

The SDK includes **40+ detailed examples** covering all aspects of functionality. Each example is standalone and well-documented.

### Example Structure

```
examples/
├── address/        # Balance queries and UTXO management (3 examples)
├── crypto/                 # Cryptographic operations (4 examples)
├── node/                   # Node operations and queries (4 examples)
├── streaming/              # Real-time UTXO monitoring (1 example)
├── qr/                     # QR code generation (3 examples)
├── transaction/            # Transaction building and sending (11 examples)
├── error-handling/         # Error handling patterns (2 examples)
├── monitoring/             # Network monitoring (2 examples)
├── advanced/               # Advanced patterns (2 examples)
└── utils/                  # Utility functions (3 examples)
```

### Running Examples

```bash
# Install tsx globally
npm install -g tsx

# Run specific example
tsx examples/transaction/05-send-real.ts
```

### Example Categories

#### 📍 Address & Balance (3 examples)
- `01-balance.ts` - Check single address balance
- `02-balances-multiple.ts` - Check multiple addresses
- `03-utxos.ts` - Fetch and analyze UTXOs

#### 🔐 Cryptography (4 examples)
- `01-generate-keypair.ts` - Generate new wallet
- `02-import-keypair.ts` - Import existing wallet
- `03-address-types.ts` - Explore address types
- `04-hashing.ts` - Cryptographic hashing

#### 🌐 Node Operations (4 examples)
- `01-connect.ts` - Connect and get info
- `02-blockchain-info.ts` - Blockchain statistics
- `03-blocks.ts` - Query block data
- `04-mempool.ts` - Analyze mempool

#### 📡 Real-time Streaming (1 example)
- `01-subscribe-utxos.ts` - Real-time UTXO monitoring

#### 🎨 QR Codes (3 examples)
- `01-generate-address.ts` - Generate address QR codes
- `02-generate-payment.ts` - Payment request QR codes
- `03-parse-payment-uri.ts` - Parse payment URIs

#### 💸 Transaction Management (8 examples)
- `01-build-simple.ts` - Build simple transaction
- `02-build-with-change.ts` - Automatic change handling
- `03-multiple-inputs.ts` - Handle multiple inputs
- `04-estimate-fee.ts` - Calculate minimum fee
- `05-send-real.ts` - Send real transaction ⚠️
- `07-send-real-batch.ts` - Batch payment ⚠️
- `08-consolidate-utxos.ts` - UTXO consolidation ⚠️
- `09-split-utxo.ts` - Split UTXO ⚠️
- `10-check-transaction-status.ts` - Check transaction status (PENDING/CONFIRMED/NOT_FOUND)
- `11-subnetwork-payload-test.ts` - Test payload on subnetworks ⚠️
- `12-testnet-subnetwork-payload.ts` - Test payload on testnet ⚠️

#### ⚠️ Error Handling (2 examples)
- `01-network-errors.ts` - Network error handling
- `03-retry-strategies.ts` - Retry patterns

#### 📊 Monitoring (2 examples)
- `01-track-balance-changes.ts` - Real-time balance tracking
- `02-network-stats.ts` - Network statistics

#### 🚀 Advanced (2 examples)
- `01-multi-recipient-batching.ts` - Batch payments (3+ recipients)
- `02-multi-node-failover.ts` - Multi-node setup with automatic failover

#### 🛠 Utilities (3 examples)
- `01-amount-conversion.ts` - Amount conversions
- `02-validation.ts` - Input validation
- `03-formatting.ts` - Pretty formatting

---

## 🔄 Error Handling

All SDK methods return a standardized result:

```typescript
interface BaseResult<T> {
  ok: boolean;
  result: T | null;
  error: string | null;
}
```

### Usage Pattern

```typescript
const result = await client.getBalance(address);

if (result.ok) {
  // Success - use result.result
  console.log('Balance:', result.result.balance);
} else {
  // Error - use result.error
  console.error('Error:', result.error);
}
```

### Error Categories

**Network Errors:**
- Connection timeout
- Lost connection
- gRPC communication errors

**Transaction Errors:**
- Insufficient balance
- Invalid addresses
- Recipient limit exceeded (spam protection)
- Invalid UTXO references

**Validation Errors:**
- Invalid address formats
- Invalid private keys
- Invalid amounts
- Invalid transaction structure

---

## 💰 UTXO Management

### UTXO Selection Strategies

#### 1. Largest First (Minimize Fees)
```typescript
// Sort UTXOs by amount (largest first)
const sorted = utxos.sort((a, b) => 
  Number(BigInt(b.utxoEntry.amount) - BigInt(a.utxoEntry.amount))
);

// Select UTXOs until we have enough
let totalSelected = 0n;
const selectedUtxos = [];

for (const utxo of sorted) {
  if (totalSelected >= neededAmount) break;
  selectedUtxos.push(utxo);
  totalSelected += BigInt(utxo.utxoEntry.amount);
}
```

**Advantages:**
- Minimizes transaction size
- Lower fees
- Fewer inputs required

**Disadvantages:**
- May leave small UTXOs unused
- Large UTXO gets consumed

#### 2. Smallest First (UTXO Cleanup)
```typescript
// Sort UTXOs by amount (smallest first)
const sorted = utxos.sort((a, b) => 
  Number(BigInt(a.utxoEntry.amount) - BigInt(b.utxoEntry.amount))
);
```

**Advantages:**
- Cleans up small UTXOs
- Reduces wallet complexity
- Good for consolidation

**Disadvantages:**
- More inputs = higher fees
- Larger transaction size

#### 3. Random Selection (Privacy)
```typescript
// Shuffle UTXOs randomly
const shuffled = [...utxos].sort(() => Math.random() - 0.5);
```

**Advantages:**
- Unpredictable pattern
- Better privacy
- Makes chain analysis harder

**Disadvantages:**
- Unpredictable fees
- Not optimal for size

### UTXO Consolidation

Combine many small UTXOs into one large UTXO:

```typescript
// Get all UTXOs
const utxosResult = await client.getUtxosByAddresses([wallet.address]);
const utxos = utxosResult.result.utxos;

// Calculate minimum fee
const minFee = await client.calculateMinFee(wallet.address);

// Build consolidation transaction
const builder = new HoosatTxBuilder();

// Add all UTXOs as inputs
for (const utxo of utxos) {
  builder.addInput(utxo, wallet.privateKey);
}

// Single output to same address
const totalIn = builder.getTotalInputAmount();
const fee = BigInt(minFee);
const outputAmount = (totalIn - fee).toString();

builder.addOutput(wallet.address, outputAmount);
builder.setFee(minFee);

// Submit
const signedTx = builder.sign();
await client.submitTransaction(signedTx);
```

**When to consolidate:**
- Accumulated many small UTXOs (>10)
- Low network activity (cheap fees)
- Before an important transaction

**Example:** `examples/transaction/08-consolidate-utxos.ts`

### UTXO Splitting

Split one large UTXO into multiple smaller ones:

```typescript
// Get largest UTXO
const utxos = await client.getUtxosByAddresses([wallet.address]);
const largestUtxo = utxos.result.utxos.sort((a, b) =>
  Number(BigInt(b.utxoEntry.amount) - BigInt(a.utxoEntry.amount))
)[0];

// Calculate minimum fee
const minFee = await client.calculateMinFee(wallet.address);

// Build split transaction
const totalAmount = BigInt(largestUtxo.utxoEntry.amount);
const fee = BigInt(minFee);
const splitAmount = (totalAmount - fee) / 2n;

const builder = new HoosatTxBuilder();
builder.addInput(largestUtxo, wallet.privateKey);
builder.addOutput(wallet.address, splitAmount.toString());  // Split 1
builder.addOutput(wallet.address, splitAmount.toString());  // Split 2
builder.setFee(minFee);

const signedTx = builder.sign();
await client.submitTransaction(signedTx);
```

**When to split:**
- Preparing for multiple payments
- Improving privacy
- Parallel transactions

**Example:** `examples/transaction/09-split-utxo.ts`

---

## 🛡️ Spam Protection

Hoosat inherits **dust-attack protection** from Kaspa. This is a hard protocol-level limitation:

### Transaction Limits

- **Maximum 2 recipient outputs** per transaction
- **Maximum 3 outputs total** (2 recipients + 1 change)

```typescript
// ✅ VALID - 2 recipients + change
builder.addInput(utxo, privateKey);
builder.addOutput('hoosat:recipient1...', '100000000');
builder.addOutput('hoosat:recipient2...', '50000000');
builder.addChangeOutput(wallet.address);  // Total: 3 outputs

// ❌ INVALID - 3 recipients
builder.addInput(utxo, privateKey);
builder.addOutput('hoosat:recipient1...', '100000000');
builder.addOutput('hoosat:recipient2...', '50000000');
builder.addOutput('hoosat:recipient3...', '25000000');  // ERROR!
```

### Handling Multiple Recipients

For sending to 3+ recipients, use **batch payments** (multiple transactions):

```typescript
const recipients = [
  { address: 'hoosat:addr1...', amount: '100000000' },
  { address: 'hoosat:addr2...', amount: '50000000' },
  { address: 'hoosat:addr3...', amount: '75000000' },
  { address: 'hoosat:addr4...', amount: '25000000' },
];

// Split into batches of 2
const batches = [];
for (let i = 0; i < recipients.length; i += 2) {
  batches.push(recipients.slice(i, i + 2));
}

// Process each batch
for (const batch of batches) {
  const builder = new HoosatTxBuilder();
  
  // Get fresh UTXO for each transaction
  const utxos = await client.getUtxosByAddresses([wallet.address]);
  builder.addInput(utxos.result.utxos[0], wallet.privateKey);
  
  // Add recipients (max 2)
  for (const recipient of batch) {
    builder.addOutput(recipient.address, recipient.amount);
  }
  
  builder.setFee(estimatedFee);
  builder.addChangeOutput(wallet.address);
  
  const signedTx = builder.sign();
  await client.submitTransaction(signedTx);
  
  // Add delay between batches
  await new Promise(r => setTimeout(r, 2000));
}
```

**Example:** `examples/advanced/01-multi-recipient-batching.ts`

### Why This Limitation?

1. **Spam Protection** - Prevents creating thousands of small UTXOs
2. **Network Performance** - Reduces validation load
3. **UTXO Set Size** - Controls database growth

---

## 💡 Best Practices

### 1. Always Check Results

```typescript
const result = await client.getBalance(address);
if (!result.ok) {
  console.error('Error:', result.error);
  return;
}
// Safe to use result.result
console.log('Balance:', result.result.balance);
```

### 2. Validate Before Operations

```typescript
// Validate address
if (!HoosatUtils.isValidAddress(address)) {
  throw new Error('Invalid Hoosat address');
}

// Validate private key
if (!HoosatUtils.isValidPrivateKey(privateKeyHex)) {
  throw new Error('Invalid private key format');
}

// Validate amount
if (!HoosatUtils.isValidAmount(amount)) {
  throw new Error('Invalid amount format');
}
```

### 3. Use Automatic Fee Calculation

```typescript
// Don't use static fees
// ❌ builder.setFee('1000');

// Use automatic fee calculation
const minFee = await client.calculateMinFee(wallet.address);
builder.setFee(minFee);

// Or calculate manually if you know inputs/outputs count
const manualFee = HoosatCrypto.calculateMinFee(inputsCount, outputsCount);
builder.setFee(manualFee);
```

### 4. Handle UTXO Selection Properly

```typescript
// Get UTXOs
const utxos = await client.getUtxosByAddresses([wallet.address]);

// Sort for optimal selection (largest first)
const sorted = utxos.result.utxos.sort((a, b) => 
  Number(BigInt(b.utxoEntry.amount) - BigInt(a.utxoEntry.amount))
);

// Select enough for amount + fee
const needed = BigInt(sendAmount) + BigInt(estimatedFee);
let total = 0n;
const selected = [];

for (const utxo of sorted) {
  if (total >= needed) break;
  selected.push(utxo);
  total += BigInt(utxo.utxoEntry.amount);
}
```

### 5. Monitor Real-time Changes

```typescript
import { EventType } from 'hoosat-sdk';

// Subscribe to UTXO changes
await client.events.subscribeToUtxoChanges([wallet.address]);

// Listen for changes
client.events.on(EventType.UtxoChange, (notification) => {
  console.log('UTXOs added:', notification.changes.added.length);
  console.log('UTXOs removed:', notification.changes.removed.length);
  // Update balance, refresh UI, etc.
});

// Handle errors
client.events.on(EventType.Error, (error) => {
  console.error('Streaming error:', error);
  // Log error, notify user, etc.
});

// Monitor connection state
client.events.on(EventType.Disconnect, () => {
  console.warn('Disconnected - will attempt reconnection');
});

client.events.on(EventType.Reconnected, () => {
  console.log('Reconnected successfully');
});

// Check status
if (client.events.isConnected()) {
  console.log('Streaming active');
}
```

### 6. Calculate Fee Before Building Transaction

```typescript
// Always calculate fee before building transaction
const minFee = await client.calculateMinFee(wallet.address);

// Check if you have enough funds (amount + fee)
const balance = await client.getBalance(wallet.address);
const totalRequired = BigInt(sendAmount) + BigInt(minFee);

if (BigInt(balance.result.balance) < totalRequired) {
  throw new Error('Insufficient funds including fee');
}
```

### 7. Implement Retry Logic

```typescript
async function submitWithRetry(tx, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await client.submitTransaction(tx);
    
    if (result.ok) {
      return result;
    }
    
    // Wait before retry
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  
  throw new Error('Failed after max retries');
}
```

### 8. Monitor Network Status

```typescript
// Check node sync status before operations
const info = await client.getInfo();

if (!info.ok || !info.result.isSynced) {
  console.warn('Node not synced, waiting...');
  // Wait or use different node
}
```

### 9. Secure Key Management

```typescript
// ❌ Never hardcode private keys
// const privateKey = '33a4a81e...';

// ✅ Use environment variables
const privateKey = process.env.WALLET_PRIVATE_KEY;

// ✅ Or secure key storage
import { readFileSync } from 'fs';
const privateKey = readFileSync('.keys/wallet.key', 'utf8').trim();
```

### 10. Clean Up Resources

```typescript
// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  
  // Unsubscribe from all events
  await client.events.unsubscribeFromAll();
  
  // Disconnect from node
  client.disconnect();
  
  process.exit(0);
});

// Or selective cleanup
async function cleanup() {
  // Unsubscribe from specific addresses
  await client.events.unsubscribeFromUtxoChanges([wallet.address]);
  
  // Check status
  const stats = client.events.getStats();
  console.log('Remaining subscriptions:', stats.utxoSubscriptions.length);
  
  // Full disconnect if no more subscriptions
  if (stats.utxoSubscriptions.length === 0) {
    client.disconnect();
  }
}
```

### 11. Secure Key Management

```typescript
// ❌ Never hardcode private keys
// const privateKey = '33a4a81e...';

// ✅ Use environment variables
const privateKey = process.env.WALLET_PRIVATE_KEY;

// ✅ Or secure key storage
import { readFileSync } from 'fs';
const privateKey = readFileSync('.keys/wallet.key', 'utf8').trim();

// Clear sensitive data after use
let keyBuffer = Buffer.from(privateKey, 'hex');
// ... use key ...
keyBuffer.fill(0);
keyBuffer = null;
```

---

## 🧪 Testing

The SDK uses [Vitest](https://vitest.dev/) for unit testing.

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui

# Watch mode
npm test -- --watch
```

### Test Structure

```
tests/
├── crypto/
│   └── crypto.test.ts         # HoosatCrypto tests (90%+ coverage)
├── transaction/
│   └── tx-builder.test.ts     # HoosatTxBuilder tests (90%+ coverage)
├── utils/
│   └── utils.test.ts          # HoosatUtils tests (95%+ coverage)
└── qr/
    └── qr.test.ts             # HoosatQR tests
```

### Test Coverage Goals

- ✅ **HoosatCrypto** - 90%+ coverage (key generation, signing, hashing)
- ✅ **HoosatTxBuilder** - 90%+ coverage (transaction building, validation)
- ✅ **HoosatUtils** - 95%+ coverage (validation, conversion, formatting)
- 🔄 **HoosatClient** - Integration tests
- 🔄 **HoosatFeeEstimator** - Unit tests

### Running Specific Tests

```bash
# Test specific module
npm test crypto

# Test with pattern
npm test -- --grep "validation"
```

---

## 🔧 Development

### Clone Repository

```bash
git clone https://github.com/Namp88/hoosat-sdk.git
cd hoosat-sdk
```

### Install Dependencies

```bash
npm install
```

### Development Commands

```bash
# Build project
npm run build

# Watch mode (rebuild on changes)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Format code
npm run format

# Check formatting
npm run format:check
```

### Adding New Feature

1. **Create feature branch**
```bash
git checkout -b feature/my-new-feature
```

2. **Implement feature** in appropriate module (e.g., `src/utils/`)

3. **Add tests**
```typescript
// tests/my-feature/my-feature.test.ts
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
```

4. **Add usage example**
```typescript
// examples/my-feature/01-basic-usage.ts
import { MyFeature } from 'hoosat-sdk';

async function main() {
  // Example implementation
  console.log('Example output');
}

main();
```

5. **Update exports** in `src/index.ts`
```typescript
export { MyFeature } from '@my-module/my-feature';
export type { MyFeatureOptions } from '@my-module/my-feature.types';
```

6. **Run tests and formatting**
```bash
npm test
npm run format
npm run build
```

7. **Create Pull Request**

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Contribution Process

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### Guidelines

- Follow existing code style (use Prettier)
- Add tests for new functionality
- Update documentation (README, code comments)
- Ensure all tests pass
- Write clear, descriptive commit messages
- Keep PRs focused (one feature per PR)

### Code Style

```bash
# Format code before committing
npm run format

# Check formatting
npm run format:check
```

### What We're Looking For

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🧪 Additional tests
- 🎨 Code quality improvements
- 🔧 Performance optimizations

### Areas for Contribution

- Additional UTXO selection strategies
- More comprehensive error handling examples
- Integration with popular frameworks (React, Vue, etc.)
- CLI tools for common operations
- Additional network analytics features
- Improved caching mechanisms

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Andrei Kliubchenko

---

## 🔗 Links

- **Hoosat Official Website:** [https://hoosat.fi](https://hoosat.fi)
- **Hoosat Network Info:** [https://network.hoosat.fi](https://network.hoosat.fi/)
- **GitHub Repository:** [https://github.com/Namp88/hoosat-sdk](https://github.com/Namp88/hoosat-sdk)
- **NPM Package:** [https://www.npmjs.com/package/hoosat-sdk](https://www.npmjs.com/package/hoosat-sdk)
- **Issues & Bug Reports:** [https://github.com/Namp88/hoosat-sdk/issues](https://github.com/Namp88/hoosat-sdk/issues)

---

## 📞 Support

For questions, issues, and support:

- **GitHub Issues:** [https://github.com/Namp88/hoosat-sdk/issues](https://github.com/Namp88/hoosat-sdk/issues)
- **Email:** namp2988@gmail.com
- **Hoosat Community:** Join official Hoosat [channels](https://network.hoosat.fi/)

When reporting issues, please include:
- SDK version (`npm list hoosat-sdk`)
- Node.js version (`node --version`)
- Operating system
- Code snippet reproducing the issue
- Error messages and stack traces

---

## 🙏 Acknowledgments

Special thanks to:

- **Tonto** - Lead Hoosat developer for invaluable technical guidance, spam protection insights, and network protocol expertise
- **Hoosat Core Team** - For building an innovative and robust blockchain
- **Kaspa Community** - For the foundational architecture and spam protection mechanisms
- **All Contributors** - Community members who help improve this SDK through code, testing, and feedback

---

## 📊 Technical Specifications

### Supported Platforms

- **Node.js:** >= 20.0.0
- **TypeScript:** >= 5.0.0
- **Operating Systems:** Linux, macOS, Windows

### Network Support

- **Mainnet** - Production network (`hoosat:` addresses)
- **Testnet** - Test network (`hoosattest:` addresses)

### Address Types

- **ECDSA (0x01)** - secp256k1 ECDSA signatures (default)
- **Schnorr (0x00)** - Schnorr signatures
- **P2SH (0x08)** - Pay-to-Script-Hash

### Transaction Specifications

- **Version:** 0
- **Lock Time:** Configurable (default: 0)
- **Subnetwork ID:** `0000000000000000000000000000000000000000`
- **Gas:** 0 (not used)
- **Max Outputs:** 3 (2 recipients + 1 change)
- **Signature Type:** SIGHASH_ALL (0x01)

### Hashing

- **Transaction ID:** BLAKE3
- **Block Hash:** BLAKE3
- **Signature Hash:** BLAKE3 + SHA256 (for ECDSA)

---

**Made with ❤️ for the Hoosat community**

*Version: 0.1.3*  
*Last Updated: October 2025*