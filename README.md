# confluence-beautiful-mermaid

Render [Mermaid](https://mermaid.js.org/) diagrams in **Atlassian Confluence Server / Data Center** using a lightweight **User Macro** and [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid).

No Java plugin required. Authors insert a macro; admins host two static JS files on an internal server.

## Features

- **User Macro only** — no Atlassian Plugin SDK or JAR deployment
- **Lazy loading** — `mermaid-init.js` loads `beautiful-mermaid.bundle.js` once per page
- **Idempotent** — global bootstrap + per-diagram `data-state` (`pending` → `rendering` → `rendered`)
- **Synchronous SVG rendering** — fast, no flash
- **Light / dark theme** — macro parameter `theme=light|dark`

### Supported diagram types

Flowchart, state diagram, sequence diagram, class diagram, ER diagram, and XY chart (via `beautiful-mermaid`).

Not supported: C4, Gantt, pie, mindmap, and other mermaid.js-only types.

## Quick start (admin)

### 1. Build static assets

```bash
npm install
npm run build
```

Output:

```
dist/beautiful-mermaid.bundle.js
dist/mermaid-init.js
```

Upload both files to your internal static server, e.g.:

```
https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.bundle.js
https://static.example.com/confluence-beautiful-mermaid/mermaid-init.js
```

Ensure `.js` files are served with `Content-Type: application/javascript`.

### 2. Create the User Macro

**Confluence Administration → User Macros → Create User Macro**

| Setting | Value |
|---------|-------|
| Macro name | `mermaid` |
| Macro title | Mermaid Diagram |
| Macro body | Has body |
| Body processing | **Unrendered** |
| Output | **HTML** |
| Template | Copy from [`macro/mermaid.vm`](macro/mermaid.vm) |

Replace `INIT_JS_URL` in the template with your hosted `mermaid-init.js` URL.

**Optional:** If `init.js` and the bundle are in the same directory, you can omit `window.__bmConfluenceBaseUrl` — the init script resolves the bundle URL relative to itself.

Otherwise, add before the init script tag:

```html
<script>window.__bmConfluenceBaseUrl = 'https://static.example.com/confluence-beautiful-mermaid';</script>
```

### 3. Authors use the macro

1. Edit a Confluence page
2. **Insert → Other Macros** → search **Mermaid Diagram**
3. Paste Mermaid source code
4. Save

Wiki markup:

```text
{mermaid}
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
{mermaid}
```

Dark theme:

```text
{mermaid:theme=dark}
graph LR
  A --> B
{mermaid}
```

## Architecture

```
User Macro (Velocity)
  └── <div class="bm-mermaid-diagram" data-state="pending">
        └── <pre class="bm-source">…mermaid source…</pre>
  └── <script src="mermaid-init.js">

mermaid-init.js (idempotent)
  ├── load beautiful-mermaid.bundle.js once (Promise cache)
  ├── scan [data-state="pending"]
  ├── render → data-state="rendered"
  └── on error → data-state="error"
```

## Development

```bash
npm install
npm run build
```

Edit `src/init.js`, then rebuild. Commit updated `dist/` if you want GitHub raw URLs to stay current.

## Limitations

- **PDF / Word export** — client-side rendering may not appear in exported documents (common Confluence limitation)
- **Diagram types** — limited to beautiful-mermaid (6 types)
- **Confluence Cloud** — User Macros work differently; this project targets **Server / Data Center 6.x+**
- **Security** — only Confluence administrators should create/edit User Macros

## License

MIT — see [LICENSE](LICENSE).

Uses [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) (MIT).

## Related

- [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) — rendering engine
- [streamdown](https://github.com/vercel/streamdown) — how Cursor integrates Mermaid in chat (different stack)
