# Synq UI System & Engineering Handbook

This document is the **single canonical source of truth** for every aspect of the Synq UI system, interaction model, architecture, and Flutter parity requirements. It is designed to act as an engineering handbook for any developer, designer, or AI agent contributing to the Synq Productivity OS. 

If it exists in the UI, it must be documented and governed by the rules herein.

---

## 1. Overall UI Philosophy

Synq is a "Productivity OS". The core UI philosophy is **density, speed, and elegance**.

- **Density over whitespace**: Productivity tools require high data density. We use tight tracking (`tracking-tight`, `-0.02em`) and compact scales (`text-[14px]` as base) so users can see more data without scrolling, without it feeling cluttered.
- **Micro-interactions as affordances**: We avoid dramatic color shifts on hover. We rely on opacity shifts (e.g., `border-white/[0.04]` -> `border-white/[0.08]`), sub-pixel translations (`-translate-y-0.5`), and spring physics to indicate interactivity.
- **Glassmorphism and Depth**: We avoid hard borders where possible. Depth is achieved via `backdrop-blur-md` and `bg-white/[0.03]` overlays on top of absolute black (`#101011`). The UI feels tactile, resembling physical layers of glass.
- **Local-First Speed**: Every interaction must feel instant. We never show a loading spinner for a local action (e.g., creating a task or typing). We rely on optimistic UI updates backed by CRDTs (Yjs) and local databases.

---

## 2. Design System

### Typography
- **Primary (Sans)**: `Roboto`. Used for all UI chrome. Weights: 400 (normal), 500 (medium), 600 (semibold).
- **Secondary (Mono)**: `Roboto Mono`. Used for metadata, IDs, timestamps (`text-[11px] font-mono tracking-[0.1em] uppercase`).
- **Accents (Display)**: `Playfair Display`. Used extremely sparingly for empty-state heroes or elegant accents.

### Spacing Scale & Corner Radius
- **Spacing**: Strict 4px grid. `space-1` (4px), `space-2` (8px), `space-3` (16px), `space-4` (24px).
- **Base Radius**: `8px` (`--radius`).
- **Cards/Dialogs Radius**: `12px` to `18px` (`--radius-xl`). Soft corners contrast with dense data grids.

### Color System & Tokens
Dark mode is the default (`#101011` background).
- **Background**: `#101011` (Deep Charcoal)
- **Sidebar**: `#090909` (Pitch Black) - Creates physical depth separation.
- **Primary Brand**: `#2eaadc` (Sky Blue in Dark), `#533afd` (Stripe Purple in Light).
- **Destructive**: `#eb5757`.
- **Borders**: Base `border-white/5`.
- **Text**: `text-[#ffffff]` (Base), `text-[#999999]` (Muted).

**Flutter Theme Equivalents**: 
Flutter must map these exact hex values into a global `ThemeData`. Semantic names (e.g., `Theme.of(context).colorScheme.primary`) must perfectly align with Tailwind CSS variables.

---

## 3. Component Library

Every component must decouple presentation from business logic.

- **Button**: 
  - *Variants*: `default`, `outline`, `secondary`, `ghost`, `destructive`.
  - *Hover*: Standard `hover:bg-*/80`. Active scale `scale-[0.98]`.
  - *Flutter Equivalent*: `ElevatedButton`, `TextButton`, `OutlinedButton` with custom `ButtonStyle` mirroring the `scale-[0.98]` interaction via `GestureDetector`.
- **Card**:
  - *Styles*: `.elite-card` (`shadow-md border-white/5`).
  - *Hover*: `box-shadow: 0 13px... translate-y(-2px)`.
  - *Flutter Equivalent*: `Container` with `BoxDecoration` utilizing identical shadow offsets and `AnimatedContainer` for hover/press states.
- **Input**:
  - *Styling*: `bg-transparent border-input rounded-lg h-8 px-2.5`.
  - *Focus*: `focus-visible:ring-3 ring-primary/50`.
  - *Flutter Equivalent*: `TextFormField` with `OutlineInputBorder` (focused state colored by primary brand).
- **Dialog/Modal**:
  - *Animations*: `fade-in-0 zoom-in-95`.
  - *Backdrop*: `bg-black/10 backdrop-blur-xs`.
  - *Flutter Equivalent*: `showGeneralDialog` with `BackdropFilter` for blur and `ScaleTransition` for the 95% zoom-in effect.

---

## 4. Every Screen

### Dashboard (`/`)
- *Purpose*: 30,000-foot view of today's schedule, notes, and tasks.
- *Layout*: Masonry/Grid. Horizontal note row, vertical timeline, 2-column bottom tasks/scratchpad.
- *Flutter Notes*: Must use a `SliverGrid` or equivalent to handle responsive reflowing smoothly.

### Calendar (`/calendar`)
- *Purpose*: Time block management.
- *Layout*: 72px sidebar + 240px sub-sidebar (mini-calendar/filters) + main flexible view.
- *Flutter Notes*: Do not use web-views. Use native `CustomPaint` or specialized calendar grids.

### Notes (`/notes`)
- *Purpose*: Core knowledge base.
- *Layout*: Left collapsible file-tree + fluid center editor.
- *Flutter Notes*: Editor must be a native `TextField` or specialized text widget connected via `editor-commands` bridge to the Y.Doc.

### Tasks (`/tasks`)
- *Layout*: Switchable between List and Board (Kanban) views.
- *Interactions*: Drag and drop is paramount. 
- *Flutter Notes*: Use `ReorderableListView` and `DragTarget` for kanban columns.

---

## 5. UI Architecture

- **Clients are Renderers**: The UI never directly manipulates data arrays. It dispatches abstract commands (`toggleBold()`, `completeTask()`) to the shared logic packages (`editor-commands`, `editor-sync`).
- **State Hierarchy**:
  - *Global State*: Zustand (Web) / Bloc (Flutter). Holds user prefs, routing, themes.
  - *Shared Sync State*: Yjs (CRDT). Holds all document/task data. Replicated to IndexedDB/Isar.
  - *Local Component State*: React `useState` / Flutter `StatefulWidget`. Used *only* for ephemeral UI state (e.g., "is dropdown open?").
- **Re-render Prevention**: Web strictly relies on `useMemo` and `useCallback`. Zustand slices must use atomic selectors (`useStore(s => s.specificField)`). Flutter uses `BlocSelector` or precise `StreamBuilder` scopes.

---

## 6. Interaction System

- **Keyboard First**: Every action must be accessible via keyboard. (e.g., `Cmd+K` for search, `Enter` to open, `Escape` to close).
- **Context Menus**: Right-click (Web) or Long-press (Flutter) opens context menus. Must never block the main thread.
- **Auto Focus**: Modals and search bars must auto-focus their primary input instantly upon rendering.
- **Multi-Selection**: `Shift+Click` and `Cmd+Click` must be supported in lists and calendar views.

---

## 7. Calendar UI

- **Virtualization**: The timeline is massive (24 hours * 90px = 2160px). It must be virtualized or explicitly sized to avoid layout thrashing.
- **Overlap Logic**: Concurrent events divide column width equally.
- **Interactions**:
  - *Drag*: Moves event start/end synchronously. Shows ghost preview in original slot.
  - *Resize*: Bottom handle alters duration. Snap intervals are 15 minutes.
- **Current Time**: A red indicator line (`w-[2px] bg-red-500/40`) strictly positioned by `(currentHour * 90) + (currentMinute * 1.5)`.
- **Flutter Parity**: The mobile app must allow long-press to instantiate a draggable new event.

---

## 8. Notes UI

- **Editor Architecture**: ProseMirror/Tiptap on Web. The schema is the canonical source of truth.
- **Hydration Lifecycle**: 
  - State Machine: `UNINITIALIZED -> HYDRATING -> READY -> DIRTY -> SYNCING -> ERROR`.
  - Autosave is completely locked until `READY`.
  - Errors trigger a read-only unmounted UI to prevent blank document overwrites.
- **Intentional Deletes**: Clients MUST send `p_allow_empty_body = true` to the backend when deliberately clearing a note to bypass backend empty-payload protections.
- **Flutter Implementation**: Must *not* use a WebView. Must bind native text editing events to Y.Doc mutations using the `editor-schema` package.

---

## 9. Tasks UI

- **Priorities**: High (`ArrowUp`, Red), Medium (`Minus`, Amber), Low (`ArrowDown`, Blue).
- **Animations**: Completing a task instantly strikes through the text, fades to `opacity-50`, and (after a 1-second delay) smoothly collapses its height to `0` before unmounting from the active list.

---

## 10. Search UI

- **Global Search (Spotlight)**: Blurred modal overlay. Fetches via FTS (Full Text Search) locally via IndexedDB/Isar first, falls back to Supabase RPC.
- **Result Ranking**: Title hits > Content hits > Subtask hits. 
- **Highlighting**: Matched text is wrapped in `<mark class="bg-primary/20 text-primary">`.

---

## 11. Navigation

- **Sidebar**: Fixed on Web (w-72px). Hidden on Mobile (becomes a slide-out Sheet/Drawer).
- **Workspace Switching**: Stored globally. Changing workspace immediately re-hydrates the Yjs root provider.
- **Deep Links**: Routing must perfectly map to URLs (`/calendar/week?date=2024-01-01`). Flutter must map native intent URIs to identical routing paths.

---

## 12. Motion System

- **Duration/Curves**: 
  - Fast: `150ms`.
  - Normal: `300ms`.
  - Spring: `stiffness: 200, damping: 20`.
- **Shared Element Transitions**: Framer Motion `layoutId` (Web) / `Hero` animations (Flutter) are used when a task expands into a full view.
- **Interruptibility**: Animations MUST be interruptible. If a user closes a modal while it is opening, it immediately reverses.

---

## 13. Responsive System

- **Breakpoints**: Mobile (`<768px`), Tablet (`768px-1024px`), Desktop (`>1024px`).
- **Web Adaptation**: Modals convert to bottom-sheet `Drawer` components on mobile screens to improve reachability.
- **Scaling**: Fonts fluidly clamp between base and sm sizes on massive monitors. Max-widths (`max-w-4xl`) preserve reading ergonomics.

---

## 14. State Matrix

Every view strictly maps to:
1. **Loading**: Skeletons shown. Background data syncing.
2. **Empty**: Centered icon, text, and primary CTA.
3. **Partial Data**: Renders cached data immediately while displaying a subtle background sync indicator.
4. **Offline**: Fully interactive. Network icon shows crossed-out cloud. Mutations queue in local IndexedDB/Isar oplog.
5. **Error**: Localized error boundary. Entire app NEVER crashes. Contextual "Retry" buttons provided.

---

## 15. Offline Behavior

- **Optimistic Updates**: The UI assumes every mutation succeeds. `crdt_documents` locally updates and UI reacts instantly.
- **Sync State**: A global SyncManager runs in the background. Reconnection triggers a Yjs state vector exchange.
- **Conflict UI**: CRDTs intrinsically merge text. Structural conflicts (e.g., two offline devices move a task to different folders) rely on Last-Write-Wins based on HLC (Hybrid Logical Clock). No manual conflict resolution UI is required.

---

## 16. Accessibility

- **Contrast**: `muted-foreground` must pass WCAG AA on `#101011` background.
- **Reduced Motion**: If OS requests reduced motion, spring animations default to instantaneous CSS fades.
- **Screen Readers**: `aria-live` regions announce task completions.

---

## 17. Performance Rules

- **Target**: 60fps minimum on low-end devices; 120fps on ProMotion displays.
- **Virtualization**: Any list > 50 items MUST be virtualized (`@tanstack/react-virtual` or Flutter `ListView.builder`).
- **Render Boundaries**: Keep rapidly mutating state (like mouse position or typing cursors) at the lowest possible component level. Never lift it to global context.

---

## 18. Flutter Parity (Mandatory)

Flutter is NOT a "best effort" port. It is a first-class peer.
- **What Must Match**: Business logic, offline sync resolution, color hexes, border radii, spacing grids, typography sizing, interaction delays, and error state logic.
- **Allowed Divergences**:
  - *Gestures*: Flutter utilizes swipes (e.g., Swipe to delete a task) where Web relies on Hover + Click.
  - *Navigation*: Flutter relies on standard native back-stack routes and Sheets, omitting the fixed left sidebar.
  - *Context Menus*: Flutter uses Long-Press haptic feedback instead of Right-Click.

---

## 19. Visual Consistency Rules

- **NEVER** use raw hex colors in UI component styles (always `bg-primary`, never `bg-[#2eaadc]`).
- **NEVER** mix font families.
- **ALWAYS** apply `focus-visible:ring-3` for accessibility.
- **ALWAYS** include a visual empty state for any list.

---

## 20. Engineering Principles

1. **Presentation is Dumb**: Reusable UI components must never contain API calls, Supabase logic, or routing logic.
2. **State is King**: Every UI state must be completely reproducible by passing a specific JSON object or state variable (for easy testing).
3. **Never Block the Main Thread**: Long running tasks (local search index building) must use Web Workers (Web) or Isolates (Flutter).
4. **Deterministic Design**: The UI must respond identically to the same input every single time, across every platform.
