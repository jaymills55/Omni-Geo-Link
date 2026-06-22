# Omni Geo-Link Engine

A full-stack, enterprise-grade QR code generator and dynamic routing application designed for high-ticket marketing campaigns.

## 🚀 Tech Stack Architecture
* **Frontend:** React.js, Vite, HTML5 Canvas Rendering
* **Backend:** Node.js, Express.js
* **Database & Routing:** SQLite, IP Geolocation (`geoip-lite`)
* **Deployment:** GitHub CI/CD Actions, Railway Cloud Hosting

## 🛠️ Core Features & Deep Dive
* **Tier 2 Geo-Fencing Perimeter:** Built a secure backend telemetry pipeline capable of intercepting incoming public IP addresses, parsing geographic metadata in milliseconds, and executing strict, state-level routing rules to redirect users based on physical location constraints.
* **Dynamic Canvas Rendering:** Overhauled the frontend visual layer to programmatically generate high-contrast, brand-aligned QR codes featuring an embedded center anchor logo (Level H error correction matrix).
* **Automated Cloud Deployment:** Architected a continuous integration and deployment (CI/CD) framework syncing this repository straight to a live Railway cloud deployment layer for immediate frontend-to-backend database parity.

## 📈 The Impact
> Shifted from static link routing to a dynamic, geo-intelligent perimeter, allowing for location-exclusive data access and advanced campaign tracking.

## 💻 Local Installation & Setup
1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/omni-geo-link.git](https://github.com/your-username/omni-geo-link.git)
cd backend && npm install
cd ../frontend && npm install
npm run dev
