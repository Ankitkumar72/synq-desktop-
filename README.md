<div align="center">
  <img src="assets/images/logo.png" width="120" height="120" alt="Synq Logo" />

# Synq — Productivity OS

### Unified. Intelligent. Designed for how you actually work.

  <p>
    <a href="#-mobile-app">📱 Mobile</a> •
    <a href="#-desktop-app">🖥️ Desktop</a> •
    <a href="#-backend">⚡ Backend</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Flutter-3.10.7+-02569B?logo=flutter&logoColor=white" />
    <img src="https://img.shields.io/badge/Next.js-15+-000000?logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue" />
  </p>
</div>

---

## 🚀 What is Synq?

**Synq is a unified productivity operating system** that brings together tasks, notes, calendar, and focus into one seamless experience.

> ✨ Every note can contain tasks
> ✨ Every task exists in time
> ✨ Everything is connected

Built as a **multi-platform system**, Synq ensures your workflow stays consistent across mobile and desktop.

---

## 🧠 Core Philosophy

Most productivity tools are fragmented.

Synq solves this by following a **Unified Productivity Model**:

* No separation between notes and tasks
* Timeline-driven workflow
* Context-aware scheduling
* Cross-device synchronization

---

## 🧩 Applications

| App              | Platform      | Stack                | Purpose                              |
| ---------------- | ------------- | -------------------- | ------------------------------------ |
| **synq-app**     | iOS & Android | Flutter + Riverpod   | Capture, focus, and manage on-the-go |
| **synq-desktop** | Web/Desktop   | Next.js 15 + Zustand | Deep work, planning, analytics       |

---

## ✨ Features

### 🏠 Smart Dashboard

* Unified view of tasks, notes, and events
* Real-time priority surfacing
* Daily summaries & progress insights

---

### 📅 Timeline & Scheduling

* Live timeline with current-time tracking
* Drag & drop planner
* Recurring events (daily → yearly)
* Infinite calendar navigation

---

### ✅ Tasks & Projects

* Universal quick-add system
* Smart lists with status + priorities
* Folder-based project organization
* Native reminders & notifications

---

### 📝 Notes System

* Rich text + Markdown (Tiptap)
* Nested folders & tagging
* Attachments with optimized storage
* Fast navigation with state persistence

---

### ⏱️ Focus Mode (Mobile)

* Visual focus sessions
* Task-linked deep work
* Flexible timers & tracking

---

### 📊 Analytics

* Productivity insights
* Streak tracking
* Completion metrics

---

### 🛡️ Data Safety

* Trash recovery system
* Offline-first architecture (Hive)
* Zero data loss design

---

## 🔐 Authentication & Security

* Email + Password login
* Google OAuth (one-tap login)
* Secure session management
* TLS encrypted communication
* Supabase Auth + Edge Functions

---

## 🏗️ Architecture

```
Mobile (Flutter)        Desktop (Next.js)
       │                        │
       └──────────┬─────────────┘
                  │
          Supabase Backend
   (Auth • Database • Storage • Realtime)
```

### Key Design Principles

* Feature-first architecture
* Shared backend, independent clients
* Local-first + real-time sync

---

## 🧰 Tech Stack

### 📱 Mobile App

* Flutter 3.10+
* Riverpod (State)
* Hive (Offline cache)
* Supabase
* Firebase (Messaging + Crashlytics)

---

### 🖥️ Desktop App

* Next.js 15 (App Router)
* React 19
* Tailwind CSS + Framer Motion
* Zustand (State)
* Tiptap (Editor)
* TypeScript

---

### ⚡ Backend

* Supabase (PostgreSQL)
* Realtime sync
* Storage system
* Edge Functions
* Paddle (Billing)

---

## 📦 Ecosystem

| Component         | Description        |
| ----------------- | ------------------ |
| `synq-app`        | Mobile app         |
| `synq-desktop`    | Desktop/web app    |
| `paddle-backend`  | Subscription logic |
| `image-optimizer` | Asset processing   |

---

## 💻 Getting Started

### Prerequisites

* Flutter 3.10+
* Node.js 20+
* Supabase project

---

### 📱 Mobile Setup

```bash
git clone https://github.com/Ankitkumar72/synq.git
cd synq/task_app

flutter pub get
```

Create `.env`:

```env
SUPABASE_URL=your-url
SUPABASE_ANON_KEY=your-key
```

```bash
flutter run
```

---

### 🖥️ Desktop Setup

```bash
cd synq/Synq\ Desktop
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm run dev
```

---

## 🔐 Google OAuth Setup

### Google Cloud

* Create OAuth Client ID
* Add redirect URI:

```
https://<project-id>.supabase.co/auth/v1/callback
```

### Supabase

* Enable Google provider
* Add Client ID & Secret
* Configure redirect URLs

> ⚠️ Common issue: mismatch in redirect URI or client secret

---

## 🗂️ Project Structure

### Mobile

```
task_app/
├── lib/
│   ├── features/
│   ├── core/
│   └── main.dart
└── assets/
```

### Desktop

```
src/
├── app/
├── components/
├── hooks/
├── lib/
└── types/
```

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
git commit -m "feat: add feature"
git push origin feature/your-feature
```

Open a PR 🚀

---

## 📄 License

Apache 2.0 License

---

<div align="center">
  <p>Built with ❤️ by <b>Ankit Kumar</b></p>
  <p><i>Designing the future of productivity.</i></p>
</div>
