🚀 IoT Telemetry Ingestor
This project is a high-performance IoT telemetry ingestor built with NestJS and TypeScript. It's designed to accept JSON device readings , persist them to MongoDB , cache the latest data per-device in Redis , and trigger real-time alerts to a webhook.





This repository fulfills all requirements for the "Associate Software Engineer - Cloud & IoT Solutions" technical exercise.


✨ Core Features

High-Speed Ingest: POST /api/v1/telemetry endpoint handles single or array-based telemetry payloads.


Persistent Storage: All readings are saved to a MongoDB Atlas cluster.


Redis Caching: The latest reading for every device is cached in Redis (latest:<deviceId>) for millisecond-level retrieval.


Real-time Alerting: Immediately sends a POST alert to a configured webhook if temperature > 50 or humidity > 90.

Data & Analytics APIs:


GET /api/v1/devices/:deviceId/latest: Fetches the latest device reading (Redis-first, with Mongo fallback).


GET /api/v1/sites/:siteId/summary: Provides powerful time-boxed aggregations for a site.


Service Health: A GET /api/v1/health endpoint monitors the live connection status of MongoDB and Redis.


Robust Validation: All incoming data is strictly validated using DTOs and class-validator.

🛠️ How to Run
### Prerequisites
Node.js (v18+)

npm

A running Redis instance

A MongoDB Atlas cluster (a free M0 cluster is sufficient )

### 1. Installation
Clone or download the project.

Navigate to the project directory: cd telemetry-ingestor

Install dependencies: npm install

### 2. Configuration
Create a .env file in the project root and add the following variables.

Code snippet

# MongoDB Atlas Connection String
# Note: This project was tested with a MongoDB Atlas cluster 
MONGO_URI=mongodb+srv://<user>:<pass>@<your_cluster_url>/<db_name>

# Redis Connection URL
REDIS_URL=redis://localhost:6379

# Alert Webhook URL (My unique URL for review) [cite: 17, 65]
ALERT_WEBHOOK_URL=https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b

# Secure Bearer Token [cite: 24, 42]
INGEST_TOKEN=secret123

# Application Port
PORT=3000
### 3. Run the Application
Bash

# Start in development mode (with hot-reload)
npm run start:dev
The application will be running on http://localhost:3000.

### 4. Run Tests
Tests require a live connection to the configured MongoDB and Redis instances.

Bash

# Run unit tests
npm run test

# Run end-to-end (e2e) tests
npm run test:e2e
🧪 API Quick Test (cURL)
Here are a few curl commands to test the live service. (Assumes INGEST_TOKEN=secret123)

1. POST Telemetry (Triggers high-temp alert)
Bash

curl -X POST http://localhost:3000/api/v1/telemetry \
-H "Content-Type: application/json" \
-H "Authorization: Bearer secret123" \
-d '{"deviceId":"dev-001","siteId":"site-A","ts":"2025-10-31T10:00:30.000Z","metrics":{"temperature":51.2, "humidity":55}}'
Check the webhook! 👉 https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b

2. GET Latest Data
Bash

curl -H "Authorization: Bearer secret123" \
http://localhost:3000/api/v1/devices/dev-001/latest
3. GET Site Summary
Bash

curl -H "Authorization: Bearer secret123" \
"http://localhost:3000/api/v1/sites/site-A/summary?from=2025-10-31T00:00:00.000Z&to=2025-11-01T00:00:00.000Z"
4. GET Health Status
Bash

curl http://localhost:3000/api/v1/health
🤖 AI Assistance Report
As permitted, AI was used to accelerate development in the following ways:


Initial Scaffolding: Generated the initial NestJS module, controller, service, and DTOs (with class-validator) to speed up setup.

TypeScript Debugging: Helped resolve a TS2532: Object is possibly 'undefined' error in the checkHealth method by suggesting the use of optional chaining (?.).

E2E Test Troubleshooting: Diagnosed why an invalid POST request was returning a 500 error instead of a 400. The AI recommended catching the Mongoose ValidationError and re-throwing it as a BadRequestException to fix the test.

Logic Implementation: Provided the correct isNaN(date.getTime()) check to validate date strings in the getSiteSummary method, fixing a failing e2e test.

Documentation: Generated this README.md file based on the project code and exercise PDF, which I then reviewed and formatted.
