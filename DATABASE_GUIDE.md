# ⚡ IRONFIT PRO - Neon Lakebase Postgres Database Guide

Your gym tracker is officially wired into **Neon Cloud Postgres (PostgreSQL 18.6)**!

---

## ☁️ Neon Cloud Database Configuration
- **Project Name**: `fitbody`
- **Project ID**: `small-queen-86460958`
- **Branch**: `production`
- **Region**: `AWS US East 2 (Ohio)`
- **Database**: `neondb`
- **Endpoint**: `ep-damp-moon-bdhdyb34-pooler.c-8.us-east-2.aws.neon.tech`
- **Driver**: `@neondatabase/serverless` (Official Neon Serverless Driver with built-in connection pooling)

### PostgreSQL Tables Created:
1. `app_state`: Stores full JSON document snapshots for quick instant recovery.
2. `workouts`: Relational table tracking date, day of week, sets JSON, total volume (kg), and completed sets count.
3. `measurements`: Relational table tracking date, weight (kg), waist (cm), and hips (cm).
4. `habits`: Relational table tracking 3L water compliance, daily steps, sleep hours, and meals followed.

---

## 🚀 How to Run the App:
```bash
# Start the Neon backend server
npm start
# Or double-click start_server.bat
```
- Open `http://localhost:3000` on your PC.
- Open `http://<your-ip>:3000` on your phone connected to Wi-Fi, or deploy to Render/Railway for 24/7 access on mobile data (4G/5G).

## 🧪 Testing and Verification:
- Run build validation:
  ```bash
  npm run build
  ```
- Run End-to-End database test:
  ```bash
  npm test
  ```
