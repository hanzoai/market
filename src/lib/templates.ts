// Canonical Hanzo OSS Templates catalog (59+ production templates)
export interface TemplateEntry {
  slug: string
  title: string
  category: string
  description: string
  github?: string
  preview?: string
}

export const TEMPLATES: TemplateEntry[] = [
  {
    "slug": "synapse",
    "title": "Synapse",
    "category": "AI/SaaS",
    "description": "AI chat workspace — conversation lists, prompt composer, subscription and settings screens.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/synapse",
    "preview": "https://synapse.hanzo.ai"
  },
  {
    "slug": "blocks",
    "title": "Blocks",
    "category": "Bento Cards",
    "description": "Bento card grid in four layouts (default, square, horizontal, background) for SaaS feature sections.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/blocks",
    "preview": "https://blocks.hanzo.ai"
  },
  {
    "slug": "cipher",
    "title": "Cipher",
    "category": "Bento Cards",
    "description": "Bento card grid for crypto products — wallet keys, exchange and blockchain explainer cards.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/cipher",
    "preview": "https://cipher.hanzo.ai"
  },
  {
    "slug": "deploy",
    "title": "Deploy",
    "category": "Bento Cards",
    "description": "Bento list cards — grouped task lists with per-card icon, colour and duplicate/delete.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/deploy",
    "preview": "https://deploy.hanzo.ai"
  },
  {
    "slug": "matrix",
    "title": "Matrix",
    "category": "Bento Cards",
    "description": "Bento card grid on a binary-rain theme, in four layouts.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/matrix",
    "preview": "https://matrix.hanzo.ai"
  },
  {
    "slug": "mosaic",
    "title": "Mosaic",
    "category": "Bento Cards",
    "description": "Bento card grid for component and analytics products, in four layouts.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/mosaic",
    "preview": "https://mosaic.hanzo.ai"
  },
  {
    "slug": "blog-platform",
    "title": "Blog Platform",
    "category": "Blog",
    "description": "Blog on @hanzo/ui — tag filters, post list and a writing view.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/blog-platform",
    "preview": "https://blog-platform.hanzo.ai"
  },
  {
    "slug": "changelog",
    "title": "Changelog",
    "category": "Blog",
    "description": "Product changelog — dated releases with tags, a version timeline and dark mode.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/changelog",
    "preview": "https://changelog.hanzo.ai"
  },
  {
    "slug": "drive",
    "title": "Drive",
    "category": "Business",
    "description": "Electric-vehicle marketing site — models, technology, news and ordering.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/drive",
    "preview": "https://drive.hanzo.ai"
  },
  {
    "slug": "soar",
    "title": "Soar",
    "category": "Business",
    "description": "Web-studio landing page — services, team and work, with a contact call-to-action.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/soar",
    "preview": "https://soar.hanzo.ai"
  },
  {
    "slug": "analytics-dashboard",
    "title": "Analytics Dashboard",
    "category": "Dashboard",
    "description": "Analytics dashboard on @hanzo/ui — revenue, users and sales tiles over an overview chart.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/analytics-dashboard",
    "preview": "https://analytics-dashboard.hanzo.ai"
  },
  {
    "slug": "beta",
    "title": "Beta",
    "category": "Dashboard",
    "description": "Admin dashboard — projects, tasks, kanban, calendar, contacts, invoices and a file browser.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/beta",
    "preview": "https://beta.hanzo.ai"
  },
  {
    "slug": "metrics",
    "title": "Metrics",
    "category": "Dashboard",
    "description": "Admin dashboard — sales, purchases and returns over a leaderboard, product list and transaction history.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/metrics",
    "preview": "https://metrics.hanzo.ai"
  },
  {
    "slug": "unity",
    "title": "Unity",
    "category": "Dashboard",
    "description": "Creator admin app — products, campaigns, schedules, payouts, statements and insights.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/unity",
    "preview": "https://unity.hanzo.ai"
  },
  {
    "slug": "desktop-chat",
    "title": "Chat",
    "category": "Desktop",
    "description": "Desktop AI client — streaming SSE to any OpenAI-compatible gateway, threads and API key kept in the OS config dir, not web storage.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-chat",
    "preview": "https://desktop-chat.hanzo.ai"
  },
  {
    "slug": "desktop-editor",
    "title": "Editor",
    "category": "Desktop",
    "description": "CodeMirror 6 code editor in a Tauri window — real filesystem tree, syntax highlighting, native folder picker, Cmd-S writes through.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-editor",
    "preview": "https://desktop-editor.hanzo.ai"
  },
  {
    "slug": "desktop-electron",
    "title": "Electron",
    "category": "Desktop",
    "description": "Electron 43 + Forge + Vite + React baseline — contextIsolated IPC allowlist, native dialogs, app metrics, frameless chrome.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-electron",
    "preview": "https://desktop-electron.hanzo.ai"
  },
  {
    "slug": "desktop-tauri",
    "title": "Hanzo Desktop",
    "category": "Desktop",
    "description": "Tauri v2 + React 19 desktop starter — Rust command round-trip, Hanzo Base backend, frameless chrome, one web preview build.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-tauri",
    "preview": "https://desktop-tauri.hanzo.ai"
  },
  {
    "slug": "desktop-monitor",
    "title": "Monitor",
    "category": "Desktop",
    "description": "Native system monitor — per-core CPU, memory, process table, disks and interfaces via sysinfo, sampled at 1 Hz.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-monitor",
    "preview": "https://desktop-monitor.hanzo.ai"
  },
  {
    "slug": "desktop-notes",
    "title": "Notes",
    "category": "Desktop",
    "description": "Local-first markdown notes — one .md file per note in the OS app-data dir, split editor/preview, autosave, optional Base sync.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-notes",
    "preview": "https://desktop-notes.hanzo.ai"
  },
  {
    "slug": "desktop-recorder",
    "title": "Recorder",
    "category": "Desktop",
    "description": "Screen recorder — desktopCapturer enumerates every screen and window with no OS prompt, MediaRecorder writes webm to disk.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-recorder",
    "preview": "https://desktop-recorder.hanzo.ai"
  },
  {
    "slug": "desktop-tray",
    "title": "Tray",
    "category": "Desktop",
    "description": "Menubar/tray utility — resident clipboard history, global shortcut, close-hides-not-quits, background watcher thread in Rust.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/desktop-tray",
    "preview": "https://desktop-tray.hanzo.ai"
  },
  {
    "slug": "ecommerce-storefront",
    "title": "Ecommerce Storefront",
    "category": "E-commerce",
    "description": "Storefront on @hanzo/ui — category filters, product grid and add-to-cart.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/ecommerce-storefront",
    "preview": "https://ecommerce-storefront.hanzo.ai"
  },
  {
    "slug": "hygge",
    "title": "Hygge",
    "category": "E-commerce",
    "description": "Skincare storefront — category browsing, product pages and a slide-out cart.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/hygge",
    "preview": "https://hygge.hanzo.ai"
  },
  {
    "slug": "savor",
    "title": "Savor",
    "category": "E-commerce",
    "description": "Food-delivery storefront — menu, favourites and cart over a restaurant home page.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/savor",
    "preview": "https://savor.hanzo.ai"
  },
  {
    "slug": "voxel-craft",
    "title": "Chunk",
    "category": "Games/3D",
    "description": "First-person voxel sandbox: procedural terrain, face-culled chunk meshing, place/break editing that re-meshes only what changed.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/voxel-craft",
    "preview": "https://voxel-craft.hanzo.ai"
  },
  {
    "slug": "kart-racer",
    "title": "Circuit",
    "category": "Games/3D",
    "description": "A drivable arcade racer where one Catmull-Rom track curve drives the road mesh, the on-track test, the lap checkpoints and the autopilot line.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/kart-racer",
    "preview": "https://kart-racer.hanzo.ai"
  },
  {
    "slug": "rapier-physics",
    "title": "Fracture Yard",
    "category": "Games/3D",
    "description": "Rigid-body sandbox where Rapier3D (Rust compiled to WASM) owns the simulation and three.js only draws it.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/rapier-physics",
    "preview": "https://rapier-physics.hanzo.ai"
  },
  {
    "slug": "three-webgpu",
    "title": "Neon Reef",
    "category": "Games/3D",
    "description": "WebGPU-first Three.js scene with automatic WebGL2 fallback: TSL node materials and 900 instanced shards in one draw call.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/three-webgpu",
    "preview": "https://three-webgpu.hanzo.ai"
  },
  {
    "slug": "godot-arcade",
    "title": "Orb Runner",
    "category": "Games/3D",
    "description": "A complete 3D arcade game in ~150 lines of GDScript, exported to WebAssembly by Godot 4.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/godot-arcade",
    "preview": "https://godot-arcade.hanzo.ai"
  },
  {
    "slug": "unity-webgl",
    "title": "Unity WebGL",
    "category": "Games/3D",
    "description": "A real Unity WebGL build served cross-origin-isolated, so SharedArrayBuffer is available to multithreaded builds.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/unity-webgl",
    "preview": "https://unity-webgl.hanzo.ai"
  },
  {
    "slug": "oasis",
    "title": "Oasis",
    "category": "Hospitality",
    "description": "Resort site — accommodation, dining, spa, weddings and tour booking, in four languages.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/oasis",
    "preview": "https://oasis.hanzo.ai"
  },
  {
    "slug": "construct",
    "title": "Construct",
    "category": "Landing",
    "description": "App landing page — feature tour, screenshots and a download call-to-action.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/construct",
    "preview": "https://construct.hanzo.ai"
  },
  {
    "slug": "serif",
    "title": "Serif",
    "category": "Magazine",
    "description": "Editorial magazine — section fronts, article pages and a shop in a serif type system.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/serif",
    "preview": "https://serif.hanzo.ai"
  },
  {
    "slug": "video-streaming",
    "title": "Video Streaming",
    "category": "Media",
    "description": "Video watch page on @hanzo/ui — player, chapters, transcript and channel subscribe.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/video-streaming",
    "preview": "https://video-streaming.hanzo.ai"
  },
  {
    "slug": "expo-auth",
    "title": "Hanzo Auth",
    "category": "Mobile",
    "description": "OAuth 2.0 + PKCE sign-in against Hanzo IAM in the system browser, with a one-place route guard.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/expo-auth",
    "preview": "https://expo-auth.hanzo.ai"
  },
  {
    "slug": "expo-chat",
    "title": "Hanzo Chat (Expo)",
    "category": "Mobile",
    "description": "Streaming AI chat client on Expo Router, wired to the Hanzo /v1 API with run-time endpoint config.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/expo-chat",
    "preview": "https://expo-chat.hanzo.ai"
  },
  {
    "slug": "flutter-chat",
    "title": "Hanzo Chat (Flutter)",
    "category": "Mobile",
    "description": "Streaming AI chat in Flutter, wired to the Hanzo /v1 API, with tests over the failure path.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/flutter-chat",
    "preview": "https://flutter-chat.hanzo.ai"
  },
  {
    "slug": "flutter",
    "title": "Hanzo Flutter",
    "category": "Mobile",
    "description": "Material 3 starter — NavigationBar over an IndexedStack, search, detail route and widget tests.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/flutter",
    "preview": "https://flutter.hanzo.ai"
  },
  {
    "slug": "mobile",
    "title": "Hanzo Mobile",
    "category": "Mobile",
    "description": "Expo Router tab starter — iOS, Android and web from one tree. Feed, search, settings and a dynamic detail route.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/mobile",
    "preview": "https://mobile.hanzo.ai"
  },
  {
    "slug": "expo-shop",
    "title": "Hanzo Shop",
    "category": "Mobile",
    "description": "Storefront: product grid, detail route and a cart with a live tab badge.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/expo-shop",
    "preview": "https://expo-shop.hanzo.ai"
  },
  {
    "slug": "canvas",
    "title": "Canvas",
    "category": "Portfolio",
    "description": "Personal portfolio — animated name marquee over about, projects and contact.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/canvas",
    "preview": "https://canvas.hanzo.ai"
  },
  {
    "slug": "folio",
    "title": "Folio",
    "category": "Portfolio",
    "description": "Creative portfolio kit — 26 pages of masonry and grid layouts plus agency, designer, developer and photography variants.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/folio",
    "preview": "https://folio.hanzo.ai"
  },
  {
    "slug": "kinetic",
    "title": "Kinetic",
    "category": "Portfolio",
    "description": "Creative portfolio driven by GSAP and smooth scroll — a project reel over case-study pages.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/kinetic",
    "preview": "https://kinetic.hanzo.ai"
  },
  {
    "slug": "mint",
    "title": "Mint",
    "category": "Portfolio",
    "description": "Creative-studio portfolio — work index, about and contact behind a full-screen menu.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/mint",
    "preview": "https://mint.hanzo.ai"
  },
  {
    "slug": "pixel",
    "title": "Pixel",
    "category": "Portfolio",
    "description": "Web-studio portfolio — work, expertise and a playground page.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/pixel",
    "preview": "https://pixel.hanzo.ai"
  },
  {
    "slug": "portfolio",
    "title": "Portfolio",
    "category": "Portfolio",
    "description": "Personal developer portfolio — intro, about, projects and contact on one page.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/portfolio",
    "preview": "https://portfolio.hanzo.ai"
  },
  {
    "slug": "prism",
    "title": "Prism",
    "category": "Portfolio",
    "description": "Creative-agency portfolio built on GSAP — one scroll through work, services and contact.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/prism",
    "preview": "https://prism.hanzo.ai"
  },
  {
    "slug": "studio",
    "title": "Studio",
    "category": "Portfolio",
    "description": "Digital-agency portfolio — expertise, projects and articles behind an animated wordmark.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/studio",
    "preview": "https://studio.hanzo.ai"
  },
  {
    "slug": "vault",
    "title": "Vault",
    "category": "Portfolio",
    "description": "Architecture-studio site — architecture, landscape and interior work with a studio profile.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/vault",
    "preview": "https://vault.hanzo.ai"
  },
  {
    "slug": "kanban-board",
    "title": "Kanban Board",
    "category": "Productivity",
    "description": "Kanban board on @hanzo/ui — To Do / In Progress / Done with labelled, assigned cards.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/kanban-board",
    "preview": "https://kanban-board.hanzo.ai"
  },
  {
    "slug": "markdown-editor",
    "title": "Markdown Editor",
    "category": "Productivity",
    "description": "Markdown editor on @hanzo/ui — live preview, syntax highlighting, copy and export.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/markdown-editor",
    "preview": "https://markdown-editor.hanzo.ai"
  },
  {
    "slug": "forge",
    "title": "Forge",
    "category": "SaaS",
    "description": "SaaS product landing page — feature blocks, pricing, FAQ and light/dark toggle.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/forge",
    "preview": "https://forge.hanzo.ai"
  },
  {
    "slug": "launch",
    "title": "Launch",
    "category": "SaaS",
    "description": "SaaS launch page — waitlist capture, feature tour and pricing.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/launch",
    "preview": "https://launch.hanzo.ai"
  },
  {
    "slug": "saas-landing",
    "title": "SaaS Landing",
    "category": "SaaS",
    "description": "SaaS landing page on @hanzo/ui — hero, feature grid, social proof and pricing.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/saas-landing",
    "preview": "https://saas-landing.hanzo.ai"
  },
  {
    "slug": "solo",
    "title": "Solo",
    "category": "SaaS",
    "description": "Productivity-app landing page — tasks, lists and reminders with pricing and downloads.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/solo",
    "preview": "https://solo.hanzo.ai"
  },
  {
    "slug": "circle",
    "title": "Circle",
    "category": "Social Media",
    "description": "Social platform UI — feed, profile and messaging screens.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/circle",
    "preview": "https://circle.hanzo.ai"
  },
  {
    "slug": "crypto-portfolio",
    "title": "Crypto Portfolio",
    "category": "Web3",
    "description": "Crypto portfolio tracker on @hanzo/ui — holdings, performance and transaction history.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/crypto-portfolio",
    "preview": "https://crypto-portfolio.hanzo.ai"
  },
  {
    "slug": "loop",
    "title": "Loop",
    "category": "Web3",
    "description": "Crypto-card product site — virtual card, NFT and metaverse pages with light and dark blog.",
    "github": "https://github.com/hanzoai/universe/tree/main/templates/apps/loop",
    "preview": "https://loop.hanzo.ai"
  }
];

export function templates({ q = "", category = "", limit = 50, offset = 0 }: { q?: string; category?: string; limit?: number; offset?: number }) {
  let res = TEMPLATES;
  if (q) {
    const term = q.toLowerCase();
    res = res.filter(t => t.title.toLowerCase().includes(term) || t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term) || t.slug.includes(term));
  }
  if (category) {
    res = res.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }
  return {
    templates: res.slice(offset, offset + limit),
    total: res.length,
  };
}
