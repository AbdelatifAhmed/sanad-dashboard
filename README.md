# Sanad - Admin Dashboard

Welcome to the Admin Dashboard for the **Sanad** project! This repository contains the powerful Angular application designed for platform administrators to manage the Sanad ecosystem.

## 🎯 About Sanad & The Problem We Solve
Sanad is a comprehensive healthcare and companion booking platform designed to bridge the gap between families needing specialized care (e.g., Alzheimer's patients, elderly care) and professional companions.

Operating a two-sided marketplace in healthcare requires strict oversight, security, and quality control. This Admin Dashboard solves this problem by giving administrators total visibility into platform operations, user reviews, and security alerts powered by AI.

## ✨ Platform Features & Capabilities

### 🧠 Advanced AI Features (In the Admin Dashboard)
- **Guardian Shield Agent (Security Monitor):** A UI for monitoring the AI-powered financial and security middleware. Admins receive alerts when the AI detects and blocks users attempting to bypass the platform (sharing phone numbers, off-platform payments).
- **Review Sentiment Analyzer:** An automated queue system where the AI analyzes family reviews and complaints. Critical issues (like medical negligence) are semantically flagged and escalated to the top of the dashboard for immediate administrative intervention.

### 💻 Core Admin Features
- **Centralized Admin Oversight:** Complete tools to manage users, companions, and bookings. Admins can view financial metrics, resolve disputes, and approve or ban users.
- **Reactive Data Streams:** Built with **RxJS** observables to handle live data updates and real-time alerts efficiently.
- **Interactive Mapping & Tracking:** Uses **Leaflet** to monitor active job locations and platform activity geographically.

## 📁 File Structure
```
client/admin/sanad-Admin/my-app/
├── src/
│   ├── app/           # Angular components, modules, pages, and services
│   ├── assets/        # Static assets for the dashboard
│   ├── environments/  # Environment configurations
│   ├── index.html     # Main HTML entry point
│   └── main.ts        # Bootstrapping file
├── public/            # Public static files
├── angular.json       # Angular workspace configuration
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## 🔗 Connected Projects
Sanad is a comprehensive ecosystem divided into three main projects:
- **[Admin Dashboard (Frontend)](.)** - You are here! Angular application for administrators.
- **[Server (Backend)](../../../../server)** - Node.js/Express API.
- **[User Frontend (Web Client)](../../../user/sanad)** - Next.js application for end-users.

## 🚀 Technologies Used
- **Angular (v21)**: Comprehensive frontend framework for building robust applications.
- **Tailwind CSS v4**: Utility-first CSS framework for rapid and modern styling.
- **RxJS**: Reactive programming with observables for handling asynchronous data streams.
- **Leaflet**: Interactive maps integration.
- **Vitest**: Blazing fast unit test framework.

## 📦 Getting Started
### Prerequisites
- Node.js (v18 or higher recommended)
- Angular CLI (v21+)

### Installation
1. Navigate to the `client/admin/sanad-Admin/my-app` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run start
   ```
4. Navigate to `http://localhost:4200/`.

## 📄 License
Private
