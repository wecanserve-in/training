# Zuvius Learning Portal

A modern Learning Management System (LMS) built for **Zuvius Lifesciences** to deliver employee training, assessments, certification, and progress tracking.

**Live:** [https://learnings.zuviuslifesciences.in/](https://learnings.zuviuslifesciences.in/)

---

## About

The Zuvius Learning Portal enables employees to access training modules, watch instructional videos, complete assessments, and earn certificates upon successful completion.

Administrators can manage training content, upload courses, create assessments manually or through Excel imports, monitor employee performance, and track certification statistics through a centralized dashboard.

---

## Features

### Employee Portal

- Secure Authentication with role-based access
- Training Dashboard with progress overview
- Video-Based Learning Modules with resume playback
- Progress Tracking across courses
- Assessment System with timer and one-time attempts
- Result History and performance analytics
- Certificate Generation and download
- Responsive Mobile-Friendly Interface
- PWA Installable App

### Smart Video Tracking

- Tracks actual watch progress in real-time
- Prevents quiz unlocking through video skipping
- Saves progress automatically
- Resumes playback from the last watched position
- Tracks completion percentage per video

### Assessment Engine

- Multiple Choice Questions
- Configurable Passing Scores
- Timer-Based Assessments
- One-Time Quiz Attempts
- Automatic Scoring and Instant Results

### Certificate Management

- Automatic Certificate Generation on course completion
- Downloadable PDF Certificates
- Performance Records
- Completion Verification

### Admin Portal

- Dashboard Analytics with department-wise and zone-wise stats
- User Management (Add, Edit, Delete, Bulk Upload via Excel)
- Course Management with video assignments
- Question Bank Management (Manual + Bulk Excel Import)
- Assessment Monitoring
- Department Admin Assignment
- Training Assignment to users or departments

### Department Admin Portal

- Department-scoped dashboard
- View and manage department members
- Track department training progress
- Assign courses to department users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v7, Vite |
| Styling | CSS3 |
| Backend | Firebase Authentication, Firebase Realtime Database, small PHP API (`public/api`) |
| Storage | Cloudflare R2 (uploads via short-lived signed links from the API) |
| PDF | jsPDF, html2canvas |
| Excel | SheetJS (xlsx) |
| PWA | Service Worker, Manifest |
| Hosting | Hostinger (static site + PHP) |
| Tests | Node test runner, Firebase emulators, Playwright |

---

## Project Structure

```
src/
├── components/          # Layout wrappers, auth guards, sidebar menus
│   ├── SuperAdminLayout.jsx
│   ├── AdminLayout.jsx
│   ├── DepartmentAdminLayout.jsx
│   ├── UserLayout.jsx
│   ├── ProtectedRoute.jsx
│   └── RoleRoute.jsx
│
├── pages/               # All page-level components
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── SuperAdminDashboard.jsx
│   ├── AdminDashboard.jsx
│   ├── DepartmentAdminDashboard.jsx
│   ├── ManageUsers.jsx
│   ├── ManageAdmins.jsx
│   ├── ManageDepartments.jsx
│   ├── AddCourse.jsx
│   ├── EditCourse.jsx
│   ├── VideoPage.jsx
│   ├── QuizPage.jsx
│   ├── ResultPage.jsx
│   ├── Certificates.jsx
│   ├── Profile.jsx
│   └── ...
│
├── services/            # Firebase path helpers, deletion service
├── utils/               # Training analytics helpers
├── lib/                 # User access & role logic
├── hooks/               # Custom React hooks
├── data/                # Master data (locations)
├── styles/              # Component-specific CSS files
├── firebase.js          # Firebase initialization
└── App.jsx              # Route definitions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Authentication and Realtime Database enabled

### Installation

```bash
git clone https://github.com/AnandDangiWecanserve/lms-portal-final.git
cd lms-portal-final
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Fill in your Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_DEFAULT_PASSWORD=choose_a_strong_temporary_password
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Server API (`public/api`)

A few things must not run in the browser, so they live in small PHP files deployed with the site:

| Endpoint | Who | What |
|---|---|---|
| `upload-url.php` | Staff (any user for their profile photo) | Returns a signed R2 upload link. Storage keys never reach the browser. |
| `quiz.php` | Assigned learners, staff | Final test questions **without answers** |
| `submit-quiz.php` | Assigned learners, staff | Grades the final test and saves the result, progress, completion and notifications |
| `delete-user.php` | Admins (super admin for admins) | Deletes a login account and all of its data |

Every call sends the user's Firebase ID token; the server checks it with Google and reads the role from `users/{uid}/role`.

Secrets live in `public_html/lms-private/config.php` on the server (next to the `learnings` folder, never inside it and never in git). See `server/config.example.php`.

## Security Rules

`database.rules.json` is generated: edit `scripts/build-rules.mjs`, then run `npm run build:rules`.

- Everyone signed in can read course content; only staff (super admin, admin, department admin) can change it.
- Final test questions (answers) are readable by staff only.
- Learners write only their own video progress, activity and practice quizzes. Final results and certificates are written by the server.
- Users can edit their own profile but not their role, department or other protected fields.

## Tests

Needs Java 11+ (for the Firebase emulators), PHP 8 with curl and openssl, and `npm i -g firebase-tools`.

```bash
npm test            # everything
npm run test:rules  # database rules (28 tests)
npm run test:api    # PHP API against the emulators (21 tests)
npm run test:e2e    # browser tests: every page for every role, quiz → certificate, phone layouts
```

Set `PHP_BIN` if `php` is not on your PATH. The tests use only local emulators and fake data.

## Deploying

1. `npm run build`, then upload the contents of `dist/` (it includes `api/` and `.htaccess`) to `public_html/learnings`.
2. Deploy the rules **after** the new site is live: `firebase deploy --only database`.
3. The server config in `public_html/lms-private/` is not touched by deploys.

---

## Firebase Setup

### Authentication

Enable **Email/Password** authentication in your Firebase console.

### Realtime Database Structure

```
users/
  └── {uid}/
      ├── name, email, role, department, zone, state, ...

departments/
  └── {deptId}/
      ├── departmentName, departmentAdminId, ...

courses/
  └── {courseId}/
      ├── title, status, departmentId, ...

userAssignments/
  └── {uid}/
      └── {courseId}/ { assigned: true, assignedAt: ... }

courseProgress/
  └── {uid}/
      └── {courseId}/ { progressPercentage, completed, ... }

videoProgress/
  └── {uid}/
      └── {courseId}/
          └── {videoId}/ { progressPercentage, completed, ... }

completedCourses/
  └── {uid}/
      └── {courseId}/ { completed: true, completedAt: ... }

attempts/
  └── {uid}/
      └── {courseId}/
          └── {attemptId}/ { score, passed, ... }

certificates/
  └── {uid}/
      └── {courseId}/ { certificateUrl, ... }
```

### User Roles

| Role | Access |
|---|---|
| `superAdmin` | Full platform access, manage all users, departments, courses |
| `admin` | Manage users, courses, view analytics |
| `departmentAdmin` | Department-scoped user and course management |
| `user` | Access assigned courses, take assessments, view certificates |

---

## User Workflow

1. Login with credentials
2. View assigned courses on dashboard
3. Watch training videos (progress saved automatically)
4. Complete required watch time to unlock assessment
5. Attempt the quiz (one-time, timed)
6. View results instantly
7. Download certificate on passing

---

## Admin Workflow

1. Login as Admin / Super Admin
2. Create and manage departments
3. Assign Department Admins
4. Create training courses
5. Upload video content
6. Add questions manually or via Excel bulk import
7. Assign courses to users or departments
8. Monitor results and certification statistics

---

## PWA Support

The portal is installable as a Progressive Web App:

- **Android:** Tap "Install" when prompted or use the download button
- **iOS:** Tap Share → Add to Home Screen

---

## License

This project is proprietary and confidential. Built exclusively for **Zuvius Lifesciences**.

---

**Developed by Anand Dangi (Wecanserve)**
