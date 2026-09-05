# CodeTraceAI — AI-Powered Repository Intelligence & API Testing Platform

CodeTraceAI statically analyzes Express.js repositories to extract deterministic architectural facts (routes, mounted router prefixes, middleware chains, branches, and database calls), constructs an AST-aligned vector knowledge base for grounded RAG Q&A, and auto-generates deterministic Mermaid.js flowcharts.

---

## Architecture Overview

```
                         [ GitHub Repo / Local Workspace ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
         [ Framework Detection ]                     [ AST Babel Parser ]
        (Express validation/reject)                  (Routes, Mounts, Branches,
                   │                                  DB/HTTP Heuristic Tags)
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
                           [ Cross-Router Prefix Resolver ]
                           (Breadth-first mount propagation)
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      [ Semantic Code Chunker ]                 [ Deterministic Mermaid Generator ]
      (AST functions & routes)                  (Route -> MW -> Branches -> Responses)
                   │                                           │
                   ▼                                           ▼
    [ Embeddings & Atlas Vector / Cosine ]          [ Next.js Interactive Dashboard ]
                   │
                   ▼
     [ Grounded RAG Q&A Engine ]
     (Groq GPT-OSS 120B with citations)
```

---

## Tech Stack (Phase 1)
- **Frontend**: Next.js 14, React 18, Tailwind CSS, TanStack Query, Mermaid.js, Lucide icons.
- **Backend**: Node.js, Express.js.
- **AST Parsing**: Babel Parser (`@babel/parser`, `@babel/traverse`, `@babel/types`).
- **Database**: MongoDB (Mongoose) with automatic `mongodb-memory-server` fallback for zero-dependency local dev.
- **Vector Search**: MongoDB Atlas Vector Search with exact in-memory cosine similarity fallback.
- **Embeddings**: `@xenova/transformers` (`all-MiniLM-L6-v2`) with deterministic semantic hashing fallback.
- **LLM**: Groq API (`openai/gpt-oss-120b`) behind an isolated, rate-throttled service with backoff.

---

## Quickstart Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **npm** v9+
- **Git**

### 2. Environment Setup (Optional)
The backend runs completely out of the box with zero external configuration using an embedded in-memory MongoDB server. To connect live Groq LLM reasoning or MongoDB Atlas:
Edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=             # Optional: MongoDB connection string (leave empty for memory server)
GROQ_API_KEY=            # Optional: Groq API key (model: openai/gpt-oss-120b)
GROQ_MODEL=openai/gpt-oss-120b
FRONTEND_URL=http://localhost:3000
```

### 3. Install All Dependencies
```bash
npm run install:all
```

### 4. Run Automated Tests
```bash
npm run test:backend
```
Runs the full unit and integration test suite covering Express detection, AST route extraction, cross-file router prefix resolution, deterministic flowchart generation, and RAG Q&A retrieval.

### 5. Run the Local Development Environment
```bash
npm run dev
```
Starts both servers concurrently:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000 (Health: `http://localhost:5000/health`)

---

## Acceptance Testing & Verification

1. **Multi-File Express Application**:
   - On http://localhost:3000, click **"Real-World Multi-File Express App"** preset.
   - Analysis executes: AST parses 7 files, detects 8 callable routes, resolves prefixes (e.g. `/api/v1/auth/login`, `/api/v1/articles/:id`).
   - Navigate to **APIs tab**: view all resolved endpoints with method badges and DB call tags.
   - Navigate to **Q&A tab**: ask *"How does authentication work?"* -> returns a source-grounded response citing `middleware/auth.js`.
   - Navigate to **Flowcharts tab**: select `POST /api/v1/articles` -> renders deterministic control flow showing both conditional branches and terminal HTTP responses (`res.status(201)`, `res.status(400)`).
2. **Graceful Rejection Test**:
   - On http://localhost:3000, click **"Non-Express Project (Rejection Test)"** preset.
   - CodeTraceAI gracefully rejects the repository with a clear message: *"Unsupported repository: No Express dependency found in package.json and no Express imports detected in source code."*

---

## Project Documentation
See [`notes.md`](./notes.md) for the running record of technical decisions, trade-offs, and interview talking points.
