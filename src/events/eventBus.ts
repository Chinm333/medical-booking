import { BookingEvent, EventType } from '../types';
import { createRequestLogger } from '../utils/logger';

// Event bus for event-driven architecture
// In production, this would be AWS EventBridge, GCP Pub/Sub, or similar
type EventHandler = (event: BookingEvent) => Promise<void>;

class EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private eventHistory: BookingEvent[] = [];
  
  subscribe(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
  
  async publish(event: BookingEvent): Promise<void> {
    this.eventHistory.push(event);
    
    const handlers = this.handlers.get(event.eventType) || [];
    
    // Execute handlers sequentially for SAGA pattern
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        const logger = createRequestLogger(event.requestId, event.correlationId);
        logger.error(`Error in event handler for ${event.eventType}`, error);
        throw error;
      }
    }
  }
  
  getEventHistory(requestId: string): BookingEvent[] {
    return this.eventHistory.filter(e => e.requestId === requestId);
  }
  
  clearHistory(): void {
    this.eventHistory = [];
  }
}

export const eventBus = new EventBus();
