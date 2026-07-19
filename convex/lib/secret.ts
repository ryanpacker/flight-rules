// Phase-1 shared-secret gate. Every public query and mutation calls this;
// swapping in real auth later should only touch this file.
export function assertSecret(secret: string) {
  const expected = process.env.FLIGHT_RULES_SECRET;
  if (!expected) {
    throw new Error("FLIGHT_RULES_SECRET is not set on the deployment");
  }
  if (secret !== expected) {
    throw new Error("Invalid secret");
  }
}
