# 🧠 MindMap AI — Premium AI-Powered Mind Mapping Platform

MindMap AI is a state-of-the-art mind mapping platform that lets users auto-generate comprehensive, visually striking, interactive mind maps from simple prompts, uploaded files (PDFs, Images), website URLs, or YouTube videos. Users can also construct and modify mind maps manually on a premium fluid infinite canvas.

---

## 🚀 Key Features Implemented

### 1. 🔐 Secure & Seamless Authentication
- **Secure Registration**: Registers users with robust password hashing via `bcrypt` (`POST /api/auth/register`).
- **JWT Authorization**: Features secure session management using stateless JSON Web Tokens (`POST /api/auth/login`).
- **Profile Authentication Guard**: Header-based Bearer token authentication to retrieve user sessions and protect API resources (`GET /api/auth/me`).
- **React Route Protection**: Custom client-side router guards (`ProtectedRoute.jsx`) block unauthenticated users from dashboards and editors.

### 2. 📂 Advanced Document Management
- **Optimized Upload Pipeline**: Support for multi-part form uploads using `multer` middleware, allowing both memory buffering and persistent disk storage in `/uploads` (`POST /api/documents/upload`).
- **Document Registry**: Secure cataloging of document metadata (names, source type, file storage paths) associated with users in a PostgreSQL instance.
- **Source Index Retrieval**: Comprehensive dashboard list view of all uploaded files, processing statuses, and source metadata (`GET /api/documents`).

### 3. 🧠 Multimodal Document Parsing & OCR
- **PDF Extraction**: Instantly extracts large-scale text layouts using `pdf-parse`.
- **Gemini Vision OCR**: Leverages Gemini's vision models to process diagrams, flowcharts, scan sheets, or text-heavy images (`Image` source) and extract structural texts.
- **Clean Web Scraping**: An advanced scraper powered by `cheerio` + `axios` that extracts relevant body text while purging navbars, sidebars, headers, and footers.
- **YouTube Transcript Engine**: Dynamically fetches and stitches official/auto-generated YouTube subtitles and captions via `youtube-transcript`.

### 4. ⚡ AI Core & pgvector Search Intelligence
- **High-Performance Vector Embeddings**: Utilizes the modern **`gemini-embedding-2`** model with a custom `outputDimensionality: 768` constraint to create high-context mathematical summaries.
- **pgvector Similarity Pre-Check**: Implements standard PostgreSQL cosine distance searches (`<=>`) over the vector database (`POST /api/generate/check-similarity`). Before starting any generation, it checks for similar maps (>70% match) and alerts the user to prevent duplication.
- **Schema-Governed Generation**: Directs **`gemini-2.5-flash`** to formulate valid JSON mind map schemas containing logical hierarchical levels, content descriptions, and relative 2D positions.
- **Neon-Optimized Transaction Pipelines**: Writes database operations sequentially bypassing heavy `$transaction` wrappers to completely avoid deadlocks under neon proxy pooling schemes.

### 5. 🎨 Interactive React Flow Canvas & Rich Editor
- **Fluid Infinite Canvas**: Uses **`@xyflow/react`** (Vite + React 19 + Tailwind v4 CSS) to deliver high-fps canvas panning, smooth zooming, and customized dragging.
- **Hierarchical Node Styling**: Renders visually distinct nodes mapped to three logical tiers:
  - 🌟 **Concepts** (Root Level): Energetic, colorful linear gradients with a glowing shadow.
  - 🌿 **Subconcepts** (Branch Level): Subtle borders with modern glassmorphism backdrops.
  - 📄 **Details** (Leaf Level): Clean minimalist cards designed for reading summaries.
- **Node Inspector & Drawer Panel**: A sliding settings drawer containing editing tabs:
  - Edit labels in real-time.
  - Upgrade/downgrade node tiers (Concept ↔ Branch ↔ Leaf).
  - Write detailed notes or rich documentation directly on the node.
- **Dynamic Child Spawning ("Grow Child Node")**: Easily branch out mind maps with a single click. Automatically places new nodes relative to their parents and draws customized connecting handles.
- **AI-Driven Auto-Title Summarization**: Integrates an AI action that analyzes all node labels on the canvas and leverages `gemini-2.5-flash` to condense them into a concise, professional title.
- **Persistence Sync Engine**: A highly robust CRUD saver (`PUT /api/maps/:id`) that synchronizes all canvas nodes/edges in real-time, regenerates embeddings, and updates search indices.

### 6. 🔎 Search, Document Linking, and UX Polish
- **Advanced Multi-Field Search**: Implements high-performance Prisma queries (`GET /api/maps?search=query`) supporting keyword search across map titles, custom map tags, individual node labels, and contributing document names with 300ms frontend debounce logic.
- **Implicit Relational Mapping**: Automatically establishes many-to-many database links between newly created mind maps and the documents or web sources used to generate them.
- **Contributed Sources Drawer**: Renders a sleek panel inside the editor showing all referenced materials, complete with matching files/links icons and direct download access.
- **Blank Canvas Bootstrapper**: Detects blank/empty canvas state and presents an onboarding card letting manual builders spawn a root Concept node instantly.
- **Tailwind Breakpoints & Mobile Optimization**: Elegant layout wrapping, adaptive slide-out drawers, responsive viewports, and touch-drag support for tablets and mobile devices.

---

## 🛠️ Architecture & Core Pipeline

```mermaid
graph TD
    A[User Input: Prompt / Document] --> B[Document Processing Service]
    B -->|Extract Text| C[Combined Context Generation]
    C --> D[Gemini Embedding Generator]
    D -->|768-dim Vector| E[pgvector Cosine Similarity Search]
    E -->|Check Similarity > 0.7| F[Find Highly Similar Maps]
    C --> G[Gemini 2.5 Flash Generator]
    G -->|JSON Node/Edge Structure| H[Sequential DB Insert: Map -> Nodes -> Edges]
    H --> I[Mind Map Saved & Rendered]
```

---

## ⚙️ Tech Stack & Key Dependencies

### Frontend (`client/`)
- **React 19** & **Vite 8**
- **@xyflow/react** (React Flow v12) — Interactive canvas framework
- **Tailwind CSS v4** — High-performance utility-first styling
- **Lucide React** — Premium iconography
- **Axios** — HTTP client with auth headers

### Backend (`server/`)
- **Node.js** & **Express 5**
- **Prisma ORM** — Relational database management
- **PostgreSQL** — Relational database storage
- **pgvector** — Native Postgres vector distance operations
- **@google/genai SDK** — Google's official Gemini API client
- **pdf-parse**, **cheerio**, **youtube-transcript** — Text processors

---

## 📂 API Route Directory

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/register` | Register a new user | ❌ |
| **POST** | `/login` | Log in and receive JWT | ❌ |
| **GET** | `/me` | Fetch authenticated session profile | 🔑 |

### Documents (`/api/documents`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/upload` | Upload local file context (PDF/Image) | 🔑 |
| **GET** | `/` | Retrieve uploaded documents list | 🔑 |

### Mind Map Management (`/api/maps`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **GET** | `/` | Fetch all user maps (supports `?search=...`) | 🔑 |
| **POST** | `/` | Create an empty blank mind map | 🔑 |
| **GET** | `/:id` | Fetch specific mind map with formatted nodes & edges | 🔑 |
| **PUT** | `/:id` | Persist full mind map canvas state (nodes, edges, details) | 🔑 |
| **DELETE** | `/:id` | Remove a mind map (cascades nodes & edges) | 🔑 |
| **POST** | `/:id/ai-title` | Auto-generate & update title via Gemini | 🔑 |

### AI Generation (`/api/generate`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/` | Generate structured mind map from prompt/sources | 🔑 |
| **POST** | `/check-similarity` | Check similarity against existing maps (>70%) | 🔑 |

---

## ⚙️ Setup & Installation

### Prerequisite Checklist
- **Node.js** (v18 or higher)
- **PostgreSQL** database with `pgvector` extension enabled

### 1. Clone & Install Dependencies
Ensure you are in the workspace root directory:

```bash
# Install dependencies for both client and server automatically via workspaces
npm install
```

### 2. Configure Environment Variables
Create a `.env` file inside the `server/` directory:

```env
DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/<db>?sslmode=require"
PORT=5000
JWT_SECRET="your-jwt-development-secret-key"
GEMINI_API_KEY="AIzaSy..."
```

### 3. Database Migration
Run migrations to initialize your database structure:

```bash
cd server
npx prisma db push
```

### 4. Running the Development Servers

You can start **both** the frontend client and the backend server concurrently using a single command from the root directory:

```bash
# Start both server and client in development mode
npm run dev
```

Alternatively, you can run them individually:

```bash
# Start backend server only
cd server
npm run dev

# Start frontend client only
cd client
npm run dev
```

---

## 🧪 Testing & Verification
To verify the end-to-end AI document extraction and generation pipeline without a frontend:

```bash
cd server
node scratch/test-generation.js
```

Expected output:
```json
{
  "message": "Map generated successfully",
  "mapId": "90e6571d-c40a-4b1f-91b0-902845fbee89",
  "similarExistingMaps": [
     {
       "id": "08379bc6-843a-4428-84a8-a12d8b711bef",
       "title": "Core concepts of artificial intelligence",
       "similarity": 0.89
     }
  ]
}
```
