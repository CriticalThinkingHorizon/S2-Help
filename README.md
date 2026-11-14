# Switch 2 Hacking Info

A realtime questionnaire that tells Nintendo Switch 2 owners whether their current setup (game + payload state) is ready to run payloads, plus a searchable FAQ and a curated list of community resources.

The project is a small Express + Socket.IO server that serves a static, dependency-free frontend. FAQ questions are re-ordered live based on how often visitors open them.

Live deployment: <https://s2-help.wasmer.app/>

## Features

- **Guided questionnaire** — pick the exploit game you own, answer a follow-up question, and get a `READY`, `ALMOST READY`, or `NOT YET` result with context and related links.
- **Searchable FAQ** — accordion-style questions with deep links (`#faq-…`), permalink copying, and full-text search.
- **Live popularity sorting** — an open FAQ emits `faq:open` over Socket.IO; the server increments a counter and broadcasts updated stats to every connected client, which re-sorts the list.
- **Resources directory** — grouped community guides and exploit repositories.
- **Quick Tutorials** — step-by-step guides, including how to install and start native homebrew with kaiHEN.
- **Kernel Exploit minigame** — a CRT-styled browser minigame with keyboard, mouse, and touch controls, three difficulty modes (FS, KERNEL, BOOTROM), power-ups, progress checkpoints, and escalating difficulty.
- **Hash-based routing** — `#quiz`, `#faq`, `#resources`, or a specific `#faq-<slug>` are all shareable and survive reloads.
- **Persistent stats** — counters are stored in a JSON file (debounced writes) so they survive restarts.

## Tech Stack

- **Runtime:** Node.js >= 18
- **Server:** Express 4, Socket.IO 4
- **Frontend:** Vanilla ES modules, HTML, CSS (no build step)
- **Deployment:** Wasmer Edge (see `app.yaml`), with a GitHub Actions workflow

## Project Structure

```
.
├── server.js                  # Entry point: HTTP/HTTPS server + Socket.IO bootstrap
├── src/
│   ├── app.js                 # Express app: routes, static files, SPA fallback
│   ├── config/index.js        # Env parsing, paths, TLS config
│   ├── routes/
│   │   ├── index.js           # Root router
│   │   └── health.routes.js   # GET /health
│   ├── services/
│   │   └── faqStats.service.js# Load/persist FAQ counters (debounced)
│   └── sockets/
│       └── faqStats.socket.js # Socket.IO event handlers
├── public/
│   ├── index.html             # Single-page app shell
│   ├── assets/
│   │   ├── css/styles.css
│   │   └── js/                # main, navigation, quiz, faq, resources, kernel-game, stats, utils
│   └── data/
│       ├── quiz.json          # Questionnaire flow and results
│       ├── faq.json           # Questions and answers
│       ├── tutorials.json     # Quick tutorial guides
│       ├── resources.json     # Grouped resource links
│       └── game-resources.json# Per-game related links
├── data/faq-stats.json        # Persisted FAQ open counters (runtime)
├── app.yaml                   # Wasmer Edge deployment manifest
├── Anybuild                   # Anybuild/Wasmer build configuration
└── .github/workflows/deploy-wasmer.yml
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm

### Install and run

```bash
npm install
npm start
```

The app is served at <http://localhost:8080> by default.

For development with automatic restarts on file changes:

```bash
npm run dev
```

## Configuration

Configuration is read from environment variables (see `.env.example`). No `.env` file is loaded automatically; export the variables or use your process manager / hosting provider's environment settings.

| Variable        | Default                                             | Description                                                                 |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| `PORT`          | `8080`                                              | HTTP/HTTPS port to listen on.                                               |
| `NODE_ENV`      | `development`                                       | Environment name.                                                           |
| `TLS_ENABLED`   | auto                                                | `true` / `false` to force TLS. If unset, TLS is enabled when both cert files exist. |
| `TLS_KEY_PATH`  | `/etc/letsencrypt/live/general/privkey.pem`         | TLS private key path.                                                       |
| `TLS_CERT_PATH` | `/etc/letsencrypt/live/general/fullchain.pem`       | TLS certificate (fullchain) path.                                           |
| `DATA_DIR`      | `./data`                                            | Directory where `faq-stats.json` is read from and written to.               |

The server automatically uses HTTPS when TLS is enabled, otherwise plain HTTP.

## API

### HTTP

| Method | Path      | Description                                                  |
| ------ | --------- | ------------------------------------------------------------ |
| `GET`  | `/health` | Returns `{ "ok": true, "faqCount": <number> }`.              |
| `GET`  | `*`       | Serves the static frontend; unknown paths fall back to `index.html`. |

### Socket.IO events

| Direction       | Event       | Payload                     | Description                                              |
| --------------- | ----------- | --------------------------- | -------------------------------------------------------- |
| server → client | `faq:stats` | `{ [faqId]: count }`        | Sent on connect and after every increment.               |
| client → server | `faq:open`  | `{ userId, faqId }`         | Increments the open counter for a question.              |

The frontend attempts to connect via Socket.IO on the page's origin first, then on the same host at port `4443`. Stats are optional: if the connection fails, the FAQ still works and simply is not re-sorted.

## Data Files

All content is static JSON under `public/data/` and can be edited without touching code:

- **`quiz.json`** — `stepTitle`, `footnote`, `possibilities`, and a `games` array. Each game defines its label, a follow-up question, `yesOutcome` (`success` | `wait`), an optional `payloadStatus`, and the `missingTitle`/`missingText` shown when the answer is "No". Include an entry with id `none` to handle "I don't have any of these".
- **`faq.json`** — array of `{ "q": "...", "a": "..." }`. Answers are rendered as HTML. Question IDs are derived by slugifying `q` into `faq-<slug>`.
- **`tutorials.json`** — array of `{ id, title, tag?, intro?, sections, note? }` tutorials. Each section has a `title` and a list of `{ text, code? }` steps.
- **`resources.json`** — array of `{ title, items: [{ id, title, desc?, notes?, url }] }` groups. Each item needs a unique `id` so it can be linked from the questionnaire.
- **`game-resources.json`** — map of game id → array of related links. Each entry can be a resource `id` string to reuse an item from `resources.json`, or an object `{ id, notes?, title? }` to reference an item while overriding its `notes`/`title`. Inline `{ title, url, notes? }` objects are still supported.

`data/faq-stats.json` is managed by the server at runtime and is git-ignored.

## Native Homebrew (kaiHEN)

The Quick Tutorials section includes a guide for installing and starting [kaiHEN](https://github.com/ouncebrew/kaihen), a homebrew environment and minimal custom firmware for Switch 2. The Resources section links it alongside [ounce-devkit](https://github.com/ouncebrew/ounce-devkit) for building native homebrew.

kaiHEN still requires an existing entrypoint and an acquisition tool to start; the currently documented path is ns2jb's `hen.cjs`. Its files are staged by the tool, not copied to the SD card manually. It gives homebrew full access to the system and NAND, so only run homebrew you trust.

## Deployment

### Wasmer Edge

The app is deployed to Wasmer Edge as `s2-help`. `app.yaml` sets `DATA_DIR=/tmp/readys2-data` (ephemeral storage in the edge runtime) and configures the Node provider via Anybuild.

Pushing to `main` triggers `.github/workflows/deploy-wasmer.yml`, which installs the Wasmer CLI and runs:

```bash
wasmer deploy --non-interactive --build-remote \
  --owner ferreirapablo --app-name s2-help --dir .
```

A repository secret named `WASMER_TOKEN` is required. You can also deploy manually with the same command after authenticating via `wasmer login`.

> Note: on Wasmer Edge `data/` is ephemeral, so FAQ counters reset when the instance is recycled. Run with a persistent `DATA_DIR` if you need long-lived stats.

### Self-hosting / VPS

```bash
npm install --omit=dev
PORT=8080 DATA_DIR=/var/lib/readys2 npm start
```

Put a reverse proxy (nginx, Caddy, etc.) in front of it for TLS termination, or point `TLS_ENABLED=true` at your certificate paths to have Node handle TLS directly.

## License

The source code is licensed under the MIT License (see `LICENSE`). Third-party
notices are listed in `THIRD_PARTY_NOTICES.md`. Written content is provided for
personal, non-commercial reference. This project is not affiliated with,
endorsed, or sponsored by Nintendo. Verify everything independently before
attempting anything on your console.
