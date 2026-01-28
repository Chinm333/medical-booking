# Medical Clinic Booking System

An event-driven, serverless medical clinic booking system implementing the SAGA choreography pattern with proper error handling and compensation logic.

## Architecture Overview

### System Design

The system follows an **event-driven architecture** with **SAGA choreography pattern**:

1. **Event Bus**: Central event routing system (simulated - in production would use AWS EventBridge/GCP Pub/Sub)
2. **Event Handlers**: Stateless functions that process events and emit new events
3. **State Store**: In-memory storage (simulated - in production would use DynamoDB/Firestore)
4. **Quota Store**: Tracks daily R1 discount quota (simulated - in production would use Redis/DynamoDB)
5. **Pricing Service**: Calculates discounts based on business rules
6. **Holiday Service**: Fetches holiday information from external API

### SAGA Pattern Implementation

The booking workflow follows these steps:

1. **Booking Initiated** → User Validation
2. **User Validated** → Slot Reservation (compensatable step)
3. **Slot Reserved** → Price Calculation (R1 quota + R2 holiday)
4. **Price Calculated** → Booking Completion

**Compensation Logic**: If any step fails after a side-effect, the system compensates by:
- releasing the reserved slot
- revoking the R1 quota allocation (if granted)
- deleting the booking confirmation (if written)

### Business Rules

#### R1: Discount for Female Birthday OR High-Value Orders
- **12% discount** if:
  - User is female AND today is their birthday, OR
  - Base price sum > ₹1000

#### R2: Holiday Discount
- **Additional 3% discount** if today is a national holiday
- Fetches from external API (calendarific.com/nager.at)
- Falls back to hardcoded holidays if API fails

#### R3: Daily Discount Quota
- System-wide limit: **100 R1 discounts per day** (configurable)
- Resets at midnight IST
- Applies only to requests qualifying for R1 discount
- If quota exhausted → request rejected with clear error message

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Running the CLI

```bash
# Development mode (with ts-node)
npm run dev

# Production mode (after build)
npm start
```

### Running Test Scenarios

```bash
npm run test:scenarios
```

This will run all 4 test scenarios:
1. Positive case
2. Negative case: Quota exhausted
3. Negative case: Invalid service selection
4. Negative case: Compensation logic demonstration

## Project Structure

```
medical-booking/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── data/            # Medical services data
│   ├── events/          # Event bus and handlers
│   ├── workflow/        # SAGA orchestrator
│   ├── pricing/         # Pricing rules and calculations
│   ├── services/        # External services (holiday API)
│   ├── storage/         # State and quota stores
│   ├── utils/           # Utilities (logger, date helpers)
│   ├── cli/             # Terminal client
│   └── test/            # Test scenarios
├── logs/                # Application logs (generated)
├── dist/                # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Test Scenarios

### Scenario 1: Positive Case
- **User**: Female, birthday today, high-value order (>₹1000)
- **Expected**: Booking succeeds with R1 discount (12%) and potentially R2 discount (3% if holiday)
- **Demonstrates**: Successful end-to-end workflow

### Scenario 2: Negative Case - Quota Exhausted (Compensation Triggered)
- **Setup**: R1 discount quota exhausted (100 discounts already granted)
- **User**: Male, high-value order (>₹1000)
- **Expected**: Booking fails with "Daily discount quota reached" error
- **Demonstrates**: Quota validation and error handling

### Scenario 3: Negative Case - Fail After Price (Compensation Triggered)
- **Setup**: Fault injection `simulateFailureAt=after_price`
- **Expected**: Booking fails; compensation releases slot and revokes R1 quota
- **Demonstrates**: SAGA compensation after quota allocation

### Scenario 4: Negative Case - Fail During Completion (Compensation Triggered)
- **Setup**: Fault injection `simulateFailureAt=complete_booking`
- **Expected**: Booking fails; compensation deletes confirmation, releases slot, revokes R1 quota
- **Demonstrates**: Multi-step compensation

## Assumptions Made

1. **Storage**: Using in-memory stores for simplicity. In production:
   - Booking state → DynamoDB/Firestore
   - Quota tracking → Redis/DynamoDB with TTL
   - Event history → CloudWatch/Stackdriver Logs

2. **Event Bus**: Simulated event bus. In production:
   - AWS EventBridge
   - GCP Pub/Sub
   - Azure Event Grid

3. **Holiday API**: 
   - Primary: calendarific API (free, no auth required)
   - Fallback: Hardcoded major Indian holidays

4. **Real-time Updates**: 
   - CLI polls booking status every 500ms
   - In production, would use WebSockets or Server-Sent Events

5. **Date Handling**:
   - All dates in IST (UTC+5:30)
   - Birthday comparison uses month and day only (ignores year)

6. **Error Handling**:
   - API failures are handled gracefully
   - Compensation only triggers if R1 discount was applied
   - All errors are logged with structured logging

7. **Scalability**:
   - All functions are stateless
   - No shared mutable state (except quota store which would be Redis in production)
   - Event-driven design allows horizontal scaling

## Observability

### Structured Logging

All events are logged with:
- Request ID (correlation ID)
- Timestamp
- Event type
- Payload
- Error details (if applicable)

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console (in development mode)

### Log Format

```json
{
  "timestamp": "2026-01-26 10:30:45.123",
  "level": "info",
  "message": "Processing booking initiation",
  "requestId": "uuid",
  "correlationId": "uuid",
  "payload": {...}
}
```

## Deployment Considerations

### GCP Deployment (Recommended)

1. **Cloud Functions** for event handlers
2. **Cloud Pub/Sub** for event bus
3. **Firestore** for booking state
4. **Cloud Memorystore (Redis)** for quota tracking
5. **Cloud Logging** for observability

### AWS Deployment

1. **Lambda Functions** for event handlers
2. **EventBridge** for event bus
3. **DynamoDB** for booking state and quota
4. **CloudWatch Logs** for observability

## Environment Variables

```bash
# Optional: Override default values
MAX_R1_DISCOUNTS=100          # Daily R1 discount limit
HOLIDAY_API_URL=https://calendarific.com/api/v2/holidays   # Holiday API endpoint
NODE_ENV=production           # Environment mode
API_KEY= XXXXXX               # Holiday API KEY
COUNTRY_CODE=IN               # Country Code 
```

## Future Enhancements

1. **Database Integration**: Replace in-memory stores with persistent storage
2. **Real Event Bus**: Integrate with AWS EventBridge or GCP Pub/Sub
3. **WebSocket Support**: Real-time updates instead of polling
4. **Rate Limiting**: Per-user rate limiting
5. **Retry Logic**: Automatic retry for transient failures
6. **Monitoring**: CloudWatch/Stackdriver dashboards
7. **Alerts**: SNS/Pub/Sub notifications for failures

## License

MIT
