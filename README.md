# confluence-beautiful-mermaid

Render [Mermaid](https://mermaid.js.org/) diagrams in **Atlassian Confluence Server / Data Center** using a lightweight **User Macro** and [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid).

No Java plugin required. Authors insert a macro; admins host the static JS files plus the macro icon, and load `beautiful-mermaid.init.js` once via **Custom HTML**.

## Features

- **User Macro only** — no Atlassian Plugin SDK or JAR deployment
- **No `<script>` in the macro** — Confluence would split the editor if the macro output contains script tags
- **Lazy loading** — `beautiful-mermaid.init.js` loads `beautiful-mermaid.bundle.js` once per page
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
dist/beautiful-mermaid.init.js
dist/beautiful-mermaid.icon.png
```

Upload all three files to your internal static server, e.g.:

```
https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.bundle.js
https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.init.js
https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.icon.png
```

Ensure `.js` files are served with `Content-Type: application/javascript`.

### 2. Create the User Macro

**Confluence Administration → User Macros → Create User Macro**

| Setting | Value |
|---------|-------|
| Macro name | `beautiful-mermaid-confluence` |
| Macro title | Mermaid Diagram |
| Icon URL | hosted `dist/beautiful-mermaid.icon.png`, e.g. `https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.icon.png` |
| Documentation URL | `https://github.com/WindieChai/confluence-beautiful-mermaid` |
| Macro body | Has body |
| Body processing | **Unrendered** |
| Output | **HTML** |
| Template | Copy from [`macro/beautiful-mermaid-confluence.vm`](macro/beautiful-mermaid-confluence.vm) |

**Do not add `<script>` tags to the user macro.** Even an empty `<script>` or one with a dummy `src` makes Confluence open a split editor (edit on the left, preview on the right) when you click Edit.

### 3. Configure Custom HTML

**Confluence Administration → Custom HTML → At end of the BODY:**

```html
<script>window.beautifulMermaidBundleUrl = 'https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.bundle.js';</script>
<script src="https://static.example.com/confluence-beautiful-mermaid/beautiful-mermaid.init.js"></script>
```

Do **not** paste the user-macro template into Custom HTML. Custom HTML is not Velocity: `$body` would appear literally and the renderer would try to parse it as Mermaid.

Set the bundle URL **before** loading init. Append `?v=` yourself if you need cache busting.

### 4. Authors use the macro

1. Edit a Confluence page
2. **Insert → Other Macros** → search **Mermaid Diagram**
3. Paste Mermaid source code
4. Save

Wiki markup:

```text
{beautiful-mermaid-confluence}
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
{beautiful-mermaid-confluence}
```

Dark theme:

```text
{beautiful-mermaid-confluence:theme=dark}
graph LR
  A --> B
{beautiful-mermaid-confluence}
```

## Architecture

```
User Macro (no <script> tags)
  └── <div class="beautiful-mermaid-confluence">
        └── <pre class="bm-source">…mermaid source…</pre>

Custom HTML (end of BODY)
  ├── <script>window.beautifulMermaidBundleUrl = '…/beautiful-mermaid.bundle.js'</script>
  └── <script src="beautiful-mermaid.init.js">

beautiful-mermaid.init.js (idempotent)
  ├── no-op unless `.beautiful-mermaid-confluence` exists
  ├── skip loading bundle if BeautifulMermaid is already on window
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
