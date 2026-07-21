# Synq Productivity OS: Complete App Design & Flow

This document details the exact design specifications, user flow, component breakdowns, and comprehensive stylistic decisions for the Synq Productivity OS web application.

---

## 1. Typography & Styling Rules

We use modern, highly legible fonts loaded via `next/font/google`.

*   **Primary Font (Sans-serif): `Roboto`**
    *   **Usage**: Used for all standard text, paragraphs, labels, headings (`--font-sans`, `--font-heading`, `--font-display`).
    *   **Weights**: 100, 300, 400, 500, 700, 900.
    *   **Classes**: `font-sans`, `font-display` (tracking tightened to `-0.02em`, leading `1.05` to `1.1`).
*   **Monospace Font: `Roboto_Mono`**
    *   **Usage**: Used for labels, small metadata text, timeline labels, and inline code (`--font-mono`).
    *   **Classes**: `font-mono`, `label-mono` (`text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground`).
*   **Accent/Display Font: `Playfair_Display`**
    *   **Usage**: Reserved for elegant accents or specific rich text typography.

**Global Animation/Styling Properties:**
*   **Border Radius**: `--radius` base is `8px`. `--radius-xl` is `18px`.
*   **Transitions**: `--duration-fast: 150ms`, `--duration-normal: 300ms`, `--ease-premium: cubic-bezier(0.16, 1, 0.3, 1)`.
*   **Cards**: `.elite-card` applies `hover:-translate-y-0.5` and a deep CSS box-shadow for a floating effect.
*   **Scrollbars**: Custom 6px width/height invisible track, with `bg-white/[0.15]` thumb that turns `bg-white/[0.25]` on hover.

---

## 2. Iconography (`lucide-react`)

All icons are imported exclusively from **`lucide-react`**.

### Usage by Context:
*   **Sidebar Navigation**: `LayoutDashboard`, `Calendar`, `FileText` (Notes), `Folder`, `Trash2`, `Settings`.
*   **Dashboard**: `FilePlus` (New Note), `ListPlus` (New Task), `CalendarPlus` (New Event), `CalendarIcon` (Schedule), `Circle` (Todo toggle), `CheckCircle2` (Done).
*   **Notes Editor**: `Clock` (Timestamp), `Plus`, `ChevronRight` (Collapsible sections).
*   **Tasks & Filters**: `LayoutGrid` (Board View), `List` (List View), `Search`, `Filter`, `ArrowUp` (High Priority), `Minus` (Medium Priority), `ArrowDown` (Low Priority).
*   **Folders**: `FolderKanban`, `Pin`, `PinOff`, `AlignLeft` (Edit Desc), `Edit3` (Rename).

---

## 3. Color System (Exact Hex & CSS Variables)

The application relies on CSS variables within `@theme inline` in `globals.css`.

### Dark Mode (Default / Active)
*   **Backgrounds**:
    *   **App Root (`--background`)**: `#101011` (Deep charcoal black)
    *   **Sidebar (`--sidebar`)**: `#090909` (Pitch black)
    *   **Cards / Popovers (`--card`, `--popover`)**: `#171717` (Elevated dark gray)
    *   **Secondary Elements (`--secondary`, `--muted`)**: `#1F1F1F`
    *   **Glass Layers**: `bg-white/[0.03]`, `bg-white/[0.05]`, `bg-white/10` with `backdrop-blur-md`
*   **Text (Foreground)**:
    *   **Main Text (`--foreground`)**: `#ffffff` (Pure white)
    *   **Muted Text (`--muted-foreground`)**: `#999999`
    *   **Subtle Text**: `text-[#515151]`, `text-[#666666]`, `text-[#808080]`
*   **Brand & Accents**:
    *   **Primary Brand (`--primary`)**: `#2eaadc` (Vibrant Light Blue) - Used for primary actions, gap cursors, borders on focus.
    *   **Destructive (`--destructive`)**: `#eb5757` (Soft Red) - Used for deleting, overdue items.
*   **Status / Priority Colors**:
    *   **High / At-Risk**: `bg-rose-500/10 text-rose-500 border-rose-500/20`
    *   **Medium / Overdue**: `bg-amber-500/10 text-amber-500 border-amber-500/20`
    *   **Low / On-Track**: `bg-blue-500/10 text-blue-500 border-blue-500/20`
    *   **Done / Success**: `text-emerald-500 bg-emerald-500/20`

### Light Mode
*   **Backgrounds**: Main (`#ffffff`), Sidebar/Muted (`#f5f5f7`).
*   **Text**: Main (`#171717`), Muted (`#808080`).
*   **Brand**: Primary (`#533afd` Stripe Purple), Destructive (`#fa5252`).

---

## 4. App Flow & Page-by-Page Deep Dive

### 4.1 Global Layout & Sidebar
*   **Sidebar (w-[240px])**: Fixed left panel, `bg-[#090909]`, `p-3`.
    *   **Top**: Avatar (`w-[30px] h-[30px] bg-[#262626]`) + Display Name. Online indicator (`w-2 h-2 bg-[#04C40A]`).
    *   **Search**: Dummy Quick Search bar (`bg-[#1F1F1F] text-[#999999]`) triggering Cmd+K.
    *   **Nav Links**: Rounded-lg padding (`px-4 py-2`). Active state: `bg-[#1F1F1F] text-white`. Inactive: `text-[#999999] hover:bg-[#1F1F1F]`.

### 4.2 Dashboard (`/`)
*   **Header**:
    *   `greeting` ("Good Morning, Name") in `text-[28px]`.
    *   Date in `text-[#999999] text-[15px]`, daily quote in `italic text-[#666666] text-[14px]`.
    *   **Quick Actions**: 3 right-aligned buttons for New Note, New Task, New Event.
*   **Notes Row (Top Grid)**:
    *   Horizontal scroll (`overflow-x-auto no-scrollbar`).
    *   **Note Cards**: `bg-[#1E1E1E]`, `w-min-[240px]`, `border-white/[0.06]`. Icon `bg-white/5` (or `bg-red-500/10 text-red-400` if titled "dsa" or category "code").
*   **Today's Schedule (Middle Row)**:
    *   Container: `bg-[#171717] border-[#2E2E2E] rounded-2xl p-5`.
    *   Custom timeline: `24 * 90px` width. Hours shown as `text-[11px] font-mono`.
    *   Red vertical indicator line (`w-[2px] bg-red-500/40`) exactly tracking current time.
    *   Event cards: `bg-blue-500/10 border-l-2 border-blue-500`, absolutely positioned by start/end times.
*   **Bottom Grid (2 Columns)**:
    *   **Tasks**: Lists `todo` tasks with clickable `Circle` icons turning to `CheckCircle2`.
    *   **Scratch Pad**: Raw `<textarea>` (`bg-transparent text-[14px] text-[#B4B4B4] placeholder-[#4D4D4D]`).

### 4.3 Calendar (`/calendar`)
*   **Layout**: Splits into a secondary left sidebar (`w-72 bg-white/[0.015]`) and main content area.
*   **Left Sub-Sidebar**:
    *   "Create" Button: White background (`bg-white text-black`), rounded-full, `hover:bg-stone-200`.
    *   **MiniCalendar**: 7x6 grid, selected dates pulse with `border-white/20`.
    *   **View Selectors**: Schedule, Tasks, Events, Overdue Tasks. Active state `bg-white/[0.08] text-white border-white/10`.
*   **Main Header**:
    *   "Today" Button, Prev/Next `< >` buttons.
    *   Dynamic Title (e.g. "October 2023").
    *   Dropdown for viewing modes (Month, Week, Day, Schedule, Overdue).
*   **Main Content**: Renders `MonthView`, `WeekView`, `DayView`, etc., passing state from `useEventStore`.

### 4.4 Notes (`/notes`)
*   **Layout**: Collapsible left sub-sidebar (`w-64`) and main editor.
*   **Left Sub-Sidebar**:
    *   Contains three accordions (`ChevronRight` rotated 90deg when open): **Pinned**, **Folders**, **All Notes**.
    *   Note Items: `py-1.5 px-3 rounded-md`. Active: `bg-neutral-800/80 text-white`.
*   **Main Editor Panel**:
    *   **Header**: Note title, `ActivePresenceAvatars`, `SyncStatusIndicator`, `Clock` (`text-[11px] font-mono` relative date).
    *   **Title Input**: `text-[32px] font-bold tracking-tight bg-transparent placeholder:text-neutral-800`.
    *   **Tiptap Editor (`.ProseMirror`)**:
        *   Notion-like left block border on focus (`2.5px bg-[#2eaadc]`).
        *   Inline code rendering: `bg-[#2eaadc]/10 text-[#2eaadc] border border-[#2eaadc]/25 font-mono text-[0.85em]`.
        *   Fenced Code Blocks (`pre`): `bg-[#1a1a1e] border-white/0.06 text-[13.5px]`. Syntax highlights mapped to standard One Dark theme (`.hljs-keyword` `#c678dd`, etc.).
        *   Checkboxes: custom styled with `accent-color: #2eaadc`.
    *   **Editor Hydration Lifecycle & State Machine**:
        *   **`UNINITIALIZED` / `HYDRATING`**: Shows Skeleton UI (`h-12 w-3/4 bg-white/[0.03]`, etc.) + `Loader2`.
        *   **`ERROR`**: If the document fails to hydrate or crashes, the editor completely unmounts. Renders a read-only error state: "Failed to load document" + "Reload Window" button to protect remote CRDT data from empty overwrites.
        *   **`READY` / `DIRTY` / `SYNCING`**: Only in these states is the `EditorContent` active. No autosave can fire before `READY`.

### 4.5 Tasks (`/tasks`)
*   **Header**: "Tasks" + "List" or "Board" view toggles (`bg-white/10 text-white shadow-lg` when active). "Add Task" blue button (`bg-blue-600 rounded-full h-9 px-5 hover:scale-[1.02]`).
*   **Search/Filter Bar**: `Input` `pl-10 h-10 border-white/5 bg-white/[0.03]`. Filter button with badge counting total items.
*   **Tabs**: `To Do`, `In Progress`, `Completed`. Tab triggers use `border-b-2 data-[state=active]:border-blue-500`.
*   **List View Render**:
    *   Grid cols: `1fr_140px_120px_140px_40px` (Title, Project, Priority, Due Date, Action).
    *   Row styles: `hover:bg-white/[0.03] transition-all`.
    *   Priorities styled with arrows: High (`ArrowUp`), Medium (`Minus`), Low (`ArrowDown`).

### 4.6 Folders (`/folders`)
*   **Header**: "Folders" + "New Folder" dialog button.
*   **Search/Sort**: Sort dropdown menu allowing asc/desc sorting by Name, Date, Size.
*   **List Render**:
    *   Grid columns for Folder Name (with colored `Folder` icon), Description, and Created At.
    *   Row expansion: Clicking a row expands an indented list (`ml-9 border-l-2 border-white/5`) of all notes assigned to that `folder_id`.
*   **Create/Edit Dialog**:
    *   `sm:max-w-[480px] p-6 bg-[#101011] rounded-[28px] shadow-[0_24px_50px_rgba(0,0,0,0.5)]`.
    *   Inputs: Name, Description textarea, Status toggles (On-track, At-risk, Overdue), Theme Color picker (circular buttons, selected is `scale-110 ring-2 ring-white ring-offset-[#101011]`).

### 4.7 Modals & Dialogs (Global)
*   **Quick Create Modal**: Centralized modal (`Cmd+K` or "Add" buttons) with tabs to create Tasks, Notes, or Events.
*   **Search Command (Spotlight)**: Blurred overlay, `Search` icon left aligned, auto-focuses to let users quickly type and search across notes and tasks globally.
