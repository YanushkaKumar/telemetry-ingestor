# 🚀 IoT Telemetry Ingestor

This project is a high-performance IoT telemetry ingestor service built with **NestJS** and **TypeScript**. It is designed to accept JSON device readings, persist them to **MongoDB**, cache the latest data per-device in **Redis**, and trigger real-time alerts to a webhook.

This repository fulfills all requirements for the "Associate Software Engineer - Cloud & IoT Solutions" technical exercise.

---

## ✨ Core Features

* **High-Speed Ingest:** A `POST /api/v1/telemetry` endpoint that accepts both single and array-based telemetry payloads.
* **Persistent Storage:** All valid readings are saved to a **MongoDB** collection.
* **Redis Caching:** The latest reading for every device is cached in Redis (using the key `latest:<deviceId>`) for millisecond-level retrieval.
* **Real-time Alerting:** Immediately sends a `POST` alert to a configured webhook if `temperature > 50` or `humidity > 90`.
* **Data & Analytics APIs:**
    * `GET /api/v1/devices/:deviceId/latest`: Fetches the latest device reading (Redis-first, with a Mongo fallback).
    * `GET /api/v1/sites/:siteId/summary`: Provides powerful time-boxed aggregations for a site (count, avg/max temp, avg/max humidity, unique devices).
* **Service Health:** A `GET /api/v1/health` endpoint monitors the live connection status of both MongoDB and Redis.
* **Robust Validation:** All incoming data is strictly validated using DTOs and `class-validator`.

---

## 🛠️ Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* npm
* A running **Redis** instance (e.g., `redis://localhost:6379`)
* A **MongoDB** database (see configuration note below)

### 1. Installation

1.  Clone or download the project.
2.  Navigate to the project directory: `cd telemetry-ingestor`
3.  Install dependencies: `npm install`

### 2. Configuration

Create a `.env` file in the project root by copying `.env.example`. You must fill in these values:

```dotenv
# ---------------------------------
# .env Configuration
# ---------------------------------

# 1. MongoDB Atlas Connection String
# Note: This project was developed and tested using a MongoDB Atlas free cluster.
# This is my specific connection string:
MONGO_URI=mongodb+srv://yanushkakumaar:YOUR_PASSWORD_HERE@cluster0.blnzamp.mongodb.net/?appName=Cluster0

# 2. Redis Connection URL
REDIS_URL=redis://localhost:6379

# 3. Alert Webhook URL (My unique URL for review)
ALERT_WEBHOOK_URL=[https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b](https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b)

# 4. Secure Bearer Token (Optional, but implemented)
INGEST_TOKEN=secret123

# 5. Application Port
PORT=3000

🤖 AI Assistance Report
As permitted by the exercise, AI (Gemini) was used to accelerate development, debug, and improve code quality.

TypeScript Debugging: Helped resolve a strict-mode TypeScript error (TS2532: Object is possibly 'undefined') in the checkHealth method by suggesting the use of optional chaining (?.) for the Mongoose connection object.

E2E Test Troubleshooting (Error Handling): Diagnosed why two end-to-end tests were failing. The AI suggested catching the Mongoose ValidationError on ingest and the Invalid Date error on the summary endpoint, and re-throwing them as a BadRequestException (400), which fixed the tests.

Unit Test Setup: Provided the complete boilerplate for the failing unit tests (.spec.ts files), including how to properly mock all the service and controller dependencies (like TelemetryModel, ConfigService, and HttpService).

README Generation: Generated this detailed README.md file by analyzing all the project files (.ts, .env, .pdf) to ensure all requirements from the exercise document were met and correctly documented.
