import {
  GetBlock,
  GetBlockTransaction,
  GetBlockTransactionInput,
  GetBlockTransactionInputPreviousOutpoint,
  GetBlockTransactionOutput,
  GetBlockTransactionOutputScriptPublicKey,
  GetBlockTransactionOutputVerboseData,
  GetBlockTransactionVerboseData,
  GetBlockHeader,
  GetBlockHeaderParent,
  GetBlockVerboseData,
} from '@client/models/result/get-block';

/**
 * Result type for getBlockByTransactionId method.
 * Contains the block that includes the specified transaction.
 */
export interface GetBlockByTransactionId extends GetBlock {}

// Re-export block-related types for convenience
export {
  GetBlockTransaction as GetBlockByTransactionIdTransaction,
  GetBlockTransactionInput as GetBlockByTransactionIdTransactionInput,
  GetBlockTransactionInputPreviousOutpoint as GetBlockByTransactionIdTransactionInputPreviousOutpoint,
  GetBlockTransactionOutput as GetBlockByTransactionIdTransactionOutput,
  GetBlockTransactionOutputScriptPublicKey as GetBlockByTransactionIdTransactionOutputScriptPublicKey,
  GetBlockTransactionOutputVerboseData as GetBlockByTransactionIdTransactionOutputVerboseData,
  GetBlockTransactionVerboseData as GetBlockByTransactionIdTransactionVerboseData,
  GetBlockHeader as GetBlockByTransactionIdHeader,
  GetBlockHeaderParent as GetBlockByTransactionIdHeaderParent,
  GetBlockVerboseData as GetBlockByTransactionIdVerboseData,
};
