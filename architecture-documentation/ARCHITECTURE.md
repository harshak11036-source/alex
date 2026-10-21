# ALEX Platform - Architecture Documentation

## Executive Summary

ALEX (Academic Learning & Excellence Platform) is a full-stack academic management platform built for students, lecturers, and administrators. It combines AI-powered study assistance, document processing with RAG (Retrieval-Augmented Generation), academic planning, research collaboration, project management, attendance tracking, and assessment/assignment workflows.

**Architecture Style**: Hybrid Serverless + Static Frontend
- **Frontend**: Next.js 16 (App Router) with React 19, deployed as static export to Firebase Hosting
- **Backend**: Firebase Cloud Functions Gen 2 (Node.js 20, TypeScript) - HTTPS Callable Functions
- **Primary Database**: Firebase Firestore (real-time, NoSQL)
- **Relational Database**: PostgreSQL via Prisma ORM (academic structure, transactions)
- **Authentication**: Supabase Auth (primary) + Local HMAC Cookie Auth (fallback)
- **AI Providers**: Multi-provider abstraction (NVIDIA Nemotron primary, OpenAI, Gemini, Anthropic, etc.)
- **File Storage**: Firebase Cloud Storage
- **Deployment**: Firebase Hosting + Functions, GitHub Actions CI/CD

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ALEX Platform                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐      ┌──────────────────┐      ┌────────────────┐   │
│  │    Frontend      │◄────►│    Backend       │◄────►│  Firebase      │   │
│  │  (Next.js 16)    │      │ (Firebase Funcs) │      │  Services      │   │
│  └──────────────────┘      └──────────────────┘      └────────────────┘   │
│         │                         │                         │              │
│         ▼                         ▼                         ▼              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Shared Packages (Monorepo)                        │  │
│  │  @alex/shared-types  │  @alex/shared-utils  │  @alex/validation-    │  │
│  │                      │                      │  schemas              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | Next.js (App Router) | 16.4.2 |
| **React** | React | 19.3.0 |
| **Styling** | Tailwind CSS | 4.x |
| **State Management** | TanStack Query | 5.104.4 |
| **Forms** | React Hook Form + Zod | 7.90.0 / 4.6.7 |
| **UI Components** | Radix UI + Custom | Various |
| **Auth (Client)** | Supabase JS SDK | 10.12.0 (Firebase compat) |
| **Backend Runtime** | Firebase Functions Gen 2 | Node.js 20 |
| **Primary DB** | Firestore | Native |
| **Relational DB** | PostgreSQL + Prisma | 5.22.0 |
| **File Storage** | Firebase Storage | Native |
| **AI (Primary)** | NVIDIA Nemotron 3 Ultra | Via NVIDIA API |
| **AI (Fallbacks)** | OpenAI, Gemini, Anthropic, Mistral, Groq, OpenRouter, Together AI | Various |
| **OCR** | Tesseract.js | 7.0.0 |
| **PDF Processing** | pdf-parse, pdfkit, mammoth | Various |
| **Deployment** | Firebase Hosting + Functions | - |
| **CI/CD** | GitHub Actions | - |

---

## 2. Frontend Architecture (apps/web)

### 2.1 Project Structure

```
apps/web/src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Protected dashboard group
│   │   ├── layout.tsx            # DashboardLayout wrapper
│   │   ├── dashboard/            # Role-based dashboards
│   │   ├── documents/            # Document management
│   │   ├── assistant/            # AI chat interface
│   │   ├── study-studio/         # Study materials, flashcards, quizzes
│   │   ├── planner/              # Calendar, tasks, study plans
│   │   ├── research/             # Notebooks, sources, notes
│   │   ├── projects/             # Project management
│   │   ├── assignments/          # Student assignment view
│   │   ├── assessments/          # Assessment view
│   │   ├── achievements/         # Achievement portfolio
│   │   ├── notifications/        # Notification center
│   │   ├── settings/             # User settings
│   │   └── ai-settings/          # AI credential management
│   ├── app-api/api/              # Next.js API Routes (Server-side)
│   │   ├── auth/                 # Login, register, logout, callback
│   │   ├── documents/            # CRUD + signed URLs
│   │   ├── ai/                   # Chat, credentials, models
│   │   ├── rag/                  # RAG queries
│   │   ├── assignments/          # Submit, list submissions
│   │   ├── assessments/          # Results
│   │   ├── attendance/           # Sessions, marking, reports
│   │   ├── planner/              # Events
│   │   ├── projects/             # CRUD
│   │   ├── notifications/        # List, preferences
│   │   ├── achievements/         # CRUD
│   │   └── diagrams/             # Generate, render, templates
│   ├── middleware.ts             # Auth protection, security headers
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/                   # React Components
│   ├── ui/                       # Radix-based UI primitives
│   ├── layout/                   # Sidebar, Header, DashboardLayout
│   ├── auth/                     # AuthProvider
│   ├── documents/                # Upload, List, Viewer
│   ├── ai/                       # VoiceAssistant, Avatar, RAG Chat
│   ├── diagrams/                 # DiagramViewer
│   └── rag/                      # RAG Chat component
├── hooks/                        # Custom React Hooks
│   ├── use-auth.tsx              # Auth context hook
│   └── use-toast.ts              # Toast notifications
├── lib/                          # Core Libraries
│   ├── prisma.ts                 # Prisma client singleton
│   ├── supabase/                 # Supabase client/server/admin
│   ├── firebase/                 # Firebase admin/client
│   ├── local-auth.ts             # HMAC cookie auth
│   ├── encryption.ts             # AES-256 encryption
│   ├── rag/                      # Vector search, generation
│   ├── document-processing/      # Pipeline, extractors, chunker
│   ├── ai/                       # Embeddings
│   ├── cache.ts                  # In-memory TTL cache
│   ├── rate-limiter.ts           # Token bucket
│   ├── audit-log.ts              # Audit logging
│   └── utils.ts                  # Utilities (cn, etc.)
├── types/                        # TypeScript Types
└── styles/                       # Additional styles
```

### 2.2 Key Frontend Patterns

#### Route Groups
- **`(auth)`**: Public routes (login, register) - no auth required
- **`(dashboard)`**: Protected routes - middleware enforces auth
- **`app-api/api`**: Server-side API routes using Prisma/PostgreSQL

#### Authentication Flow
```
1. User visits /dashboard
2. Middleware (middleware.ts) checks cookie 'alex_local_session'
3. If no valid session → redirect to /login with redirect param
4. Login page → POST /api/auth/login
5. API Route: Prisma.findUser → bcrypt.compare → Create HMAC cookie
6. Set cookie 'alex_local_session' (7 days, HttpOnly, Secure, SameSite=Lax)
7. Redirect to /dashboard
8. AuthProvider (Supabase client) initializes, syncs user state
9. TanStack Query provides server state management
```

#### Security Headers (middleware.ts)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` with allowed AI API domains
- `Permissions-Policy` restricting camera/microphone/geolocation

#### State Management
- **Server State**: TanStack Query (React Query) - caching, deduplication, background refetch
- **Client State**: React Context (AuthProvider) + Local Component State
- **Forms**: React Hook Form + Zod validation

---

## 3. Backend Architecture (functions/src)

### 3.1 Entry Point & Organization

**File**: `functions/src/index.ts`

```typescript
// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const authAdmin = getAuth();
const storageAdmin = getStorage();

// Export all callable functions
export const api = {
  ...userFunctions,        // User profiles, roles
  ...documentFunctions,    // Document upload, processing
  ...ragFunctions,         // Semantic search, RAG
  ...aiFunctions,          // Chat, credentials
  ...studyFunctions,       // Study materials, flashcards, quizzes
  ...plannerFunctions,     // Events, tasks, study plans
  ...researchFunctions,    // Notebooks, sources, notes
  ...projectFunctions,     // Projects, tasks, milestones
  ...attendanceFunctions,  // Sessions, records
  ...assessmentFunctions,  // Assessments, grading
  ...assignmentFunctions,  // Assignments, submissions
  ...achievementFunctions, // Achievements
};

// Background Triggers
export const onUserCreate = onDocumentCreated("users/{userId}", ...);
export const onDocumentUpload = onObjectFinalized(async (event) => ...);
export const scheduledCleanup = onSchedule("0 2 * * *", ...);
export const scheduledAttendanceAlerts = onSchedule("0 8 * * *", ...);
```

### 3.2 Function Modules

| Module | File | Responsibilities |
|--------|------|------------------|
| **User** | `user.ts` | Profile CRUD, role management, admin actions |
| **Document** | `document.ts` | Upload (signed URLs), processing queue, chunks, downloads |
| **RAG** | `rag.ts` | Semantic search, RAG query with citations |
| **AI** | `ai.ts` | Multi-provider chat, credential management, encryption |
| **Study** | `study.ts` | Notes, flashcards (SM2), quiz generation |
| **Planner** | `planner.ts` | Events, tasks, AI study plans, daily briefing |
| **Research** | `research.ts` | Notebooks, sources, notes, literature review, paper analysis |
| **Project** | `project.ts` | Projects, members, tasks, milestones, discussions |
| **Attendance** | `attendance.ts` | Sessions, marking, reports, alerts |
| **Assessment** | `assessment.ts` | Assessments, results, grading |
| **Assignment** | `assignment.ts` | Assignments, submissions, grading |
| **Achievement** | `achievement.ts` | Achievement portfolio, verification |

### 3.3 Authentication & Authorization in Functions

Every callable function follows this pattern:

```typescript
export const someFunction = onCall(async (request) => {
  // 1. Verify authentication
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
  
  // 2. Validate input with Zod
  const data = schema.parse(request.data);
  
  // 3. Authorization checks (owner, role, enrollment, membership)
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  if (userDoc.data()?.role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Not authorized");
  }
  
  // 4. Execute business logic
  // ... Firestore operations ...
  
  // 5. Return result
  return { success: true, data: ... };
});
```

### 3.4 Background Triggers

| Trigger | Schedule/Event | Purpose |
|---------|---------------|---------|
| `onUserCreate` | Firestore `users/{userId}` create | Auto-add timestamps to new user profiles |
| `onDocumentUpload` | Storage `objectFinalized` | Queue document processing job |
| `scheduledCleanup` | Daily 02:00 UTC | Delete read notifications older than 30 days |
| `scheduledAttendanceAlerts` | Daily 08:00 UTC | Check attendance % for all students, create alerts if <35% |

---

## 4. Database Architecture

### 4.1 Dual Database Strategy

| Aspect | Firestore (Primary) | PostgreSQL (Secondary) |
|--------|---------------------|------------------------|
| **Data Model** | NoSQL, Denormalized | Relational, Normalized |
| **Consistency** | Eventual (real-time) | Strong (ACID) |
| **Queries** | Limited (indexes required) | Complex (joins, aggregations) |
| **Real-time** | Native listeners | Not native |
| **Vector Search** | Manual (embedding field) | pgvector (not used) |
| **Use Cases** | Chat, notifications, documents, attendance, AI embeddings | Users, enrollments, grades, academic hierarchy, transactions |

### 4.2 Firestore Collections (Key)

```
users/{uid}
subjectEnrollments/{userId_subjectId}
lecturerAssignments/{userId_subjectId}
documents/{docId}
  └── chunks/{chunkId} (subcollection or top-level with documentId)
documentProcessingJobs/{jobId}
conversations/{convId}
  └── messages/{msgId}
aiCredentials/{credId}
aiModelConfigs/{configId}
userMemories/{memId}
studyMaterials/{matId}
flashcardDecks/{deckId}
  └── flashcards/{cardId}
  └── flashcardReviews/{revId}
quizzes/{quizId}
  └── quizAttempts/{attemptId}
mindMaps/{mapId}
diagrams/{diagId}
generatedImages/{imgId}
researchNotebooks/{nbId}
  └── sources/{srcId}
  └── notes/{noteId}
projects/{projId}
  └── members/{memId}
  └── tasks/{taskId}
  └── milestones/{msId}
  └── discussions/{discId}
attendanceSessions/{sessId}
  └── records/{recId}
assessments/{assessId}
  └── results/{resId}
assignments/{assignId}
  └── submissions/{subId}
studentAchievements/{achId}
notifications/{notifId}
notificationPreferences/{userId_category}
auditLogs/{logId}
institutions/{instId}
  └── departments/{deptId}
  └── courses/{courseId}
  └── academicYears/{yearId}
  └── semesters/{semId}
  └── subjects/{subjId}
```

### 4.3 PostgreSQL Models (Prisma)

Key models mirror Firestore but with relations:
- `User` - Core user with passwordHash for local auth
- `CollegeMembership` - User ↔ Institution/Dept/Course/Semester
- `Subject`, `SubjectEnrollment`, `LecturerAssignment`
- `Document`, `DocumentChunk`, `DocumentVersion`, `DocumentProcessingJob`
- `Conversation`, `Message`
- `UserMemory`
- `Task`, `PlannerEvent`
- `Notification`, `NotificationPreference`, `NotificationConfig`, `NotificationDelivery`
- `AICredential`, `AIModelConfig`
- `ResearchNotebook`, `ResearchSource`, `ResearchNote`
- `Project`, `ProjectMember`, `ProjectMentor`, `ProjectTask`, `ProjectMilestone`, `ProjectDiscussion`
- `AttendanceSession`, `AttendanceRecord`
- `Assessment`, `AssessmentResult`
- `Assignment`, `AssignmentSubmission`, `AssignmentAttachment`, `SubmissionAttachment`
- `StudentAchievement`
- `GuardianContact`
- `AuditLog`
- `SubjectResource`
- `StudyMaterial`
- `FlashcardDeck`, `Flashcard`, `FlashcardReview`
- `MindMap`, `Diagram`, `Quiz`, `QuizAttempt`, `GeneratedImage`

---

## 5. Authentication & Authorization

### 5.1 Authentication Modes

#### Primary: Supabase Auth (Firebase Compatible)
- **Client**: `@supabase/supabase-js` with Firebase-like API
- **Server**: `createServerClientSupabase()` for API routes
- **Tokens**: JWT stored in HttpOnly cookies
- **Providers**: Email/password (primary), OAuth (configurable)

#### Fallback: Local Auth (HMAC Cookies)
- **Enabled when**: `AUTH_MODE=local` or no Firebase config
- **Mechanism**: HMAC-SHA256 signed cookie (`alex_local_session`)
- **Payload**: `{sub: userId, exp: timestamp}`
- **Secret**: `NEXTAUTH_SECRET` env var
- **Verification**: Timing-safe comparison

#### Firebase Functions Auth
- **Verification**: Firebase Admin SDK validates `request.auth` (ID token)
- **Custom Claims**: Not used; role checked via Firestore `users/{uid}` document

### 5.2 Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **STUDENT** | Own documents, conversations, study materials, flashcards, quizzes, mind maps, diagrams, research notebooks, projects (member), attendance (view own), assessments (view published), assignments (submit), achievements (own) |
| **LECTURER** | Student permissions + create/manage assessments, assignments, attendance sessions, subject resources, grade submissions, view enrollment analytics |
| **PROJECT_MENTOR** | Lecturer permissions + project mentorship, milestone approval |
| **ADMIN** | All permissions + user management (roles, deactivation), institution/dept/course/semester management, audit logs, notification configs |

### 5.3 Authorization Enforcement Points

1. **Middleware** (`middleware.ts`): Route-level protection
2. **API Routes**: Supabase `getUser()` + Prisma ownership checks
3. **Callable Functions**: `request.auth` + explicit Firestore checks
4. **Firestore Rules**: Server-side security rules (source of truth for Firestore)
5. **UI**: Conditional rendering based on `user.role`

---

## 6. AI Integration Architecture

### 6.1 Multi-Provider Abstraction

```typescript
// functions/src/ai.ts - Provider abstraction
async function generateGeneralAnswer(message: string, provider: string, apiKey: string) {
  switch (provider) {
    case "OPENAI":
      const openai = new OpenAI({ apiKey });
      return openai.chat.completions.create({ model: "gpt-4o-mini", ... });
    case "GOOGLE_GEMINI":
      const genAI = new GoogleGenerativeAI(apiKey);
      return genAI.getGenerativeModel({ model: "gemini-1.5-pro" }).generateContent(message);
    case "ANTHROPIC":
      const anthropic = new Anthropic({ apiKey });
      return anthropic.messages.create({ model: "claude-3-5-sonnet-20241022", ... });
    // ... other providers
  }
}
```

### 6.2 AI Credential Management

```
User adds API Key (Frontend)
    → POST /api/ai/credentials (API Route)
    → Encrypt: AES-256-GCM (ENCRYPTION_KEY from env)
    → Hash: SHA-256 (for deduplication)
    → Store in PostgreSQL (AICredential) + Firestore (aiCredentials)
    → Set as default if requested
```

### 6.3 RAG (Retrieval-Augmented Generation) Pipeline

```
Document Upload
    → Extract Text (pdf-parse, mammoth, Tesseract OCR)
    → Chunk Text (chunker.ts - semantic chunking)
    → Generate Embeddings (OpenAI text-embedding-3-small)
    → Store in Firestore: documentChunks {content, embedding: bytes}
    
RAG Query
    → User Query → Embedding
    → Firestore Query: documentChunks where ownerId + embedding != null + filters
    → Manual Cosine Similarity in Function (or fetch all, compute in memory)
    → Top-K Chunks → Build Context with Citations
    → Add: User Memories, Academic Context, Conversation History, Page Context
    → System Prompt: "You are ALEX, an AI academic assistant..."
    → Call AI Provider → Stream/Return Answer
    → Extract Citations from Answer → Return Sources
    → Save to Conversation + Messages
```

### 6.4 Supported AI Providers

| Provider | Models | Use Cases |
|----------|--------|-----------|
| **NVIDIA Nemotron** | nemotron-3-ultra | Primary chat, reasoning |
| **OpenAI** | gpt-4o, gpt-4o-mini, text-embedding-3-small | Chat, embeddings, fallback |
| **Google Gemini** | gemini-1.5-pro | Chat, multimodal |
| **Anthropic** | claude-3-5-sonnet | Chat, long context |
| **Mistral** | mistral-large | Chat |
| **Groq** | llama-3.1-70b | Fast inference |
| **OpenRouter** | Various | Multi-provider gateway |
| **Together AI** | Various | Open models |

---

## 7. Document Processing Pipeline

### 7.1 Upload Flow

```
Frontend: DocumentUpload Component
    → documentFunctions.createDocument() (Callable)
    → Returns: {documentId, uploadUrl (signed Firebase Storage URL)}
    → Client PUTs file directly to Storage
    → Frontend: documentFunctions.confirmUpload({documentId, checksum})
    → Updates Document: status=QUEUED, checksum
    → Creates documentProcessingJobs entry
```

### 7.2 Processing Pipeline (Background)

```
onDocumentUpload Trigger (Storage)
    → Creates documentProcessingJobs {status: QUEUED}
    
Processing Worker (could be separate function or scheduled):
    1. EXTRACTING: Extract text from PDF/DOCX/PPTX/Images
       - pdf-parse for PDF
       - mammoth for DOCX
       - Tesseract.js for images (OCR)
       - pptx-extractor for PPTX
    2. CHUNKING: Split into semantic chunks (chunker.ts)
       - Target ~500 tokens per chunk
       - Preserve page numbers, section headers
    3. EMBEDDING: Generate embeddings (OpenAI text-embedding-3-small)
    4. INDEXING: Store chunks in Firestore documentChunks with embeddings
    5. COMPLETE: Update Document status=READY, processedAt
    6. ERROR: Update status=FAILED, errorMessage
```

### 7.3 Retry Mechanism

```
User clicks "Retry" on failed document
    → documentFunctions.retryProcessing()
    → Deletes existing chunks
    → Resets status=QUEUED
    → Creates new processing job
    → Pipeline restarts from EXTRACTING
```

---

## 8. Key Features & Data Flows

### 8.1 AI Chat Assistant (`/dashboard/assistant`)

```
User Types Message → rag-chat.tsx
    → POST /api/rag/query (API Route) OR ragFunctions.ragQuery (Callable)
    → Get User's Default AI Credential (Decrypt)
    → Generate Query Embedding
    → Semantic Search in User's Documents (subject/project/notebook filters)
    → Build Context: Chunks + Memories + Academic Context + History
    → Call AI Provider (Streaming or Non-streaming)
    → Return: Answer + Citations + Sources
    → Save Conversation + Messages (Firestore + PostgreSQL)
    → Update UI (TanStack Query cache)
```

### 8.2 Study Studio (`/dashboard/study-studio`)

```
Generate Notes from Document
    → studyFunctions.generateNotes({sourceDocId, type})
    → Fetch Document Chunks → Concatenate Content
    → AI Prompt based on type (concise/detailed/exam/formulas/definitions/comparison)
    → Generate → Save as StudyMaterial → Return
    
Flashcards (SM2 Algorithm)
    → createFlashcardDeck → Initialize SM2 params (easeFactor=2.5, interval=0)
    → getFlashcardsForReview → Query nextReview <= now
    → reviewFlashcard({cardId, rating}) → SM2 Calculation → Update Card + Create Review Record
    
Quiz Generation
    → generateQuiz({sourceDocId, numQuestions, difficulty})
    → Fetch Chunks → AI Prompt → Parse JSON → Save Quiz + Questions
```

### 8.3 Smart Planner (`/dashboard/planner`)

```
Events & Tasks → CRUD via plannerFunctions
Daily Briefing → getDailyBriefing() → Today's events, due tasks, upcoming assessments/assignments
Study Plan Generation → generateStudyPlan({goals, hours, subjects, dateRange})
    → Fetch Upcoming Assessments + Assignments
    → AI Prompt → Weekly Schedule → Save as StudyPlan
```

### 8.4 Research Lab (`/dashboard/research`)

```
Notebooks → CRUD via researchFunctions
Sources → Bibliographic entries (manual or from Documents)
Notes → Linked to Sources
Literature Review → generateLiteratureReview({notebookId})
    → Fetch All Sources + Notes → AI Prompt → Structured Review → Save as Note
Paper Analysis → analyzePaper({sourceId})
    → Fetch Document Chunks → AI Prompt (methodology, findings, limitations, etc.) → Save as Note
```

### 8.5 Projects (`/dashboard/projects`)

```
Projects → CRUD via projectFunctions
Members → Owner adds members (projectFunctions.addMember)
Tasks → Kanban-style (TODO/IN_PROGRESS/REVIEW/DONE)
Milestones → Timeline with due dates
Discussions → Threaded comments per project
```

### 8.6 Attendance (`/dashboard/attendance`)

```
Lecturer Creates Session → attendanceFunctions.createSession()
    → Validates LecturerAssignment
    → Creates Session + Pre-fills ABSENT for all Enrolled Students
    
Mark Attendance → attendanceFunctions.markAttendance({sessionId, records[]})
    → Batch Update Records
    
Student View → getMyAttendance() → Calculates % per subject + overall
    
Automated Alerts → scheduledAttendanceAlerts (Daily 08:00)
    → For Each Student + Enrollment → Calculate Attendance %
    → If <35% → Create Notification (ATTENDANCE category)
```

### 8.7 Assessments & Assignments

```
Lecturer: Create Assessment/Assignment → Set due dates, max marks, weight
Lecturer: Publish → Students Can View
Student: View Published → Submit Assignment (file upload)
Lecturer: Grade → assessmentFunctions.gradeAssessment() / assignmentFunctions.gradeSubmission()
Student: View Results → getMyResults() / getMyAssignments()
```

---

## 9. Deployment & Infrastructure

### 9.1 Environments

| Environment | Firebase Project | Hosting URL | Purpose |
|-------------|------------------|-------------|---------|
| **Development** | Local Emulators | localhost:3000 | Local development |
| **Preview** | Preview Channel | `alex--pr-<num>.web.app` | PR preview deploys |
| **Staging** | `alex-staging` | `alex-staging.web.app` | Staging/QA |
| **Production** | `alex-prod` | `alex.example.com` | Live users |

### 9.2 Deployment Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml (conceptual)
Push to main
  → Install (pnpm)
  → Lint (ESLint)
  → Typecheck (tsc --noEmit)
  → Test (Jest)
  → Build (Next.js static export + Functions tsc)
  → Deploy Preview (Firebase Hosting Preview Channel)
  → Manual Approval
  → Deploy Production (Firebase Hosting + Functions)
```

### 9.3 Secrets Management

| Secret | Scope | Management |
|--------|-------|------------|
| `NVIDIA_NEMOTRON_API_KEY` | Functions | Firebase Secret Manager |
| `OPENAI_API_KEY` | Functions + Web (server) | Secret Manager |
| `GOOGLE_GEMINI_API_KEY` | Functions | Secret Manager |
| `ANTHROPIC_API_KEY` | Functions | Secret Manager |
| `ENCRYPTION_KEY` | Functions + Web | Secret Manager |
| `NEXTAUTH_SECRET` | Web (local auth) | Secret Manager |
| `DATABASE_URL` | Web (Prisma) | Secret Manager |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Functions | Secret Manager |
| `SMTP_PASSWORD` | Functions | Secret Manager |
| `SENTRY_DSN` | Both | Secret Manager |

### 9.4 Firebase Configuration

**firebase.json**:
- Hosting: `apps/web/out` (static export)
- Functions: `functions` (source), Node.js 20, Gen 2
- Firestore: Rules + Indexes
- Storage: Rules
- Emulators: Auth, Functions, Firestore, Storage, Hosting

---

## 10. Security Architecture

### 10.1 Data Protection

| Layer | Mechanism |
|-------|-----------|
| **API Keys at Rest** | AES-256-GCM encryption (ENCRYPTION_KEY) |
| **API Keys in Transit** | HTTPS only, never logged |
| **Passwords** | bcrypt (cost 12) in PostgreSQL |
| **Session Cookies** | HMAC-SHA256 signed, HttpOnly, Secure, SameSite=Lax |
| **Firestore Access** | Security Rules (ownership, enrollment, roles) |
| **PostgreSQL Access** | Prisma + Row-level checks in API routes |
| **Secrets** | Firebase Secret Manager (not in code) |

### 10.2 Network Security

- **CORS**: Configured per environment
- **CSP**: Strict policy in middleware (allows AI API domains)
- **Rate Limiting**: Token bucket in API routes, Firebase Functions built-in
- **Input Validation**: Zod schemas on all inputs (frontend + backend)

### 10.3 Audit Logging

```typescript
// apps/web/src/lib/audit-log.ts
await prisma.auditLog.create({
  data: {
    institutionId,
    userId,
    action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | ...,
    entityType: "user" | "document" | "assessment" | ...,
    entityId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
  }
});
```

---

## 11. Scalability & Performance

### 11.1 Frontend
- **Static Export**: All pages pre-rendered, served from CDN
- **Code Splitting**: Automatic via Next.js App Router
- **Image Optimization**: Not used (static export) - manual optimization
- **Caching**: TanStack Query (stale-while-revalidate), HTTP caching headers

### 11.2 Backend (Firebase Functions)
- **Auto-scaling**: Instance count based on load
- **Max Instances**: Configurable per function
- **Concurrency**: 80 requests per instance (default)
- **Cold Starts**: Minimized by keeping instances warm (min instances)

### 11.3 Firestore
- **Auto-scaling**: Handles traffic spikes
- **Indexes**: Composite indexes for all query patterns (firestore.indexes.json)
- **Read/Write Costs**: Optimized by denormalization, batch writes

### 11.4 PostgreSQL
- **Connection Pooling**: Prisma default (configurable)
- **Indexes**: Defined in Prisma schema (`@@index`)
- **Migrations**: Prisma Migrate (version controlled)

---

## 12. Monitoring & Observability

### 12.1 Logging
- **Functions**: Structured `console.log` / `console.error` (JSON in production)
- **Frontend**: Browser console, TanStack Query devtools
- **Audit Logs**: PostgreSQL `auditLogs` table

### 12.2 Error Tracking
- **Sentry**: Optional (SENTRY_DSN env var)
- **Firebase Functions**: Built-in error reporting in Console

### 12.3 Performance
- **Firebase Performance Monitoring**: Optional
- **TanStack Query Devtools**: Development only

---

## 13. File Map - Key Files to Understand the Project

### Frontend Entry Points
| File | Purpose |
|------|---------|
| `apps/web/src/app/layout.tsx` | Root layout, providers |
| `apps/web/src/app/page.tsx` | Landing page |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard wrapper |
| `apps/web/src/app/middleware.ts` | Auth protection, security headers |
| `apps/web/src/components/auth/AuthProvider.tsx` | Auth context provider |

### Backend Entry Points
| File | Purpose |
|------|---------|
| `functions/src/index.ts` | Main export, triggers, shared admin SDK |
| `functions/src/user.ts` | User management functions |
| `functions/src/document.ts` | Document upload, processing |
| `functions/src/rag.ts` | Semantic search, RAG queries |
| `functions/src/ai.ts` | AI chat, credentials, providers |
| `functions/src/study.ts` | Study materials, flashcards, quizzes |
| `functions/src/planner.ts` | Events, tasks, study plans |
| `functions/src/research.ts` | Notebooks, sources, notes |
| `functions/src/project.ts` | Projects, collaboration |
| `functions/src/attendance.ts` | Attendance sessions, records |
| `functions/src/assessment.ts` | Assessments, grading |
| `functions/src/assignment.ts` | Assignments, submissions |
| `functions/src/achievement.ts` | Achievements |

### Configuration
| File | Purpose |
|------|---------|
| `package.json` (root) | Workspace scripts, dependencies |
| `pnpm-workspace.yaml` | Monorepo package config |
| `apps/web/package.json` | Frontend deps, scripts |
| `functions/package.json` | Backend deps, scripts |
| `apps/web/prisma/schema.prisma` | PostgreSQL schema |
| `firebase/firestore.rules` | Firestore security rules |
| `firebase/firestore.indexes.json` | Firestore composite indexes |
| `firebase.json` | Firebase project config |
| `docker-compose.yml` | Local development stack |
| `.env.example` | Environment variable template |

### Core Libraries
| File | Purpose |
|------|---------|
| `apps/web/src/lib/prisma.ts` | Prisma client singleton |
| `apps/web/src/lib/supabase/client.ts` | Supabase client (browser) |
| `apps/web/src/lib/supabase/server.ts` | Supabase server client |
| `apps/web/src/lib/local-auth.ts` | HMAC cookie auth |
| `apps/web/src/lib/encryption.ts` | AES-256 encryption |
| `apps/web/src/lib/rag/vector-search.ts` | Semantic search |
| `apps/web/src/lib/rag/generation.ts` | AI answer generation |
| `apps/web/src/lib/document-processing/pipeline.ts` | Document processing |
| `apps/web/src/lib/cache.ts` | In-memory cache |

---

## 14. How to Run Locally

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL, Firebase Emulators)
- Firebase CLI (`npm i -g firebase-tools`)

### Start Development
```bash
# 1. Install dependencies
pnpm install

# 2. Start Docker services (PostgreSQL, Emulators)
# Terminal 1:
docker-compose -f docker-compose.dev.yml up -d

# 3. Setup database
cd apps/web
pnpm db:generate
pnpm db:push
pnpm db:seed

# 4. Start development servers
# Terminal 2 (from root):
pnpm dev
# Or separately:
pnpm dev:web      # Next.js on localhost:3000
pnpm dev:functions # Firebase Functions emulator on localhost:5001
```

### Environment Files
```bash
# Root
cp .env.example .env

# Frontend
cp apps/web/.env.example apps/web/.env.local

# Functions
cp functions/.env.example functions/.env
```

---

## 15. Architectural Decisions & Trade-offs

### Decision: Dual Database (Firestore + PostgreSQL)
**Rationale**: Firestore excels at real-time, hierarchical data (chat, notifications, documents with chunks). PostgreSQL excels at relational academic data (enrollments, grades, transactions).
**Trade-off**: Data duplication, sync complexity. Mitigated by clear ownership boundaries.

### Decision: Firebase Functions over Custom Backend
**Rationale**: Serverless, auto-scaling, integrated with Firestore/Storage/Auth, minimal ops.
**Trade-off**: Cold starts, vendor lock-in, 60s timeout, limited runtime customization.

### Decision: Static Export for Next.js
**Rationale**: Free Firebase Hosting, global CDN, no server costs for frontend.
**Trade-off**: No SSR/ISR, all data fetching client-side or via API routes.

### Decision: Callable Functions over REST API
**Rationale**: Built-in auth context (`request.auth`), automatic serialization, TypeScript types shared.
**Trade-off**: Firebase SDK required on client, not standard REST.

### Decision: Multiple AI Providers
**Rationale**: Redundancy, cost optimization, model specialization.
**Trade-off**: Complexity in abstraction, different APIs, inconsistent capabilities.

---

## 16. Known Limitations & Future Considerations

### Current Limitations
1. **No Vector Index in Firestore**: Semantic search fetches all candidate chunks matching filters, computes cosine similarity in-memory (functions/src/rag.ts:53-67). This doesn't scale beyond ~10k chunks per user.
2. **Document Processing Not Fully Automated**: `onDocumentUpload` trigger creates job but no worker processes it. Processing must be triggered manually via `retryProcessing` or a separate scheduled function.
3. **No WebSocket Server**: Real-time limited to Firestore listeners. No live collaboration (cursors, presence, concurrent editing).
4. **Local Auth Only**: Supabase client configured but no OAuth providers enabled. Only email/password via local auth fallback.
5. **Shared Packages Not Published**: `@alex/shared-types`, `@alex/shared-utils`, `@alex/validation-schemas` are workspace references only (`package.json:52-54`). Not on npm.
6. **No Prisma Migration History Visible**: `prisma/migrations/` directory not found - may need initial migration.
7. **Firebase Emulators Config Only**: `firebase.json` references emulators but no `firestore.rules` test suite.
8. **No API Rate Limiting on Functions**: Relies on Firebase built-in limits only.
9. **Hardcoded AI Model Names**: Models like "gpt-4o-mini", "gemini-1.5-pro" hardcoded in multiple function files.

### Potential Improvements
1. **Firestore Vector Search**: Use new Firestore vector indexes when generally available
2. **Background Workers**: Cloud Run jobs or Cloud Tasks for document processing pipeline
3. **WebSocket Server**: For real-time collaboration (cursor presence, live editing)
4. **OAuth Providers**: Google, GitHub, Microsoft for Supabase Auth
5. **Published Packages**: Publish `@alex/shared-types` etc. to npm registry
6. **pgvector**: Move embeddings to PostgreSQL for better vector search performance
7. **Event Sourcing**: For audit trail and replay capability
8. **Centralized AI Config**: Move model names to `aiModelConfigs` collection + Functions config

---

## 17. Problems & Architectural Risks

### 17.1 Confirmed Issues (Evidence in Code)

#### **Dead/Unused Code**
| Location | Issue | Evidence |
|----------|-------|----------|
| `apps/web/src/lib/supabase/client.ts:48-80` | Mock auth fallback never used in production | `createMockAuth()` returns non-functional auth; only used if no Firebase config AND not local mode |
| `functions/src/rag.ts:38-70` | `semanticSearchImpl()` duplicates `search` function | Both do similar Firestore queries; `semanticSearchImpl` computes fake similarity scores |
| `functions/src/ai.ts:298-322` | Encryption uses hardcoded fallback key | `process.env.ENCRYPTION_KEY \|\| "default-key"` - insecure default |
| `apps/web/src/lib/local-auth.ts:4` | Hardcoded development secret | `'alex-local-development-secret-change-me'` in production would be catastrophic |

#### **Broken/Missing Integrations**
| Integration | Status | Evidence |
|-------------|--------|----------|
| Document Processing Pipeline | **Not Implemented** | `onDocumentUpload` trigger creates job but no consumer; `reprocessDocument` imported in API route but not implemented in pipeline |
| Scheduled Attendance Alerts | **Inefficient N+1 Queries** | `functions/src/index.ts:96-148` - loops through ALL students → enrollments → sessions → records (4 nested loops) |
| Vector Search | **In-Memory Only** | `rag.ts:53-67` fetches all chunks, computes similarity in JS - O(n) not indexed |
| Supabase Auth | **Not Configured** | Client falls back to local auth; no OAuth providers in `createClient()` |
| Shared Packages | **Missing** | `pnpm-workspace.yaml` declares `packages/*` but directory doesn't exist |

#### **Hardcoded Configuration**
| File | Hardcoded Value | Risk |
|------|-----------------|------|
| `functions/src/ai.ts:234, 248, 255, 273, 280, 288` | Model names: "gpt-4o-mini", "gemini-1.5-pro", "claude-3-5-sonnet-20241022" | Cannot change models without code deploy |
| `functions/src/ai.ts:300` | `"default-key"` fallback | Encryption key exposure if env var missing |
| `functions/src/rag.ts:159` | `process.env.OPENAI_API_KEY` only | Embeddings tied to OpenAI; can't use other providers |
| `functions/src/study.ts:268` | OpenAI only for note generation | No provider abstraction |
| `functions/src/planner.ts:206` | OpenAI only for study plans | No provider abstraction |
| `functions/src/research.ts:225` | OpenAI only for research AI | No provider abstraction |
| `apps/web/src/app/middleware.ts:25` | CSP allows specific AI domains | Must update CSP when adding new AI providers |

#### **Security Risks**
| Risk | Location | Severity | Description |
|------|----------|----------|-------------|
| **Default Encryption Key** | `functions/src/ai.ts:300`, `apps/web/src/lib/encryption.ts` | **HIGH** | If `ENCRYPTION_KEY` not set, all AI API keys encrypted with known key |
| **No Input Sanitization on AI Prompts** | `functions/src/ai.ts:236`, `rag.ts:118-122` | **MEDIUM** | User content directly interpolated into prompts (prompt injection risk) |
| **Firestore Rules Allow Wide Reads** | `firebase/firestore.rules:46` | **LOW** | `subjects` collection readable by any signed-in user |
| **No Request Size Limits** | API Routes, Functions | **LOW** | Large payloads could cause DoS |
| **Secrets in Client Bundle Risk** | `apps/web/src/lib/supabase/client.ts:9-15` | **LOW** | `NEXT_PUBLIC_FIREBASE_*` exposed to browser (by design for Firebase) |

### 17.2 Potential Risks (Not Verified but Likely)

#### **Scalability Risks**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Firestore Read Costs at Scale | High | High | DocumentChunks queries fetch all matching docs; add pagination + limit |
| Function Cold Starts | Medium | Medium | Set `minInstances` for critical functions (ai, rag) |
| Embedding Computation in Functions | High | High | Move to async worker (Cloud Tasks + Cloud Run) |
| N+1 Query in Attendance Alerts | High | High | Rewrite with aggregation queries or materialized views |

#### **Data Consistency Risks**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Firestore ↔ PostgreSQL Drift | Medium | High | No sync mechanism; define clear ownership per entity |
| Duplicate AI Credentials | Low | Medium | KeyHash prevents but not enforced at DB level |
| Orphaned Document Chunks | Medium | Medium | `deleteDocument` cleans up but no foreign key enforcement |

#### **Operational Risks**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No Automated Backups for Firestore | Medium | High | Enable PITR (Point-in-Time Recovery) |
| Secret Rotation Not Automated | High | Medium | Implement rotation schedule for AI API keys |
| No Integration Tests | High | High | Add `firebase-functions-test` + Jest for functions |
| Single Region Deployment | Medium | Medium | Configure multi-region for Firestore/Storage |

#### **Developer Experience Risks**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing Shared Packages | Confirmed | High | Create `packages/` directory with shared code |
| No TypeScript Path Aliases for Shared | Medium | Medium | Configure `tsconfig.json` paths |
| Inconsistent Error Handling | Medium | Low | Standardize on `HttpsError` codes + frontend error boundary |

### 17.3 Architecture Debt

| Component | Technical Debt | Recommended Action |
|-----------|----------------|-------------------|
| **AI Provider Abstraction** | Each function reimplements provider switching | Create `AIProvider` interface + factory in shared package |
| **Document Processing** | Pipeline split between frontend lib + backend functions | Unify in single worker service |
| **Validation Schemas** | Zod schemas duplicated in frontend API routes + backend functions | Move to `@alex/validation-schemas` package |
| **Firestore ↔ Prisma Models** | Manual sync required | Generate Prisma from Firestore rules or vice versa |
| **Error Codes** | Inconsistent: some use `HttpsError`, some throw raw Errors | Standardize error hierarchy |

### 17.4 Deployment Risks

| Risk | Status | Evidence |
|------|--------|----------|
| **Firebase Functions Gen 2 Migration** | Partial | Uses Gen 2 syntax (`onCall`, `onSchedule`) but some patterns are Gen 1 |
| **Node.js 20 Requirement** | Enforced | `package.json:18` specifies Node 20; ensure Cloud Functions supports it |
| **Static Export Limitations** | Active | `next.config.js` not shown but `output: 'export'` implied; no ISR, no dynamic routes at build time |
| **Prisma Binary Targets** | Unknown | `pnpm-workspace.yaml:11` allows `@prisma/engines` builds; may fail on some architectures |

---

## 18. Recommended Priority Fixes

### **P0 - Critical (Do First)**
1. **Set `ENCRYPTION_KEY` in all environments** - Remove hardcoded default in `functions/src/ai.ts:300` and `apps/web/src/lib/encryption.ts`
2. **Implement Document Processing Worker** - Create Cloud Run job or scheduled function to process `documentProcessingJobs`
3. **Add Vector Search Index** - Migrate to Firestore vector search or pgvector when available
4. **Create Shared Packages** - Extract types, utils, validation schemas to `packages/`

### **P1 - High (Next Sprint)**
1. **Fix Attendance Alert N+1 Queries** - Use aggregation or materialized attendance percentages
2. **Centralize AI Model Configuration** - Move model names to `aiModelConfigs` + Functions config
3. **Add Input Sanitization for AI Prompts** - Escape user content before interpolation
4. **Implement Rate Limiting on Functions** - Per-user token bucket
5. **Add Integration Tests** - Use `firebase-functions-test` for all callable functions

### **P2 - Medium (Next Quarter)**
1. **Enable Supabase OAuth Providers** - Google, GitHub, Microsoft
2. **Multi-region Firestore/Storage** - For disaster recovery
3. **Automated Secret Rotation** - CI/CD pipeline for AI API keys
4. **Publish Shared Packages** - To npm or GitHub Packages
5. **Add WebSocket Server** - For real-time collaboration features

### **P3 - Low (Future)**
1. **Event Sourcing for Audit Trail** - Full replay capability
2. **pgvector Migration** - Move embeddings to PostgreSQL
3. **Advanced CSP Management** - Dynamic CSP based on configured AI providers
4. **Observability Stack** - Structured logging, distributed tracing, dashboards