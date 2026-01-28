const confirmationStore: Map<string, { referenceId: string; createdAt: string }> = new Map();

export function createConfirmation(requestId: string, referenceId: string): void {
  confirmationStore.set(requestId, { referenceId, createdAt: new Date().toISOString() });
}

export function hasConfirmation(requestId: string): boolean {
  return confirmationStore.has(requestId);
}

export function deleteConfirmation(requestId: string): boolean {
  return confirmationStore.delete(requestId);
}

export function clearConfirmations(): void {
  confirmationStore.clear();
}

