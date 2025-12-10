# Changelog

All notable changes to this project will be documented in this file.

### [0.2.5](https://github.com/Namp88/hoosat-sdk/compare/v0.2.4...v0.2.5) (2025-12-10)

### 📝 Documentation

- add payload methods and getBlockByTransactionId to README ([56aab7b](https://github.com/Namp88/hoosat-sdk/commit/56aab7b72d1da56b73beff1a71aa2994c7de97ed))

### [0.2.4](https://github.com/Namp88/hoosat-sdk/compare/v0.2.3...v0.2.4) (2025-11-29)

### ✨ Features

- add getBlockByTransactionId method ([ac0b7fd](https://github.com/Namp88/hoosat-sdk/commit/ac0b7fd1e62f16f0c0e900433f9af8012b85d3d0))

### [0.2.3](https://github.com/Namp88/hoosat-sdk/compare/v0.2.2...v0.2.3) (2025-10-25)

### [0.2.2](https://github.com/Namp88/hoosat-sdk/compare/v0.2.1...v0.2.2) (2025-10-19)

### ✨ Features

- add subnetwork and payload support to transaction builder ([d4f5b11](https://github.com/Namp88/hoosat-sdk/commit/d4f5b1151f3a22f3dcaf8a19d8694c68c4bbef0c))
- add UTXO maturity utilities and payload size support to fee calculation ([a3e3a7d](https://github.com/Namp88/hoosat-sdk/commit/a3e3a7dbd0cc0461f25de966406e3874f7be8945))

### [0.2.1](https://github.com/Namp88/hoosat-sdk/compare/v0.2.0...v0.2.1) (2025-10-17)

### ✨ Features

- add multi-node configuration with automatic failover ([c63f388](https://github.com/Namp88/hoosat-sdk/commit/c63f388de72776d9abe4a45706718514b2d4d223))

### 📝 Documentation

- add comprehensive JSDoc annotations for multi-node features ([f83559c](https://github.com/Namp88/hoosat-sdk/commit/f83559cfba10cb640ff84c9f26b7074cca3cd992))

## [0.2.0](https://github.com/Namp88/hoosat-sdk/compare/v0.1.8...v0.2.0) (2025-10-17)

### ✨ Features

- add transaction status checking (PENDING/CONFIRMED/NOT_FOUND) ([0350b47](https://github.com/Namp88/hoosat-sdk/commit/0350b4750510d91b4ef0d17cbe1b6f471c7bcfb9))

### [0.1.8](https://github.com/Namp88/hoosat-sdk/compare/v0.1.7...v0.1.8) (2025-10-16)

### ✨ Features

- add message signing with ECDSA for DApp authentication ([08fb2dc](https://github.com/Namp88/hoosat-sdk/commit/08fb2dcca33958263083fe1aff686626114fd44b))

### [0.1.7](https://github.com/Namp88/hoosat-sdk/compare/v0.1.6...v0.1.7) (2025-10-10)

### 🐛 Bug Fixes

- update logic for calculate fee based on util\txmass\calculator.go in HTND. Up the minimum fee to 3250 ([eef66f0](https://github.com/Namp88/hoosat-sdk/commit/eef66f0801d8fcc7182eaa83dd7edf7dd5428998))

### [0.1.6](https://github.com/Namp88/hoosat-sdk/compare/v0.1.5...v0.1.6) (2025-10-08)

### 🐛 Bug Fixes

- Path to node EventEmitter in UtxoChangeStream imports ([025f2a3](https://github.com/Namp88/hoosat-sdk/commit/025f2a3b1fb93df0c03164ed648b0effc399db8f))

### [0.1.5](https://github.com/Namp88/hoosat-sdk/compare/v0.1.4...v0.1.5) (2025-10-08)

### 📝 Documentation

- edit CHANGELOG.md ([0d615c4](https://github.com/Namp88/hoosat-sdk/commit/0d615c4a55f567c9a05ae2542db00672f111d866))

### 🔨 Build System

- Reduced publish:npm command from package.json ([eca6433](https://github.com/Namp88/hoosat-sdk/commit/eca6433225cd3b1fa913c985f26cb7486c89f7bc))

### 🐛 Bug Fixes

- path to node EventEmitter in event-manager imports ([6e49f73](https://github.com/Namp88/hoosat-sdk/commit/6e49f73b8e91fbe89d00c1bf85e3d0b0ec474cd3))

### [0.1.4](https://github.com/Namp88/hoosat-sdk/compare/v0.1.3...v0.1.4) (2025-10-08)

### 🔨 Build System

- setup automatic changelog generation with standard-version ([85a47f0](https://github.com/Namp88/hoosat-sdk/commit/85a47f09c4c7cb0c1d10026faf5af6d60197697a))

### ✨ Features

- **Event System**: Introduced `HoosatEventManager` for real-time blockchain events
  - Subscribe to UTXO changes via `client.events.subscribeToUtxoChanges()`
  - Automatic reconnection with exponential backoff
  - Multiple event types: `UtxoChange`, `Disconnect`, `Reconnected`, `Error`
  - Connection status monitoring with `client.events.getStats()`
  - Support for up to 1000 monitored addresses

### ♻️ Code Refactoring

- **Client API**: Restructured event handling
  - Moved from `client.subscribeToUtxoChanges()` to `client.events.subscribeToUtxoChanges()`
  - Events now accessed via `client.events.on(EventType.UtxoChange, handler)`
  - Improved cleanup with `client.events.disconnect()`

### 📝 Documentation

- Complete API documentation for `HoosatEventManager`
- Updated Quick Start guide with real-time streaming examples
- Added Best Practices section for event handling
- Comprehensive examples for all event types

---
