# ALEX Data Model Reference

This document describes the database schemas, relationships, and data flows for both Firestore (NoSQL) and PostgreSQL (Relational via Prisma).

---

## Overview

ALEX uses a **dual-database architecture**:

| Database | Purpose | Technology |
|----------|---------|------------|
| **Firestore** | Real-time data, documents, chat, notifications, AI embeddings, attendance, assessments, assignments, projects, research | Firebase Firestore (NoSQL) |
| **PostgreSQL** | Relational academic structure, users, enrollments, grades, structured queries, transactions | PostgreSQL via Prisma ORM |

Both databases share similar schema concepts but are optimized for different access patterns.

---

## Firestore Collections (Primary Real-time DB)

### Core User & Academic Structure

#### `users/{userId}`
```javascript
{
  uid: string,                    // Firebase Auth UID (document ID)
  email: string,
  firstName: string,
  lastName: string,
  role: "STUDENT" | "LECTURER" | "ADMIN" | "PROJECT_MENTOR",
  institutionId: string?,
  departmentId: string?,
  courseId: string?,
  semesterId: string?,
  emailVerified: boolean,
  isActive: boolean,
  avatarUrl: string?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `subjectEnrollments/{enrollmentId}` (composite key: `userId_subjectId`)
```javascript
{
  userId: string,
  subjectId: string,
  semesterId: string,
  enrolledAt: Timestamp,
  isActive: boolean
}
```

#### `lecturerAssignments/{assignmentId}` (composite key: `userId_subjectId`)
```javascript
{
  userId: string,
  subjectId: string,
  assignedAt: Timestamp,
  assignedBy: string?,
  isPrimary: boolean
}
```

#### Academic Hierarchy
- `institutions/{institutionId}`
- `departments/{departmentId}` (institutionId)
- `courses/{courseId}` (institutionId, departmentId)
- `academicYears/{yearId}` (institutionId)
- `semesters/{semesterId}` (institutionId, academicYearId, courseId)
- `subjects/{subjectId}` (institutionId, departmentId, semesterId)

---

### Documents & Processing

#### `documents/{documentId}`
```javascript
{
  id: string,                     // UUID
  title: string,
  description: string?,
  fileName: string,
  fileSize: number,
  mimeType: string,
  documentType: "PDF" | "DOC" | "DOCX" | "TXT" | ...,
  storagePath: string,            // Firebase Storage path
  storageBucket: string,
  checksum: string,               // SHA-256 for deduplication
  status: "UPLOADED" | "QUEUED" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "INDEXING" | "READY" | "FAILED",
  errorMessage: string?,
  pageCount: number?,
  metadata: Json?,
  ownerId: string,                // User UID
  subjectId: string?,
  projectId: string?,
  notebookId: string?,
  processorId: string?,
  processedAt: Timestamp?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `documentChunks/{chunkId}`
```javascript
{
  documentId: string,
  content: string,                // Text chunk
  chunkIndex: number,             // Order in document
  pageNumber: number?,
  sectionTitle: string?,
  tokenCount: number,
  embedding: bytes?,              // Vector embedding (OpenAI text-embedding-3-small)
  metadata: Json?,
  ownerId: string,                // For security rules
  subjectId: string?,             // For filtered search
  projectId: string?,
  notebookId: string?,
  createdAt: Timestamp
}
```
**Index**: Composite on `ownerId + embedding != null + subjectId/projectId/notebookId/documentId`

#### `documentProcessingJobs/{jobId}`
```javascript
{
  documentId: string,
  step: "queued" | "extracting" | "chunking" | "embedding" | "indexing" | "retry",
  status: DocumentStatus,
  startedAt: Timestamp?,
  completedAt: Timestamp?,
  errorMessage: string?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### AI & Chat

#### `conversations/{conversationId}`
```javascript
{
  userId: string,
  title: string?,                 // Auto-generated from first message
  subjectId: string?,
  projectId: string?,
  notebookId: string?,
  metadata: Json?,
  lastMessage: string?,           // Preview
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `conversations/{conversationId}/messages/{messageId}`
```javascript
{
  conversationId: string,
  senderId: string,               // User UID or "assistant"
  role: "user" | "assistant",
  content: string,
  metadata: Json?,                // Citations, sources, token usage
  toolCalls: Json?,
  toolResults: Json?,
  createdAt: Timestamp
}
```

#### `aiCredentials/{credentialId}`
```javascript
{
  userId: string,
  provider: "OPENAI" | "GOOGLE_GEMINI" | "ANTHROPIC" | "NVIDIA_NEMOTRON" | ...,
  providerName: string,
  encryptedKey: string,           // AES-256-GCM encrypted
  keyHash: string,                // SHA-256 for deduplication
  isActive: boolean,
  isDefault: boolean,
  models: string[]?,              // Available models
  usageLimit: number?,
  usageCount: number,
  lastUsedAt: Timestamp?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `aiModelConfigs/{configId}`
```javascript
{
  userId: string,
  provider: AIProviderType,
  modelId: string,
  taskType: "chat" | "embedding" | "rag" | "analysis" | ...,
  isDefault: boolean,
  parameters: Json?,              // Temperature, max_tokens, etc.
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `userMemories/{memoryId}`
```javascript
{
  userId: string,
  category: "CONVERSATION_HISTORY" | "EXPLICIT_MEMORIES" | "ACADEMIC_CONTEXT" | "PROJECT_CONTEXT" | "RETRIEVED_KNOWLEDGE",
  key: string,
  value: string,
  confidence: number,             // 0-1
  source: string?,
  isVerified: boolean,
  expiresAt: Timestamp?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```
**Unique**: `userId + category + key`

---

### Study Materials

#### `studyMaterials/{materialId}`
```javascript
{
  userId: string,
  title: string,
  content: string,
  type: "concise" | "detailed" | "exam" | "formulas" | "definitions" | "comparison" | "custom",
  sourceDocId: string?,
  subjectId: string?,
  topic: string?,
  tags: string[],
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `flashcardDecks/{deckId}`
```javascript
{
  userId: string,
  title: string,
  description: string?,
  subjectId: string?,
  sourceDocId: string?,
  algorithm: "SM2",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `flashcards/{cardId}` (subcollection or top-level)
```javascript
{
  deckId: string,
  front: string,
  back: string,
  difficulty: number,             // 0-1
  interval: number,               // Days
  repetitions: number,
  easeFactor: number,             // SM2 default 2.5
  nextReview: Timestamp,
  lastReviewed: Timestamp?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `flashcardReviews/{reviewId}`
```javascript
{
  cardId: string,
  userId: string,
  rating: number,                 // 0-5 (SM2)
  previousEase: number,
  newEase: number,
  previousInterval: number,
  newInterval: number,
  reviewedAt: Timestamp
}
```

#### `quizzes/{quizId}`
```javascript
{
  userId: string,
  title: string,
  description: string?,
  subjectId: string?,
  sourceDocId: string?,
  topic: string?,
  difficulty: "easy" | "medium" | "hard",
  questions: Json,                // Array of {question, options[], correct, explanation}
  timeLimit: number?,             // Minutes
  isPublished: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `quizAttempts/{attemptId}`
```javascript
{
  quizId: string,
  userId: string,
  answers: Json,                  // User's answers
  score: number,
  maxScore: number,
  startedAt: Timestamp,
  completedAt: Timestamp?,
  metadata: Json?
}
```

---

### Visual Learning

#### `mindMaps/{mindMapId}`
```javascript
{
  userId: string,
  title: string,
  sourceDocId: string?,
  subjectId: string?,
  topic: string?,
  nodes: Json,                    // {id, label, position, ...}
  edges: Json,                    // {id, source, target, ...}
  viewport: Json?,                // Pan/zoom state
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `diagrams/{diagramId}`
```javascript
{
  userId: string,
  title: string,
  type: "flowchart" | "sequence" | "class" | "state" | "er" | "journey" | "gitgraph" | "pie" | "quadrant",
  sourceDocId: string?,
  subjectId: string?,
  definition: Json,               // Mermaid/PlantUML source
  renderedUrl: string?,           // Cached rendered image
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `generatedImages/{imageId}`
```javascript
{
  userId: string,
  prompt: string,
  sourceDocId: string?,
  subjectId: string?,
  imageUrl: string,               // Firebase Storage URL
  model: string,                  // e.g., "dall-e-3"
  parameters: Json?,              // Size, quality, etc.
  createdAt: Timestamp
}
```

---

### Research

#### `researchNotebooks/{notebookId}`
```javascript
{
  title: string,
  description: string?,
  ownerId: string,
  projectId: string?,             // Optional project link
  isPublic: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `researchNotebooks/{notebookId}/sources/{sourceId}`
```javascript
{
  notebookId: string,
  documentId: string?,            // Linked document
  title: string,
  authors: string[]?,
  publicationYear: number?,
  doi: string?,
  url: string?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `researchNotebooks/{notebookId}/notes/{noteId}`
```javascript
{
  notebookId: string,
  userId: string,
  title: string,
  content: string,
  sourceIds: string[],            // References to sources
  tags: string[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Projects & Collaboration

#### `projects/{projectId}`
```javascript
{
  title: string,
  description: string?,
  category: string?,
  tags: string[],
  ownerId: string,
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED",
  startDate: Timestamp?,
  endDate: Timestamp?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `projectMembers/{memberId}` (composite: `projectId_userId`)
```javascript
{
  projectId: string,
  userId: string,
  role: "OWNER" | "MEMBER" | "MENTOR",
  joinedAt: Timestamp,
  invitedBy: string?
}
```

#### `projectTasks/{taskId}`
```javascript
{
  projectId: string,
  title: string,
  description: string?,
  assigneeId: string?,
  creatorId: string,
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE",
  priority: number,
  dueDate: Timestamp?,
  completedAt: Timestamp?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `projectMilestones/{milestoneId}`
```javascript
{
  projectId: string,
  title: string,
  description: string?,
  dueDate: Timestamp,
  completedAt: Timestamp?,
  isCompleted: boolean,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `projectDiscussions/{discussionId}`
```javascript
{
  projectId: string,
  userId: string,
  title: string,
  content: string,
  parentId: string?,              // For replies
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Attendance

#### `attendanceSessions/{sessionId}`
```javascript
{
  subjectId: string,
  semesterId: string,
  date: Timestamp,
  period: number,                 // Period number (1, 2, 3...)
  topic: string?,
  conductedBy: string,            // Lecturer UID
  isCancelled: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```
**Unique**: `subjectId + date + period`

#### `attendanceRecords/{recordId}` (composite: `sessionId_userId`)
```javascript
{
  sessionId: string,
  userId: string,
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "ON_DUTY",
  markedBy: string,               // Lecturer UID
  markedAt: Timestamp,
  notes: string?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Assessments & Grades

#### `assessments/{assessmentId}`
```javascript
{
  subjectId: string,
  semesterId: string,
  name: string,
  type: "INTERNAL_ASSESSMENT" | "ASSIGNMENT" | "QUIZ" | "LAB_ASSESSMENT" | "PROJECT" | "PRESENTATION" | "PRACTICAL_EXAM" | "SEMESTER_EXAM" | "OTHER",
  maxMarks: number,
  weight: number,                 // Weightage (default 1.0)
  assessmentDate: Timestamp,
  description: string?,
  isPublished: boolean,
  publishedAt: Timestamp?,
  createdBy: string,              // Lecturer UID
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `assessmentResults/{resultId}` (composite: `assessmentId_userId`)
```javascript
{
  assessmentId: string,
  userId: string,
  marksObtained: number,
  feedback: string?,
  gradedBy: string?,
  gradedAt: Timestamp?,
  isPublished: boolean,
  publishedAt: Timestamp?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Assignments

#### `assignments/{assignmentId}`
```javascript
{
  subjectId: string,
  title: string,
  description: string?,
  instructions: string?,
  maxMarks: number,
  weight: number,
  assignedDate: Timestamp,
  dueDate: Timestamp,
  allowedFormats: string[],
  allowResubmission: boolean,
  maxSubmissions: number,
  isPublished: boolean,
  createdBy: string,              // Lecturer UID
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `assignmentSubmissions/{submissionId}` (composite: `assignmentId_userId_submissionNumber`)
```javascript
{
  assignmentId: string,
  userId: string,
  status: "DRAFT" | "SUBMITTED" | "LATE" | "RESUBMITTED" | "EVALUATED" | "PUBLISHED",
  submissionNumber: number,
  content: string?,
  submittedAt: Timestamp?,
  gradedAt: Timestamp?,
  marksObtained: number?,
  feedback: string?,
  gradedBy: string?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Achievements

#### `studentAchievements/{achievementId}`
```javascript
{
  userId: string,
  title: string,
  category: "INTERNSHIP" | "CERTIFICATION" | "WORKSHOP" | "HACKATHON" | "RESEARCH_PUBLICATION" | "TECHNICAL_COMPETITION" | "CLUB_ACTIVITY" | "VOLUNTEERING" | "PROJECT" | "AWARD" | "PLACEMENT_PREPARATION" | "OTHER",
  organization: string?,
  startDate: Timestamp?,
  endDate: Timestamp?,
  description: string?,
  status: "COMPLETED" | "IN_PROGRESS" | "PLANNED",
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED",
  verifiedBy: string?,
  verifiedAt: Timestamp?,
  certificateUrl: string?,
  metadata: Json?,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Notifications

#### `notifications/{notificationId}`
```javascript
{
  userId: string,
  category: "ASSIGNMENT" | "ATTENDANCE" | "INTERNAL_ASSESSMENT" | "ACADEMIC_ANNOUNCEMENT" | "PROJECT_MILESTONE" | "MENTOR_FEEDBACK" | "RESEARCH_UPDATE" | "STUDY_REMINDER" | "UPCOMING_DEADLINE" | "DOCUMENT_PROCESSING_FAILURE" | "AI_TASK_COMPLETION",
  title: string,
  message: string,
  referenceId: string?,           // Related entity ID
  referenceType: string?,         // "assignment" | "assessment" | ...
  isRead: boolean,
  readAt: Timestamp?,
  metadata: Json?,
  createdAt: Timestamp
}
```

#### `notificationPreferences/{prefId}` (composite: `userId_category`)
```javascript
{
  userId: string,
  category: NotificationCategory,
  inAppEnabled: boolean,
  emailEnabled: boolean,
  pushEnabled: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### Audit & Compliance

#### `auditLogs/{logId}`
```javascript
{
  institutionId: string,
  userId: string?,                // Null for system actions
  action: string,                 // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | ...
  entityType: string,             // "user" | "document" | "assessment" | ...
  entityId: string?,
  oldValues: Json?,
  newValues: Json?,
  ipAddress: string?,
  userAgent: string?,
  createdAt: Timestamp
}
```

---

## PostgreSQL Models (Prisma Schema)

The PostgreSQL schema mirrors Firestore but with **normalized relations**, **foreign keys**, and **ACID transactions**. Key differences:

### Key Models (from `apps/web/prisma/schema.prisma`)

#### User & Academic
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  passwordHash  String?  // For local auth
  firstName     String
  lastName      String
  avatarUrl     String?
  role          UserRole @default(STUDENT)
  isActive      Boolean  @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  memberships      CollegeMembership[]
  documents        Document[]          @relation("DocumentOwner")
  conversations    Conversation[]
  messages         Message[]           @relation("MessageSender")
  memories         UserMemory[]
  tasks            Task[]              @relation("TaskAssignee")
  plannerEvents    PlannerEvent[]
  notifications    Notification[]
  aiCredentials    AICredential[]
  // ... many more relations
}

model CollegeMembership {
  id            String           @id @default(cuid())
  userId        String
  institutionId String
  departmentId  String?
  courseId      String?
  semesterId    String?
  academicYearId String?
  role          UserRole
  status        MembershipStatus @default(PENDING)
  studentId     String?          @unique
  employeeId    String?          @unique
  // Relations to Institution, Department, Course, Semester, AcademicYear
  @@unique([userId, institutionId])
}
```

#### Academic Hierarchy (Normalized)
```prisma
model Institution { /* ... */ }
model Department  { /* ... */ }
model Course      { /* ... */ }
model AcademicYear { /* ... */ }
model Semester    { /* ... */ }
model Subject     { /* ... */ }
model SubjectEnrollment { /* userId + subjectId unique */ }
model LecturerAssignment { /* userId + subjectId unique */ }
```

#### Documents (Relational)
```prisma
model Document {
  id            String         @id @default(cuid())
  title         String
  fileName      String
  fileSize      BigInt
  mimeType      String
  documentType  DocumentType
  storagePath   String
  storageBucket String         @default("documents")
  checksum      String
  status        DocumentStatus @default(UPLOADED)
  // ... foreign keys to User, Subject, Project, ResearchNotebook
  chunks        DocumentChunk[]
  versions      DocumentVersion[]
  processingJobs DocumentProcessingJob[]
}
```

#### Conversations & Messages
```prisma
model Conversation {
  id          String   @id @default(cuid())
  userId      String
  projectId   String?
  notebookId  String?
  // Relations to User, Project, ResearchNotebook
  messages    Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  role           String
  content        String   @db.Text
  metadata       Json?
  // Relations to Conversation, User (sender)
}
```

---

## Entity Relationship Diagram (Conceptual)

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│ Institution │──1:M──│ Department       │──1:M──│ Course      │
└─────────────┘       └──────────────────┘       └─────────────┘
                            │                          │
                            │1:M                       │1:M
                            ▼                          ▼
                       ┌─────────────┐            ┌─────────────┐
                       │ Subject     │◄──M:N──────│ Semester    │
                       └─────────────┘            └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │ Enrollment │ │ Assignment │ │ Assessment │
       └────────────┘ └────────────┘ └────────────┘
              │             │             │
              ▼             ▼             ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │   User     │◄──┐  User    │ │   User     │
       └────────────┘   └──────────┘ └────────────┘
              │
              │1:M
              ▼
       ┌────────────┐
       │ Document   │
       └────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
┌────────────┐ ┌────────────┐
│  Chunks    │ │ Processing │
│ (Embeddings)│ │   Jobs     │
└────────────┘ └────────────┘
       │
       ▼
┌────────────┐
│   RAG      │
│  Queries   │
└────────────┘
```

---

## Data Flow Patterns

### 1. Document Processing Pipeline
```
Upload → Storage → createDocument() → confirmUpload() 
  → onDocumentUpload trigger → documentProcessingJobs 
  → Extract Text (pdf-parse/mammoth/Tesseract) 
  → Chunk (chunker.ts) 
  → Embed (OpenAI text-embedding-3-small) 
  → Store in documentChunks 
  → Update Document status = READY
```

### 2. RAG Query Flow
```
User Query → Generate Embedding 
  → Semantic Search (Firestore vector-like query on embedding field) 
  → Top-K Chunks → Build Context 
  → Add Memories + Academic Context + History 
  → Call AI Provider (NVIDIA/OpenAI/Gemini/Anthropic) 
  → Return Answer + Citations 
  → Save to Conversation + Messages
```

### 3. Attendance Marking
```
Lecturer Creates Session → Validates LecturerAssignment 
  → Creates AttendanceSession 
  → Pre-fills AttendanceRecords (ABSENT) for all Enrolled Students 
  → Lecturer Marks Attendance → Batch Update Records 
  → Scheduled Function (Daily 08:00) Calculates Percentages 
  → Creates Notifications for <35% Attendance
```

### 4. AI Credentials Security
```
User Provides API Key → Encrypt (AES-256-GCM with ENCRYPTION_KEY) 
  → Hash (SHA-256 for deduplication) 
  → Store in aiCredentials (Firestore) + AICredential (PostgreSQL) 
  → On Use: Decrypt → Call Provider → Never Log Key
```

---

## Security Rules Summary (Firestore)

Key access patterns enforced in `firebase/firestore.rules`:

| Collection | Read Access | Write Access |
|------------|-------------|--------------|
| `users/{uid}` | Owner, Lecturer/Admin | Owner |
| `documents/{id}` | Owner, Enrolled in subject, Project member, Notebook owner | Owner |
| `documentChunks/{id}` | Owner of parent document, Enrolled in subject | Owner of parent document |
| `conversations/{id}` | Owner | Owner |
| `messages/{id}` | Owner of conversation | Owner (user messages only) |
| `projects/{id}` | Owner, Project member | Owner |
| `attendanceSessions/{id}` | Lecturer/Admin, Enrolled students | Lecturer/Admin |
| `attendanceRecords/{id}` | Student (own), Lecturer/Admin | Lecturer/Admin |
| `assessments/{id}` | Lecturer/Admin, Enrolled (if published) | Lecturer/Admin |
| `assessmentResults/{id}` | Student (own), Lecturer/Admin | Lecturer/Admin |
| `assignments/{id}` | Lecturer/Admin, Enrolled (if published) | Lecturer/Admin |
| `studentAchievements/{id}` | Owner, Lecturer/Admin | Owner (create), Lecturer/Admin (verify) |
| `aiCredentials/{id}` | Owner | Owner |
| `notifications/{id}` | Owner | Owner |

Helper Functions:
- `isSignedIn()` - `request.auth != null`
- `isOwner(userId)` - `request.auth.uid == userId`
- `isLecturerOrAdmin(userId)` - Check user document role
- `isEnrolledInSubject(userId, subjectId)` - Check subjectEnrollments
- `isProjectMember(userId, projectId)` - Check projectMembers
- `isNotebookOwner(userId, notebookId)` - Check researchNotebooks

---

## Indexes Required (Firestore)

Defined in `firebase/firestore.indexes.json` (39,895 bytes - many composite indexes):

Key composite indexes:
- `documentChunks`: `ownerId + embedding != null + subjectId/projectId/notebookId/documentId`
- `conversations`: `userId + updatedAt desc`
- `messages`: `conversationId + createdAt desc`
- `notifications`: `userId + isRead + createdAt desc`
- `attendanceSessions`: `subjectId + date + period`
- `subjectEnrollments`: `userId + subjectId` (unique)
- `projectMembers`: `projectId + userId` (unique)

---

## Migration Strategy

### From Legacy SQLite (Documented in `docs/legacy-sqlite/`)
- `schema.sqlite.prisma` - Old Prisma schema
- `seed.sqlite.ts` - Old seed data

### Current: PostgreSQL + Firestore
- Prisma migrations in `apps/web/prisma/migrations/`
- Firestore indexes managed via `firebase deploy --only firestore:indexes`
- No automatic sync between databases - each serves distinct purposes

---

## Data Retention & Cleanup

| Data Type | Retention | Cleanup Mechanism |
|-----------|-----------|-------------------|
| Notifications (read) | 30 days | `scheduledCleanup` daily at 02:00 UTC |
| Document Processing Jobs | Until document READY | Manual/automatic on completion |
| Chat Messages | Indefinite | User can delete conversations |
| Audit Logs | Indefinite | Compliance requirement |
| Attendance Records | Indefinite | Academic record |
| Assessment Results | Indefinite | Academic record |

---

## Backup & Disaster Recovery

- **Firestore**: Automatic managed backups (if enabled), Point-in-time recovery
- **PostgreSQL**: Depends on hosting provider (Cloud SQL, Supabase, etc.)
- **Firebase Storage**: Versioning enabled for document recovery
- **Secrets**: Firebase Secret Manager with rotation policy