IoT Telemetry Ingestor - Technical Exercise
This project is a minimal IoT Telemetry Ingestor built with NestJS and TypeScript, as per the "Associate Software Engineer - Cloud & IoT Solutions" technical exercise.




The service provides a set of APIs to ingest telemetry data from IoT devices, store it in MongoDB, cache the latest readings in Redis for quick access, and trigger alerts to a webhook when metrics exceed predefined thresholds.



✨ Core Features

Telemetry Ingest: Accepts single or bulk JSON telemetry payloads via POST /api/v1/telemetry.


Database Storage: Persists all valid readings to a MongoDB Atlas cluster.


Redis Caching: Caches the latest telemetry reading for each device in Redis for fast retrieval.


Threshold Alerting: Sends an immediate POST alert to a configured webhook if temperature > 50 or humidity > 90.

Data Retrieval:


GET /api/v1/devices/:deviceId/latest: Retrieves the latest reading for a device (Redis-first, with Mongo fallback).


GET /api/v1/sites/:siteId/summary: Provides a time-boxed aggregation summary (count, avg/max temp, avg/max humidity, unique devices) for a site.


Health Check: A GET /api/v1/health endpoint to monitor the connection status of MongoDB and Redis.


Validation: Uses DTOs with class-validator to validate all incoming request bodies and query parameters.

🚀 Getting Started
Prerequisites
Node.js (v18 or later recommended)

npm

A running Redis instance (e.g., local or cloud)

A MongoDB database (a free MongoDB Atlas cluster is perfect for this) 

1. Installation
Clone this repository (or download and unzip the code).

Navigate to the project directory:

Bash

cd telemetry-ingestor
Install the project dependencies:

Bash

npm install
2. Configuration
Create a .env file in the root of the project.

Copy the contents of .env.example into your new .env file.

Update the .env file with your credentials.

Code snippet

# --- .env file ---

# 1. MongoDB Atlas Connection String 
# (Note: This project was built and tested using a MongoDB Atlas cluster)
MONGO_URI=mongodb+srv://<your_user>:<your_password>@<your_cluster_url>/<db_name>

# 2. Redis Connection URL
REDIS_URL=redis://localhost:6379

# 3. Alert Webhook URL 
# This is my unique URL for review:
# https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b
ALERT_WEBHOOK_URL=https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b

# 4. Bearer Token for securing ingest endpoints
INGEST_TOKEN=secret123

# 5. Port
PORT=3000
3. Running the Application
Once configured, you can run the application in development mode (which supports hot-reloading):

Bash

npm run start:dev
The application will be running on http://localhost:3000.

4. Running Tests
The project includes both unit and end-to-end (e2e) tests.

Note: The e2e tests require a live connection to your MongoDB and Redis instances as specified in the .env file.

Bash

# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e
🧪 Quick Verification (cURL)
You can use these curl commands to quickly test the running application.

(These examples assume the INGEST_TOKEN is secret123)

1. POST Telemetry (with High Temperature Alert)
This will ingest the data and also trigger an alert to your webhook.

Bash

curl -s -X POST http://localhost:3000/api/v1/telemetry \
-H "Content-Type: application/json" \
-H "Authorization: Bearer secret123" \
-d '{"deviceId":"dev-001","siteId":"site-A","ts":"2025-10-31T10:00:30.000Z","metrics":{"temperature":51.2, "humidity":55}}'

# Check your webhook URL: https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b
2. GET Latest Data for Device
Bash

curl -s -H "Authorization: Bearer secret123" \
http://localhost:3000/api/v1/devices/dev-001/latest
3. GET Site Summary
Bash

curl -s -H "Authorization: Bearer secret123" \
"http://localhost:3000/api/v1/sites/site-A/summary?from=2025-10-31T00:00:00.000Z&to=2025-11-01T00:00:00.000Z"
4. Check Health
Bash

curl -s http://localhost:3000/api/v1/health
🤖 Use of AI Assistance
As permitted by the exercise, AI (Gemini) was used to assist in the following ways:


Boilerplate Generation: Generated initial boilerplate for the NestJS service, controller, and DTOs with class-validator decorators.

Debugging Type Errors: Helped resolve a TypeScript error (TS2532: Object is possibly 'undefined') by suggesting the use of optional chaining (?.) for the Mongoose health check.

Troubleshooting E2E Tests: Identified why a test for invalid data (missing siteId) returned a 500 Internal Server Error instead of the expected 400 Bad Request. The AI suggested catching the Mongoose ValidationError in the service and re-throwing it as a BadRequestException.

Fixing Logic Errors: Helped add validation to the getSiteSummary method to check for invalid date strings (isNaN(date.getTime())) and return a 400 error, which fixed a failing e2e test.

README Generation: Generated the structure and polished the content for this README.md file based on the project files and exercise requirements.
