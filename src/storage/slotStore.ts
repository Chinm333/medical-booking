const slotStore: Map<string, { slotId: string; reservedAt: string }> = new Map();

export function reserveSlot(requestId: string): { slotId: string; reservedAt: string } {
  const existing = slotStore.get(requestId);
  if (existing) return existing;

  const slotId = `SLOT-${requestId.substring(0, 8).toUpperCase()}`;
  const reservedAt = new Date().toISOString();
  const reservation = { slotId, reservedAt };
  slotStore.set(requestId, reservation);
  return reservation;
}

export function isSlotReserved(requestId: string): boolean {
  return slotStore.has(requestId);
}

export function releaseSlot(requestId: string): boolean {
  return slotStore.delete(requestId);
}

export function clearSlots(): void {
  slotStore.clear();
}

