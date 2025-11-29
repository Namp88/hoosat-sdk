import { ErrorResponse } from '@client/models/response/error.response';

export interface GetBlockByTransactionIdResponse {
  getBlockByTransactionIdResponse: {
    block: Block;
    error: ErrorResponse;
  };
  payload: 'getBlockByTransactionIdResponse';
}

interface Block {
  transactions: BlockTransaction[];
  header: BlockHeader;
  verboseData: BlockVerboseData;
}

interface BlockTransaction {
  inputs: BlockTransactionInput[];
  outputs: BlockTransactionOutput[];
  version: number;
  lockTime: string;
  subnetworkId: string;
  gas: string;
  verboseData: {
    transactionId: string;
    hash: string;
    mass: string;
    blockHash: string;
    blockTime: string;
  };
}

interface BlockTransactionInput {
  previousOutpoint: {
    transactionId: string;
    index: number;
  };
  signatureScript: string;
  sequence: string;
  sigOpCount: number;
}

interface BlockTransactionOutput {
  amount: string;
  scriptPublicKey: {
    version: number;
    scriptPublicKey: string;
  };
  verboseData: {
    scriptPublicKeyType: string;
    scriptPublicKeyAddress: string;
  };
}

interface BlockHeader {
  parents: BlockHeaderParent[];
  version: number;
  hashMerkleRoot: string;
  acceptedIdMerkleRoot: string;
  utxoCommitment: string;
  timestamp: string;
  bits: number;
  nonce: string;
  daaScore: string;
  blueWork: string;
  blueScore: string;
  pruningPoint: string;
}

interface BlockHeaderParent {
  parentHashes: string[];
}

interface BlockVerboseData {
  transactionIds: string[];
  childrenHashes: string[];
  mergeSetBluesHashes: string[];
  mergeSetRedsHashes: string[];
  hash: string;
  difficulty: number;
  selectedParentHash: string;
  isHeaderOnly: boolean;
  blueScore: string;
  isChainBlock: boolean;
}
