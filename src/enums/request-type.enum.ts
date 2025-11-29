export enum RequestType {
  // Network
  GetCurrentNetworkRequest = 'getCurrentNetworkRequest',
  GetPeerAddressesRequest = 'getPeerAddressesRequest',
  GetConnectedPeerInfoRequest = 'getConnectedPeerInfoRequest',

  // Blocks
  GetSelectedTipHashRequest = 'getSelectedTipHashRequest',
  GetBlockRequest = 'getBlockRequest',
  GetBlockByTransactionIdRequest = 'getBlockByTransactionIdRequest',
  GetBlocksRequest = 'getBlocksRequest',
  GetBlockCountRequest = 'getBlockCountRequest',
  GetBlockDagInfoRequest = 'getBlockDagInfoRequest',

  // Mempool
  GetMempoolEntryRequest = 'getMempoolEntryRequest',
  GetMempoolEntriesRequest = 'getMempoolEntriesRequest',

  // Address & Balance
  GetBalanceByAddressRequest = 'getBalanceByAddressRequest',
  GetBalancesByAddressesRequest = 'getBalancesByAddressesRequest',
  GetUtxosByAddressesRequest = 'getUtxosByAddressesRequest',

  // Node Info
  GetInfoRequest = 'getInfoRequest',
  GetCoinSupplyRequest = 'getCoinSupplyRequest',
  EstimateNetworkHashesPerSecondRequest = 'estimateNetworkHashesPerSecondRequest',
  GetVirtualSelectedParentBlueScoreRequest = 'getVirtualSelectedParentBlueScoreRequest',

  // Streaming/Notifications
  NotifyUtxosChangedRequest = 'notifyUtxosChangedRequest',
  StopNotifyingUtxosChangedRequest = 'stopNotifyingUtxosChangedRequest',
  UtxosChangedNotification = 'utxosChangedNotification',
  NotifyBlockAddedRequest = 'notifyBlockAddedRequest',
  NotifyVirtualSelectedParentChainChangedRequest = 'notifyVirtualSelectedParentChainChangedRequest',
  NotifyVirtualSelectedParentBlueScoreChangedRequest = 'notifyVirtualSelectedParentBlueScoreChangedRequest',
  NotifyVirtualDaaScoreChangedRequest = 'notifyVirtualDaaScoreChangedRequest',
  NotifyNewBlockTemplateRequest = 'notifyNewBlockTemplateRequest',

  // Transactions
  SubmitTransactionRequest = 'submitTransactionRequest',
  GetTransactionsByAddressRequest = 'getTransactionsByAddressRequest',
  GetMempoolEntriesByAddressesRequest = 'getMempoolEntriesByAddressesRequest',

  // Mining
  GetBlockTemplateRequest = 'getBlockTemplateRequest',
  SubmitBlockRequest = 'submitBlockRequest',

  // Administrative (usually not needed in client SDKs)
  ShutDownRequest = 'shutDownRequest',
  AddPeerRequest = 'addPeerRequest',
  BanRequest = 'banRequest',
  UnbanRequest = 'unbanRequest',

  // Advanced/Specialized
  GetHeadersRequest = 'getHeadersRequest',
  GetSubnetworkRequest = 'getSubnetworkRequest',
  GetVirtualSelectedParentChainFromBlockRequest = 'getVirtualSelectedParentChainFromBlockRequest',
  ResolveFinalityConflictRequest = 'resolveFinalityConflictRequest',
  NotifyFinalityConflictsRequest = 'notifyFinalityConflictsRequest',
}
