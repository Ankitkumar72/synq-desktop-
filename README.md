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
    <img src="https://img.shields.io/badge/Flutter-3.22+-02569B?logo=flutter&logoColor=white" />
    <img src="https://img.shields.io/badge/Next.js-14+-000000?logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue" />
  </p>
</div>

---

## 🚀 What is Synq?

**Synq is a cross-platform, unified productivity operating system** that brings together tasks, notes, calendar, and focus into one seamless experience.

> ✨ Every note can contain tasks
> ✨ Every task exists in time
> ✨ Everything is connected
> ✨ Multiplayer Realtime Sync

Built as a **multi-platform system**, Synq ensures your workflow stays consistent across mobile and desktop, utilizing a single source of truth architecture.

---

## 🧠 Core Philosophy

Most productivity tools are fragmented. Synq solves this by following a **Unified Productivity Model**:

* **No separation between notes and tasks**
* **Context-aware scheduling and timeline-driven workflow**
* **Cross-device synchronization** with a "Server-First with Optimistic UI" engine
* **Local-first** architecture to keep you working offline seamlessly

---

## 🧩 Applications

| App              | Platform      | Stack                        | Purpose                              |
| ---------------- | ------------- | ---------------------------- | ------------------------------------ |
| **synq-app**     | iOS & Android | Flutter + Bloc + Isar        | Capture, focus, and manage on-the-go |
| **synq-desktop** | Web/Desktop   | Next.js 14 + Zustand + Slate | Deep work, planning, analytics       |

---

## ✨ Features

### 🏠 Smart Dashboard
* Unified view of tasks, notes, and events with real-time priority surfacing
* Daily summaries & progress insights

### 📝 Realtime Notes & Editor System
* **Block-based editing engine** (Slate.js for Web, Custom/Quill for Mobile)
* **Realtime Multiplayer Sync** powered by Supabase Websockets and Optimistic UI locking
* Offline-first support with Isar (Mobile) and Local caching
* Nested folders & tagging + Backlinks (Obsidian-style)

### ✅ Tasks & Projects
* Universal quick-add system
* Smart lists with status + priorities
* Folder-based project organization

### 📅 Timeline & Scheduling
* Live timeline with current-time tracking
* Drag & drop planner + Recurring events (daily → yearly)

### ⏱️ Focus Mode (Mobile)
* Visual focus sessions and Task-linked deep work

---

## 🏗️ Architecture & Sync Strategy

Both clients (Mobile & Desktop) act as "dumb renderers." Supabase Postgres is the single source of truth. All business logic lives in Postgres (RLS policies, triggers, functions) so both platforms behave identically.

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Flutter App   │     │   Node.js Web   │     │   Supabase      │
│  (Android/iOS)  │◄───►│   (Next.js 14)  │◄───►│  (Postgres +    │
│                 │     │                 │     │   Realtime API) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                    Shared: REST + WebSocket (Realtime)
```

### Sync Engine: Server-First with Optimistic UI
* **Reads**: Local Cache -> Supabase Subscription -> Local Cache Update
* **Writes**: Local Optimistic UI -> Debounce -> Supabase Push
* **Conflict Resolution**: Last-Write-Wins + Field-level merging via `blocks.version` locks.

---

## 🧰 Tech Stack

### 📱 Mobile App (`task_app`)
* **Framework**: Flutter 3.22+
* **State Management**: Bloc/Cubit
* **Offline Cache**: Isar NoSQL
* **Backend Integration**: `supabase_flutter`

### 🖥️ Desktop App (`Synq Desktop`)
* **Framework**: Next.js 14 (App Router) + React 18
* **Editor**: Slate.js (`slate-react`)
* **State Management**: Zustand
* **Styling**: Tailwind CSS + shadcn/ui + Framer Motion
* **Validation**: Zod (matching Supabase schema types)

### ⚡ Backend
* **Database**: Supabase (Postgres 15+)
* **Realtime**: WebSockets for Presence & Sync
* **Auth**: Supabase Auth (Email, Google OAuth)
* **Storage**: Supabase Storage for assets

---

## 💻 Getting Started

### Prerequisites
* Flutter 3.22+
* Node.js 20+
* Supabase project

---

### 📱 Mobile Setup (`task_app`)

```bash
git clone https://github.com/Ankitkumar72/synq.git
cd synq/task_app

flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
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

### 🖥️ Desktop Setup (`Synq Desktop`)

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
1. **Google Cloud**: Create OAuth Client ID & add redirect URI `https://<project-id>.supabase.co/auth/v1/callback`
2. **Supabase**: Enable Google provider, add Client ID & Secret

---

## 🤝 Contributing
```bash
git checkout -b feature/your-feature
git commit -m "feat: add feature"
git push origin feature/your-feature
```

---

## 📄 License
Apache 2.0 License

---
<div align="center">
  <p>Built with ❤️ by <b>Ankit Kumar</b></p>
  <p><i>Designing the future of productivity.</i></p>
</div>
