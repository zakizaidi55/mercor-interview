# AI Mock Interview Platform

An intelligent, real-time mock interview platform that conducts voice-based technical interviews personalized to a candidate's GitHub profile, then automatically evaluates performance using an LLM.

---

## Purpose

This project simulates a real technical interview experience end-to-end:

1. A candidate enters their GitHub profile URL.
2. The system scrapes their public repositories to understand their background.
3. An AI interviewer (powered by OpenAI Realtime API) conducts a live voice interview tailored to the candidate's experience.
4. After the interview ends, an LLM (Llama 3.3 via Groq) evaluates the conversation transcript and returns a score out of 10 along with detailed feedback.

The goal is to give developers a realistic, personalized interview rehearsal experience with zero human involvement.

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Bun** | JavaScript runtime for the backend server |
| **Express.js** | REST API framework |
| **WebSocket (`ws`)** | Side-band connection to the OpenAI Realtime API to capture AI transcripts |
| **OpenAI Realtime API** | Real-time voice-based AI interviewer using WebRTC |
| **Groq (Llama 3.3 70B)** | LLM used to evaluate the interview transcript and generate score + feedback |
| **Prisma ORM** | Database schema management and type-safe queries |
| **PostgreSQL** | Persistent storage for interviews, messages, and results |
| **GitHub REST API** | Scrapes the candidate's public repositories to personalize interview questions |
| **Zod** | Runtime schema validation for API request bodies and LLM outputs |
| **TypeScript** | End-to-end type safety |

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Bun** | Frontend build tooling |
| **React Router v7** | Client-side routing between form, interview, and results pages |
| **WebRTC** | Browser-side peer connection for real-time audio streaming with the AI |
| **Web Audio API** | Real-time volume analysis to animate speaking indicators for both user and AI |
| **Tailwind CSS v4** | Utility-first styling |
| **Radix UI** | Accessible, unstyled component primitives (Label, Select, Slot) |
| **shadcn/ui** | Pre-built component system on top of Radix UI |
| **Sonner** | Toast notification library |
| **Axios** | HTTP client for API calls |
| **TypeScript** | Type safety across the frontend |

### Monorepo / Infrastructure
| Technology | Purpose |
|---|---|
| **Turborepo** | Monorepo build system for managing the `backend` and `frontend` apps |
| **Shared ESLint config** | Consistent linting rules across packages |
| **Shared TypeScript config** | Shared `tsconfig.json` base across the monorepo |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│                                                             │
│  [Form Page] ──> GitHub URL input                           │
│  [Interview Page] ──> WebRTC audio + speaking visualizer    │
│  [Result Page] ──> Score, feedback, and transcript viewer   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                       Backend (Express)                      │
│                                                             │
│  POST /api/v1/pre-interview                                 │
│    └─ Scrapes GitHub → creates Interview record in DB       │
│                                                             │
│  POST /api/v1/session/:interviewId                          │
│    └─ Exchanges WebRTC SDP with OpenAI Realtime API         │
│    └─ Opens side-band WebSocket to capture AI transcript    │
│                                                             │
│  POST /api/v1/session/user/response/:interviewId            │
│    └─ Saves user utterances to the database                 │
│                                                             │
│  GET  /api/v1/result/:interviewId                           │
│    └─ Triggers Groq LLM evaluation → returns score+feedback │
└────────────────────────┬────────────────────────────────────┘
                         │ Prisma ORM
┌────────────────────────▼────────────────────────────────────┐
│                       PostgreSQL                             │
│  Interview { id, githubMetaData, status, score, feedback }  │
│  Message   { id, interviewId, type, message, createdAt }    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

- **GitHub-personalized interviews** — Questions are dynamically tailored based on the candidate's actual public repositories and tech stack.
- **Real-time voice conversation** — Uses OpenAI's Realtime API over WebRTC for a natural, low-latency voice interview experience.
- **Live speaking visualizers** — Web Audio API analyzes microphone and AI audio streams in real time to animate visual speaking indicators.
- **Automated evaluation** — After the interview, the full conversation transcript is sent to Llama 3.3 (via Groq) which returns a structured score and written feedback.
- **Polling-based result delivery** — The result page polls the backend every 5 seconds until the LLM evaluation completes and the status changes to `Done`.
- **Mute/unmute control** — Candidates can mute their microphone at any point during the interview.

---

## Getting Started

### Prerequisites
- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL database running
- API keys for: OpenAI, Groq

### Environment Variables (Backend)

Create `apps/backend/.env`:
```env
OPENAI_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/mercor_interview
```

### Install & Run

```sh
# Install all dependencies
bun install

# Run database migrations
cd apps/backend
bunx prisma migrate dev

# Start backend (from repo root)
bun run dev --filter=backend

# Start frontend (from repo root)
bun run dev --filter=frontend
```

---

## Project Structure

```
mercor-interview/
├── apps/
│   ├── backend/           # Express API server
│   │   ├── index.ts       # Route handlers
│   │   ├── sideBand.ts    # WebSocket connection to OpenAI for transcript capture
│   │   ├── result.ts      # Groq LLM evaluation logic
│   │   ├── scrapers/
│   │   │   └── github.ts  # GitHub repository scraper
│   │   └── prisma/
│   │       └── schema.prisma
│   └── frontned/          # React frontend
│       └── src/
│           ├── components/
│           │   ├── Interview.tsx  # WebRTC + audio visualization
│           │   ├── Result.tsx     # Score display + transcript
│           │   └── ui/Form.tsx    # GitHub URL intake form
│           └── App.tsx            # Router setup
└── packages/
    ├── eslint-config/     # Shared ESLint configuration
    ├── typescript-config/ # Shared tsconfig
    └── ui/                # Shared UI component library
```
bun dlx turbo build
bun exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
bun exec turbo build --filter=docs
bun exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
bun exec turbo dev
bun exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
bun exec turbo dev --filter=web
bun exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
bun exec turbo login
bun exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
bun exec turbo link
bun exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
