# 🚀 IoT Telemetry Ingestor

This project is a high-performance IoT telemetry ingestor built with **NestJS** and **TypeScript**. It's designed to accept JSON device readings, persist them to **MongoDB**, cache the latest data per-device in **Redis**, and trigger real-time alerts to a webhook.

This repository fulfills all requirements for the "Associate Software Engineer - Cloud & IoT Solutions" technical exercise.

---

## ✨ Core Features

* **High-Speed Ingest:** `POST /api/v1/telemetry` endpoint handles single or array-based telemetry payloads.
* **Persistent Storage:** All readings are saved to a MongoDB Atlas cluster.
* **Redis Caching:** The latest reading for every device is cached in Redis (`latest:<deviceId>`) for millisecond-level retrieval.
* **Real-time Alerting:** Immediately sends a POST alert to a configured webhook if `temperature > 50` or `humidity > 90`.
* **Data & Analytics APIs:**
    * `GET /api/v1/devices/:deviceId/latest`: Fetches the latest device reading (Redis-first, with Mongo fallback).
    * `GET /api/v1/sites/:siteId/summary`: Provides powerful time-boxed aggregations for a site.
* **Service Health:** A `GET /api/v1/health` endpoint monitors the live connection status of MongoDB and Redis.
* **Robust Validation:** All incoming data is strictly validated using DTOs and `class-validator`.

---

## 🛠️ Getting Started

### Prerequisites

* Node.js (v18+)
* npm
* A running **Redis** instance
* A **MongoDB Atlas** cluster (a free M0 cluster is sufficient)

### 1. Installation

1.  Clone or download the project.
2.  Navigate to the project directory: `cd telemetry-ingestor`
3.  Install dependencies: `npm install`

### 2. Configuration

Create a `.env` file in the project root and add the following variables.

```dotenv
# ---------------------------------
# .env Configuration
# ---------------------------------

# MongoDB Atlas Connection String
# Note: This project was tested with a MongoDB Atlas cluster
MONGO_URI=mongodb+srv://<user>:<pass>@<your_cluster_url>/<db_name>

# Redis Connection URL
REDIS_URL=redis://localhost:6379

# Alert Webhook URL (My unique URL for review)
ALERT_WEBHOOK_URL=[https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b](https://webhook.site/d26806b1-3de3-4837-b83a-5772d82a1b0b)

# Secure Bearer Token
INGEST_TOKEN=secret123

# Application Port
PORT=3000
