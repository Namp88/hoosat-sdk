/**
 * Example: Get Block by Transaction ID
 *
 * Demonstrates:
 * - Finding which block contains a specific transaction
 * - Retrieving block details using transaction ID
 * - Analyzing transaction data within the block
 *
 * Prerequisites:
 * - Running Hoosat node
 * - A valid transaction ID (can be obtained from mempool or previous transactions)
 */
import { HoosatClient, HoosatUtils } from 'hoosat-sdk';

async function main() {
  console.log('🔍 Get Block by Transaction ID\n');

  const client = new HoosatClient({
    host: process.env.HOOSAT_NODE_HOST || '54.38.176.95',
    port: parseInt(process.env.HOOSAT_NODE_PORT || '42420'),
  });

  try {
    // First, let's get a transaction ID from the current tip block
    console.log('1️⃣ Getting a sample transaction ID...');
    console.log('─────────────────────────────────────');

    const tipResult = await client.getSelectedTipHash();
    if (!tipResult.ok) {
      console.error('Failed to get tip hash:', tipResult.error);
      return;
    }

    const blockResult = await client.getBlock(tipResult.result!.selectedTipHash, true);
    if (!blockResult.ok) {
      console.error('Failed to get block:', blockResult.error);
      return;
    }

    const sampleTx = blockResult.result!.transactions[0];
    const transactionId = sampleTx.verboseData.transactionId;

    console.log(`Sample Transaction ID: ${transactionId}`);
    console.log(`From Block: ${HoosatUtils.truncateHash(blockResult.result!.verboseData.hash)}\n`);

    // Now let's use getBlockByTransactionId to find the block
    console.log('2️⃣ Finding block by transaction ID...');
    console.log('─────────────────────────────────────');

    const result = await client.getBlockByTransactionId(transactionId, true);

    if (!result.ok) {
      console.error('Failed to get block by transaction ID:', result.error);
      return;
    }

    const block = result.result!;

    console.log('✅ Block found!\n');
    console.log('📦 Block Information:');
    console.log(`Hash:            ${block.verboseData.hash}`);
    console.log(`Timestamp:       ${new Date(parseInt(block.header.timestamp)).toISOString()}`);
    console.log(`DAA Score:       ${block.header.daaScore}`);
    console.log(`Blue Score:      ${block.header.blueScore}`);
    console.log(`Transactions:    ${block.transactions.length}`);
    console.log(`Is Chain Block:  ${block.verboseData.isChainBlock}`);
    console.log(`Difficulty:      ${block.verboseData.difficulty}`);
    console.log();

    // Find and display the target transaction
    console.log('3️⃣ Transaction Details...');
    console.log('─────────────────────────────────────');

    const targetTx = block.transactions.find(
      tx => tx.verboseData.transactionId === transactionId
    );

    if (targetTx) {
      console.log(`Transaction ID:  ${targetTx.verboseData.transactionId}`);
      console.log(`Hash:            ${targetTx.verboseData.hash}`);
      console.log(`Mass:            ${targetTx.verboseData.mass}`);
      console.log(`Inputs:          ${targetTx.inputs.length}`);
      console.log(`Outputs:         ${targetTx.outputs.length}`);
      console.log(`Version:         ${targetTx.version}`);
      console.log(`Lock Time:       ${targetTx.lockTime}`);
      console.log(`Subnetwork ID:   ${targetTx.subnetworkId}`);
      console.log();

      // Show outputs
      if (targetTx.outputs.length > 0) {
        console.log('📤 Outputs:');
        targetTx.outputs.forEach((output, idx) => {
          const amountHTN = HoosatUtils.sompiToAmount(output.amount);
          console.log(`  Output ${idx}:`);
          console.log(`    Amount:  ${amountHTN} HTN (${output.amount} sompi)`);
          console.log(`    Address: ${output.verboseData?.scriptPublicKeyAddress || 'N/A'}`);
          console.log(`    Type:    ${output.verboseData?.scriptPublicKeyType || 'N/A'}`);
        });
        console.log();
      }
    }

    // Example with custom transaction ID (if provided as argument)
    const customTxId = process.argv[2];
    if (customTxId) {
      console.log('4️⃣ Looking up custom transaction ID...');
      console.log('─────────────────────────────────────');
      console.log(`Transaction ID: ${customTxId}\n`);

      if (!HoosatUtils.isValidTransactionId(customTxId)) {
        console.error('Invalid transaction ID format');
        return;
      }

      const customResult = await client.getBlockByTransactionId(customTxId, true);

      if (customResult.ok) {
        console.log('✅ Block found!');
        console.log(`Block Hash: ${customResult.result!.verboseData.hash}`);
        console.log(`DAA Score:  ${customResult.result!.header.daaScore}`);
        console.log(`Timestamp:  ${new Date(parseInt(customResult.result!.header.timestamp)).toISOString()}`);
      } else {
        console.log('❌ Transaction not found in any block');
        console.log(`Error: ${customResult.error?.message}`);
      }
    } else {
      console.log('💡 Tip: You can pass a transaction ID as argument:');
      console.log('   npx tsx 05-get-block-by-transaction.ts <transaction_id>');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

main().catch(console.error);
