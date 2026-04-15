let c = 0;

/** Returns nonce + timestamp headers for supertest write requests */
export function nh(): Record<string, string> {
  c++;
  return {
    'X-Nonce': `test-${Date.now()}-${c}-${Math.random()}`,
    'X-Timestamp': String(Date.now()),
  };
}
