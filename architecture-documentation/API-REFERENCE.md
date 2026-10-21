# ALEX API Reference

This document catalogs all discovered API endpoints and callable functions in the ALEX platform.

---

## Frontend API Routes (Next.js `/app-api/api/*`)

These are Next.js server-side API routes that use Prisma/PostgreSQL for data access.

### Authentication

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| POST | `/api/auth/login` | None (Local) | User login with email/password | `apps/web/src/app-api/api/auth/login/route.ts` |
| POST | `/api/auth/register` | None (Local) | User registration | `apps/web/src/app-api/api/auth/register/route.ts` |
| POST | `/api/auth/logout` | Cookie | User logout | `apps/web/src/app-api/api/auth/logout/route.ts` |
| GET | `/api/auth/callback` | None | OAuth callback | `apps/web/src/app-api/api/auth/callback/route.ts` |

### Documents

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/documents` | Supabase | List user's documents with filters | `apps/web/src/app-api/api/documents/route.ts` |
| POST | `/api/documents` | Supabase | Create document record + get signed upload URL | `apps/web/src/app-api/api/documents/route.ts` |
| GET | `/api/documents/[id]` | Supabase | Get document details + chunks + jobs | `apps/web/src/app-api/api/documents/[id]/route.ts` |
| PATCH | `/api/documents/[id]` | Supabase | Update document metadata | `apps/web/src/app-api/api/documents/[id]/route.ts` |
| DELETE | `/api/documents/[id]` | Supabase | Delete document + chunks + jobs | `apps/web/src/app-api/api/documents/[id]/route.ts` |
| POST | `/api/documents/[id]/retry` | Supabase | Retry failed document processing | `apps/web/src/app-api/api/documents/[id]/retry/route.ts` |

### AI & Chat

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| POST | `/api/ai/chat` | Supabase | Send message to AI (general) | `apps/web/src/app-api/api/ai/chat/route.ts` |
| POST | `/api/rag/query` | Supabase | RAG query with document context | `apps/web/src/app-api/api/rag/query/route.ts` |
| GET | `/api/ai/models` | Supabase | List available AI models | `apps/web/src/app-api/api/ai/models/route.ts` |
| POST | `/api/ai/test-connection` | Supabase | Test AI provider connection | `apps/web/src/app-api/api/ai/test-connection/route.ts` |
| GET | `/api/ai/voice-config` | Supabase | Get voice assistant config | `apps/web/src/app-api/api/ai/voice-config/route.ts` |

### AI Credentials

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/ai/credentials` | Supabase | List user's AI credentials (no keys) | `apps/web/src/app-api/api/ai/credentials/route.ts` |
| POST | `/api/ai/credentials` | Supabase | Add new AI credential (encrypts key) | `apps/web/src/app-api/api/ai/credentials/route.ts` |
| PATCH | `/api/ai/credentials/[id]` | Supabase | Update credential (set default, etc.) | `apps/web/src/app-api/api/ai/credentials/[id]/route.ts` |
| DELETE | `/api/ai/credentials/[id]` | Supabase | Delete AI credential | `apps/web/src/app-api/api/ai/credentials/[id]/route.ts` |

### Assignments

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/assignments` | Supabase | List assignments (lecturer view) | `apps/web/src/app-api/api/assignments/route.ts` |
| POST | `/api/assignments` | Supabase | Create assignment (lecturer) | `apps/web/src/app-api/api/assignments/route.ts` |
| GET | `/api/assignments/my` | Supabase | List student's assignments | `apps/web/src/app-api/api/assignments/my/route.ts` |
| POST | `/api/assignments/submit` | Supabase | Submit assignment | `apps/web/src/app-api/api/assignments/submit/route.ts` |
| GET | `/api/assignments/[id]/submissions` | Supabase | List submissions for assignment | `apps/web/src/app-api/api/assignments/[id]/submissions/route.ts` |

### Assessments

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/assessments` | Supabase | List assessments (lecturer) | `apps/web/src/app-api/api/assessments/route.ts` |
| POST | `/api/assessments` | Supabase | Create assessment (lecturer) | `apps/web/src/app-api/api/assessments/route.ts` |
| GET | `/api/assessments/my` | Supabase | List student's assessments | `apps/web/src/app-api/api/assessments/my/route.ts` |
| GET | `/api/assessments/[id]` | Supabase | Get assessment details | `apps/web/src/app-api/api/assessments/[id]/route.ts` |
| GET | `/api/assessments/[id]/results` | Supabase | Get assessment results | `apps/web/src/app-api/api/assessments/[id]/results/route.ts` |

### Attendance

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/attendance/sessions` | Supabase | List attendance sessions | `apps/web/src/app-api/api/attendance/sessions/route.ts` |
| POST | `/api/attendance/sessions` | Supabase | Create session (lecturer) | `apps/web/src/app-api/api/attendance/sessions/route.ts` |
| POST | `/api/attendance/mark` | Supabase | Mark attendance records (lecturer) | `apps/web/src/app-api/api/attendance/mark/route.ts` |
| GET | `/api/attendance/my` | Supabase | Get student's attendance summary | `apps/web/src/app-api/api/attendance/my/route.ts` |
| GET | `/api/attendance/reports` | Supabase | Get attendance reports (lecturer) | `apps/web/src/app-api/api/attendance/reports/route.ts` |
| POST | `/api/attendance/edit` | Supabase | Edit attendance record (lecturer) | `apps/web/src/app-api/api/attendance/edit/route.ts` |
| GET | `/api/attendance/periodic-reports` | Supabase | Get periodic attendance reports | `apps/web/src/app-api/api/attendance/periodic-reports/route.ts` |
| GET | `/api/attendance/alerts` | Supabase | Get attendance alerts | `apps/web/src/app-api/api/attendance/alerts/route.ts` |

### Planner

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/planner/events` | Supabase | List planner events | `apps/web/src/app-api/api/planner/events/route.ts` |
| POST | `/api/planner/events` | Supabase | Create planner event | `apps/web/src/app-api/api/planner/events/route.ts` |

### Projects

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/projects` | Supabase | List user's projects | `apps/web/src/app-api/api/projects/route.ts` |
| POST | `/api/projects` | Supabase | Create project | `apps/web/src/app-api/api/projects/route.ts` |

### Notifications

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/notifications` | Supabase | List notifications | `apps/web/src/app-api/api/notifications/route.ts` |
| PATCH | `/api/notifications` | Supabase | Mark notification read | `apps/web/src/app-api/api/notifications/route.ts` |
| GET | `/api/notifications/preferences` | Supabase | Get notification preferences | `apps/web/src/app-api/api/notifications/preferences/route.ts` |
| PATCH | `/api/notifications/preferences` | Supabase | Update notification preferences | `apps/web/src/app-api/api/notifications/preferences/route.ts` |

### Achievements

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| GET | `/api/achievements` | Supabase | List achievements | `apps/web/src/app-api/api/achievements/route.ts` |
| POST | `/api/achievements` | Supabase | Create achievement | `apps/web/src/app-api/api/achievements/route.ts` |

### Diagrams

| Method | Endpoint | Auth | Description | Handler |
|--------|----------|------|-------------|---------|
| POST | `/api/diagrams/generate` | Supabase | Generate diagram from text | `apps/web/src/app-api/api/diagrams/generate/route.ts` |
| POST | `/api/diagrams/render` | Supabase | Render diagram to image | `apps/web/src/app-api/api/diagrams/render/route.ts` |
| GET | `/api/diagrams/templates` | Supabase | Get diagram templates | `apps/web/src/app-api/api/diagrams/templates/route.ts` |

---

## Backend Callable Functions (Firebase Functions Gen 2)

These are HTTPS Callable Functions deployed to Firebase, invoked directly from the frontend via the Firebase Functions SDK. All require authentication (`request.auth`).

### User Functions (`functions/src/user.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createUserProfile` | `{firstName, lastName, email, role, institutionId?, departmentId?, courseId?, semesterId?}` | `{success: true}` | Create user profile in Firestore |
| `getUserProfile` | `{}` | `{id, ...userData}` | Get current user's profile |
| `updateUserProfile` | `{updates...}` | `{success: true}` | Update profile (excludes uid, email, role) |
| `getUsersByRole` | `{role, institutionId?, limit?}` | `{users[]}` | Admin/Lecturer: list users by role |
| `setUserRole` | `{userId, role}` | `{success: true}` | Admin: change user role |
| `deactivateUser` | `{userId}` | `{success: true}` | Admin: deactivate user + revoke tokens |

### Document Functions (`functions/src/document.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createDocument` | `{title, description?, subjectId?, projectId?, notebookId?, fileName, mimeType, fileSize}` | `{documentId, uploadUrl}` | Create document + get signed upload URL |
| `confirmUpload` | `{documentId, checksum}` | `{success: true}` | Confirm upload, queue for processing |
| `getDocuments` | `{subjectId?, projectId?, notebookId?, status?, limit?, cursor?}` | `{documents[], nextCursor}` | List user's documents with filters |
| `getDocument` | `{documentId}` | `{id, ...docData}` | Get single document |
| `deleteDocument` | `{documentId}` | `{success: true}` | Delete document + storage file + chunks |
| `retryProcessing` | `{documentId}` | `{success: true}` | Retry failed document processing |
| `getSignedDownloadUrl` | `{documentId}` | `{url}` | Get signed download URL (access control) |

### RAG Functions (`functions/src/rag.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `search` | `{query, subjectId?, projectId?, notebookId?, documentIds?, limit?, threshold?}` | `{chunks[]}` | Semantic search in user's documents |
| `semanticSearch` | `{query, subjectId?, projectId?, notebookId?, documentIds?, limit?, threshold?}` | `{chunks[]}` | Alias for search |
| `ragQuery` | `{query, subjectId?, projectId?, notebookId?, documentIds?, limit?, threshold?, stream?}` | `{answer, citations[], sources[]}` | Full RAG query with AI answer generation |
| `getDocumentChunks` | `{documentId}` | `{chunks[]}` | Get all chunks for a document |

### AI Functions (`functions/src/ai.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `sendMessage` | `{message, conversationId?, subjectId?, projectId?, notebookId?, documentIds?, stream?}` | `{conversationId, messageId, answer}` | Send chat message, optionally with RAG |
| `getConversations` | `{}` | `{conversations[]}` | List user's conversations |
| `getConversationMessages` | `{conversationId, limit?, cursor?}` | `{messages[]}` | Get messages for a conversation |
| `deleteConversation` | `{conversationId}` | `{success: true}` | Delete conversation |
| `addCredential` | `{provider, providerName, apiKey, isDefault?}` | `{success: true}` | Add AI credential (encrypts key) |
| `getCredentials` | `{}` | `{credentials[]}` | List user's AI credentials (no keys) |
| `deleteCredential` | `{credentialId}` | `{success: true}` | Delete AI credential |
| `testConnection` | `{provider, apiKey}` | `{success, error?}` | Test AI provider connection |

### Study Functions (`functions/src/study.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createStudyMaterial` | `{title, content, type, sourceDocId?, subjectId?, topic?, tags?}` | `{id}` | Create study material note |
| `getStudyMaterials` | `{subjectId?, type?, limit?}` | `{materials[]}` | List study materials |
| `generateNotes` | `{sourceDocId, type}` | `{id, content}` | AI-generate notes from document |
| `createFlashcardDeck` | `{title, description?, subjectId?, sourceDocId?, cards[{front, back}]}` | `{deckId}` | Create flashcard deck with SM2 init |
| `getFlashcardDecks` | `{subjectId?}` | `{decks[]}` | List flashcard decks |
| `getFlashcardsForReview` | `{deckId}` | `{cards[]}` | Get due cards for SM2 review |
| `reviewFlashcard` | `{cardId, rating}` | `{success: true}` | Submit SM2 review rating |
| `generateQuiz` | `{sourceDocId, numQuestions, difficulty}` | `{quizId, questions[]}` | AI-generate quiz from document |

### Planner Functions (`functions/src/planner.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createEvent` | `{title, description?, startTime, endTime, allDay?, eventType, subjectId?, taskId?}` | `{id}` | Create planner event |
| `getEvents` | `{startDate?, endDate?}` | `{events[]}` | Get events in date range |
| `createTask` | `{title, description?, dueDate?, priority?}` | `{id}` | Create task |
| `getTasks` | `{status?}` | `{tasks[]}` | Get tasks (filter by status) |
| `updateTask` | `{taskId, updates...}` | `{success: true}` | Update task |
| `generateStudyPlan` | `{goals, availableHours, subjects[], startDate, endDate}` | `{planId, plan}` | AI-generate study plan |
| `getDailyBriefing` | `{}` | `{events[], tasks[], assessments[], assignments[]}` | Get today's briefing |

### Research Functions (`functions/src/research.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createNotebook` | `{title, description?, projectId?, isPublic?}` | `{notebookId}` | Create research notebook |
| `getNotebooks` | `{}` | `{notebooks[]}` | List user's notebooks |
| `getNotebook` | `{notebookId}` | `{id, ...data}` | Get notebook (owner or public) |
| `addSource` | `{notebookId, documentId?, title, authors?, publicationYear?, doi?, url?}` | `{sourceId}` | Add bibliographic source |
| `getSources` | `{notebookId}` | `{sources[]}` | List notebook sources |
| `createNote` | `{notebookId, title, content, sourceIds?, tags?}` | `{noteId}` | Create research note |
| `getNotes` | `{notebookId}` | `{notes[]}` | List notebook notes |
| `generateLiteratureReview` | `{notebookId}` | `{noteId, review}` | AI-generate literature review |
| `analyzePaper` | `{sourceId}` | `{noteId, analysis}` | AI-analyze research paper |

### Project Functions (`functions/src/project.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createProject` | `{title, description?, category?, tags?, startDate?, endDate?}` | `{projectId}` | Create project + add owner as member |
| `getProjects` | `{}` | `{projects[]}` | List owned + member projects |
| `getProject` | `{projectId}` | `{id, ...data}` | Get project (owner or member) |
| `addMember` | `{projectId, userId, role?}` | `{success: true}` | Owner: add project member |
| `createTask` | `{projectId, title, description?, assigneeId?, dueDate?, priority?}` | `{taskId}` | Create project task |
| `getTasks` | `{projectId, status?}` | `{tasks[]}` | List project tasks |
| `updateTask` | `{taskId, updates...}` | `{success: true}` | Update task (owner/assignee/creator) |
| `createMilestone` | `{projectId, title, description?, dueDate}` | `{milestoneId}` | Owner: create milestone |

### Attendance Functions (`functions/src/attendance.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createSession` | `{subjectId, semesterId, date, period, topic?}` | `{sessionId}` | Lecturer: create session + pre-fill ABSENT |
| `getSessions` | `{subjectId?, startDate?, endDate?}` | `{sessions[]}` | List attendance sessions |
| `markAttendance` | `{sessionId, records[{userId, status}]}` | `{success: true}` | Lecturer: mark attendance batch |
| `getMyAttendance` | `{}` | `{subjects[], overallPercentage, totals}` | Student: attendance summary |

### Assessment Functions (`functions/src/assessment.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createAssessment` | `{subjectId, semesterId, name, type, maxMarks, weight, assessmentDate, description?, isPublished?}` | `{assessmentId}` | Lecturer: create assessment |
| `getAssessments` | `{subjectId?, semesterId?}` | `{assessments[]}` | List assessments |
| `getAssessment` | `{assessmentId}` | `{id, ...data}` | Get assessment |
| `updateAssessment` | `{assessmentId, updates...}` | `{success: true}` | Lecturer: update assessment |
| `publishAssessment` | `{assessmentId}` | `{success: true}` | Lecturer: publish assessment |
| `gradeAssessment` | `{assessmentId, results[{userId, marksObtained, feedback?}]}` | `{success: true}` | Lecturer: grade assessments |
| `getMyAssessments` | `{}` | `{assessments[]}` | Student: list published assessments |
| `getMyResults` | `{}` | `{results[]}` | Student: list assessment results |

### Assignment Functions (`functions/src/assignment.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createAssignment` | `{subjectId, title, description?, instructions?, maxMarks, weight, assignedDate, dueDate, allowedFormats?, allowResubmission?, maxSubmissions?, isPublished?}` | `{assignmentId}` | Lecturer: create assignment |
| `getAssignments` | `{subjectId?}` | `{assignments[]}` | List assignments |
| `getAssignment` | `{assignmentId}` | `{id, ...data}` | Get assignment |
| `submitAssignment` | `{assignmentId, content?, attachments?}` | `{submissionId}` | Student: submit assignment |
| `getSubmissions` | `{assignmentId}` | `{submissions[]}` | Lecturer: list submissions |
| `gradeSubmission` | `{submissionId, marksObtained, feedback?, gradedBy}` | `{success: true}` | Lecturer: grade submission |

### Achievement Functions (`functions/src/achievement.ts`)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createAchievement` | `{title, category, organization?, startDate?, endDate?, description?, status?, verificationStatus?, certificateUrl?, metadata?}` | `{achievementId}` | Create achievement |
| `getAchievements` | `{userId?}` | `{achievements[]}` | List achievements (own or lecturer view) |
| `verifyAchievement` | `{achievementId, verificationStatus, verifiedBy}` | `{success: true}` | Lecturer: verify achievement |

---

## Authentication Requirements

### Frontend API Routes
- **Supabase Auth**: Uses `@supabase/supabase-js` client/server
- **Session Cookie**: `alex_local_session` (HMAC-signed, 7-day expiry)
- **Middleware Protection**: `apps/web/src/app/middleware.ts` protects `/dashboard/*` and non-public `/api/*` routes

### Backend Callable Functions
- **Firebase Auth**: All functions verify `request.auth` (Firebase UID)
- **Custom Claims**: Role checked via Firestore `users/{uid}` document
- **Permission Checks**: Explicit in each function (owner, role, enrollment, project membership)

### Firestore Security Rules
- Defined in `firebase/firestore.rules`
- Enforce ownership, role-based access, enrollment-based access
- Helper functions: `isOwner()`, `isLecturerOrAdmin()`, `isEnrolledInSubject()`, `isProjectMember()`, `isNotebookOwner()`

---

## Error Response Format

### Frontend API Routes
```json
{
  "error": "Error message",
  "status": 400
}
```

### Backend Callable Functions
```json
{
  "code": "unauthenticated|permission-denied|not-found|failed-precondition|already-exists|internal",
  "message": "Human-readable error",
  "details": {}
}
```

---

## Rate Limiting

- **Frontend API**: Token bucket rate limiter (`apps/web/src/lib/rate-limiter.ts`)
- **Firebase Functions**: Built-in Firebase Functions rate limiting
- **AI Providers**: Per-provider rate limits handled in function logic

---

## WebSocket / Real-time

- **Firestore Real-time Listeners**: Used for notifications, chat messages, presence
- **Firebase Functions**: No persistent WebSocket connections (stateless HTTPS Callable)
- **Supabase Realtime**: Not currently used (Supabase client only for auth)