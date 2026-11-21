English | [日本語](README.md)

# forestMind 🌲

A modern **FreeMind 1.0.1 compatible** mind map editor. Running both in the browser and as an **Electron desktop app**, it lets you manage, search, and link multiple maps as a "Forest", and replay the growth of your ideas with sound and animation via **Presentation Mode**.

> [!NOTE]
> The application UI is currently available in **Japanese only**.

- Built with React 19 + TypeScript + Vite (with Electron packaging for Windows desktop)
- Web version stores data locally in `localStorage` without any server; Desktop version reads and writes local `.mm` files directly
- Full round-trip compatibility with existing FreeMind / Freeplane `.mm` files (including `.mm` file association)

---

## ✨ Key Features

### 📝 Mind Map Editing

- Auto-balanced left/right layout around the root node with smooth Bezier branch rendering
- Keyboard-first fast node creation, editing, and navigation ([Keyboard Shortcuts](#️-keyboard-shortcuts))
- **Copy / Cut / Paste** (`Ctrl+C` / `Ctrl+X` / `Ctrl+V`): supports internal subtree cloning as well as pasting external Markdown bullet lists directly into a tree
- **Quick Duplicate** (`Ctrl+D`): clone the selected subtree right below itself
- **Keyboard Reordering** (`Alt+↑` / `Alt+↓`): reorder sibling nodes without touching the mouse
- **Drag & Drop Visual Guide**: highlights the drop target with a badge and glow to prevent mistakes
- **Dark Theme**: one-click toggle between light and dark modes from the toolbar (🌙 / ☀️)
- **Interactive Minimap & Fit to Screen (`Ctrl+0`)**: overview minimap in the bottom-right corner with click/drag navigation and one-key fit-to-screen
- **Note Popover**: hover or click note icons to preview HTML / simple Markdown notes, with quick edit and delete actions
- **Unsaved Indicator (`*`) & Close Confirmation**: marks dirty tabs with `*` and prompts to save before closing tabs or exiting the app
- **Smooth New-Node Editing**: editing a newly created placeholder node automatically clears the default text (and pressing `Esc` right after creating a node deletes it and cancels cleanly)
- **Desktop Direct File I/O**: `Ctrl+S` to save / save-as, remembers the last-used folder in Open/Save dialogs, and opens `.mm` files on double-click from Explorer into tabs
- Expand / collapse, expand all / collapse all, Undo / Redo, infinite canvas panning & zooming (25%–300%), and in-map keyword search

### 🎨 Node Properties Panel

Edit details of the selected node in the right-side inspector:

| Property | Description |
| --- | --- |
| Text | Node label |
| Style | Text color, background color, font size, bold / italic |
| Link | URL or local `.mm` / `.md` file path (relative path picker via `.mm参照` in Desktop) |
| Note | Detailed note attached to the node (with popover preview) |
| Cloud | Trapezoidal / convex cloud enclosure around a subtree |
| Arrow Links | Cross-node relationship arrows |
| Icons | Built-in FreeMind icons (✅ ❌ 🚩 ⭐ 💡 🚀 ✏️ 🌲 📁 ❓ 🔖 📎, etc.) |
| Attributes | Arbitrary Key-Value pairs |

### 🌳 Multi-Tab & Forest View

- Edit multiple mind maps simultaneously in tabs
- **Forest View** to overview all open maps:
  - Node count, max depth, and main topic preview for each map
  - Cross-tab keyword search with direct jump to matching nodes

### ▶️ Presentation Mode (Thought Replay)

Replay how your mind map grew node-by-node with animation. Press `F5` to start/stop.

- **3 Playback Orders**:
  - **Topic Order**: depth-first traversal
  - **Level Order**: breadth-first traversal
  - **Chronological Order**: sorted by node `CREATED` timestamp
- **Cinema Fullscreen (`F`)**: fades out toolbars and tabs for distraction-free presenting
- **Spotlight (`L`)**: highlights the active path from root to current node while dimming other branches
- **Smart Auto-Center (`C`)**: smoothly frames the newly revealed node and its parent
- **Playback Speed**: 0.5s / 1s / 2s / 3.5s / 5s per step, plus seek bar
- **Bubble Pop Sound (`M`)**: synthesized via Web Audio API (no external audio files), ascending along a pentatonic scale by node depth

### 🔍 FreeMindSearcher (Local Folder Search)

Scan a local folder recursively to search across `.mm` files:

- Recursive folder scan (via File System Access API, with fallback folder picker)
- Case-insensitive keyword search with automatic numeric character reference decoding
- Breadcrumb path display (`Parent > Child > Target`)
- Filter by modified date range and icons
- Sort results, double-click to open the map and jump directly to the node
- Export search results to CSV (UTF-8 with BOM for Excel)

### 💾 Import / Export

| Format | Import | Export | Notes |
| --- | :---: | :---: | --- |
| FreeMind (`.mm`) | ✅ | ✅ | Round-trips hierarchy, colors, styles, fonts, icons, links, notes, attributes, clouds, and arrow links |
| Markdown (`.md`) | ✅ | ✅ | Builds hierarchy from `#` headings and indented `-` / `*` / `+` lists |
| SVG (`.svg`) | — | ✅ | Exports current mind map as vector graphics |
| PNG (`.png`) | — | ✅ | Exports current mind map as a high-resolution raster image |

> [!NOTE]
> `.mm` export encodes non-ASCII characters as hexadecimal numeric character references (`&#xXXXX;`), matching FreeMind 1.0.1 for clean compatibility with FreeMind / Freeplane.

---

## ⌨️ Keyboard Shortcuts

### Node Creation & Editing

| Shortcut | Action |
| --- | --- |
| `Tab` / `Insert` | Add child node |
| `Enter` | Add sibling node |
| `Ctrl` + `C` / `X` / `V` | Copy / Cut / Paste (Markdown supported) |
| `Ctrl` + `D` | Duplicate selected node |
| `Alt` + `↑` / `↓` | Move sibling node up / down |
| `F2` / Double-click | Inline text edit |
| `Esc` (right after creation) | Delete newly created node and cancel |
| `Delete` / `Backspace` | Delete selected node |
| Drag & Drop | Reparent node |

### Navigation & View

| Shortcut | Action |
| --- | --- |
| `↑` / `↓` | Move between sibling nodes |
| `→` / `←` | Move to child / parent node |
| `Space` | Fold / unfold node |
| `Ctrl` + `0` | Fit map to screen |
| `Ctrl` + `S` | Save / Save As (Desktop) |
| Drag background | Pan canvas |
| Mouse wheel | Zoom in / out |

### History & Search

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `Z` / `Ctrl` + `Y` | Undo / Redo |
| `Ctrl` + `F` | Focus in-map search |
| `Enter` / `Shift` + `Enter` | Jump to next / previous match |

### Presentation Mode

| Shortcut | Action |
| --- | --- |
| `F5` | Start / stop presentation |
| `Space` | Play / pause |
| `→` / `↓` | Next step |
| `←` / `↑` | Previous step |
| `Home` | Jump to first step |
| `F` | Toggle cinema fullscreen |
| `L` | Toggle spotlight |
| `C` | Toggle auto-center |
| `M` | Mute / unmute sound |
| `Esc` | Exit presentation / fullscreen |

---

## 🚀 Setup

### Prerequisites

- Node.js 18+ (20 LTS+ recommended)
- Modern browser (Chrome / Edge recommended)

### Install & Run

```bash
# Install dependencies
npm install

# Start web dev server
npm run dev
```

> [!TIP]
> On Windows PowerShell, if script execution policy blocks `npm`, use `npm.cmd` instead (e.g. `npm.cmd run dev`).

### Available Scripts

| Command | Description |
| --- | --- |
| `npm test` | Run unit tests (Vitest) |
| `npm run build` | Type-check and build production bundle (`dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint static analysis |
| `npm run electron:dev` | Launch Electron desktop app in dev mode |
| `npm run electron:start` | Build and launch Electron desktop app |
| `npm run electron:build` | Build Windows NSIS installer and portable executable into `release/` |

---

## 🛠 Tech Stack

- [React 19](https://react.dev/) / [TypeScript 5.7](https://www.typescriptlang.org/)
- [Vite 6](https://vite.dev/)
- [Electron 45](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/)
- [Vitest 5](https://vitest.dev/) + [happy-dom](https://github.com/capricorn86/happy-dom)
- [ESLint 9](https://eslint.org/) + typescript-eslint + eslint-plugin-react-hooks
- [lucide-react](https://lucide.dev/)
- Web Audio API, File System Access API

## 📄 License

[MIT License](LICENSE)
