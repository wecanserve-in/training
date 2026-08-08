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
| Backend | Firebase Authentication, Firebase Realtime Database |
| Storage | AWS S3 (video/file uploads) |
| PDF | jsPDF, html2canvas |
| Excel | SheetJS (xlsx) |
| PWA | Service Worker, Manifest |
| Deployment | Vercel |

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
VITE_DEFAULT_PASSWORD=portal@123
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
