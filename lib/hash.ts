import { createHash } from 'crypto';

/** Hash a PIN with the player's ID as salt. Server-side only. */
export function hashPin(pin: string, playerId: string): string {
  return createHash('sha256').update(`${pin}:${playerId}`).digest('hex');
}
