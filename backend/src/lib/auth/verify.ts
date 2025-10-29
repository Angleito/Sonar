/**
 * Wallet signature verification
 * Uses @mysten/sui.js to verify wallet signatures
 */

import { verifyPersonalMessage } from '@mysten/sui.js/verify';
import { isValidSuiAddress } from '@mysten/sui.js/utils';
import { logger } from '../logger';

/**
 * Verify a wallet signature matches the claimed address
 * Returns true if signature is valid, false otherwise
 */
export async function verifyWalletSignature(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    // Validate address format
    if (!isValidSuiAddress(address)) {
      logger.warn({ address }, 'Invalid address format');
      return false;
    }

    // Verify the signature
    const messageBytes = new TextEncoder().encode(message);
    const publicKey = await verifyPersonalMessage(messageBytes, signature as any);

    // Derive the address from the public key
    const derivedAddress = publicKey.toSuiAddress();

    // Compare addresses
    const isValid = derivedAddress.toLowerCase() === address.toLowerCase();

    if (!isValid) {
      logger.warn(
        { claimedAddress: address, derivedAddress },
        'Signature address mismatch'
      );
    }

    return isValid;
  } catch (error) {
    logger.error(
      { error, address },
      'Signature verification failed'
    );
    return false;
  }
}

/**
 * Validate address format without checking signature
 */
export function isValidAddress(address: string): boolean {
  return isValidSuiAddress(address);
}
