import type { SuiClient } from '@mysten/sui/client';
import { Transaction, type TransactionArgument } from '@mysten/sui/transactions';

interface CoinSelection {
  coinObjectId: string;
  balance: bigint;
}

export async function collectCoinsForAmount(
  client: SuiClient,
  owner: string,
  coinType: string,
  requiredAmount: bigint
): Promise<{ coins: CoinSelection[]; total: bigint }> {
  const coins: CoinSelection[] = [];
  let total = 0n;
  let cursor: string | null = null;

  while (total < requiredAmount) {
    const response = await client.getCoins({
      owner,
      coinType,
      cursor: cursor ?? undefined,
      limit: 50,
    });

    for (const coin of response.data) {
      coins.push({
        coinObjectId: coin.coinObjectId,
        balance: BigInt(coin.balance),
      });
      total += BigInt(coin.balance);

      if (total >= requiredAmount) {
        break;
      }
    }

    if (!response.hasNextPage || !response.nextCursor) {
      break;
    }

    cursor = response.nextCursor;
  }

  return { coins, total };
}

export function prepareCoinPayment({
  tx,
  owner,
  coins,
  total,
  required,
}: {
  tx: Transaction;
  owner: string;
  coins: CoinSelection[];
  total: bigint;
  required: bigint;
}): TransactionArgument {
  if (coins.length === 0) {
    throw new Error('No coins available for payment');
  }

  const primaryCoinId = coins[0].coinObjectId;
  const additionalCoinIds = coins.slice(1).map(coin => coin.coinObjectId);

  if (additionalCoinIds.length > 0) {
    tx.mergeCoins(primaryCoinId, additionalCoinIds);
  }

  const primaryCoinArg = tx.object(primaryCoinId);

  if (total === required) {
    return primaryCoinArg;
  }

  const [paymentCoin] = tx.splitCoins(primaryCoinArg, [tx.pure.u64(required)]);

  tx.transferObjects(
    [primaryCoinId],
    tx.pure.address(owner)
  );

  return paymentCoin;
}
