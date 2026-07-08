# Zuvius Training Portal Version 2

A modern Learning Management System (LMS) built for Zuvius Lifesciences to deliver employee training, assessments, certification, and progress tracking.

---

## Overview

The Zuvius Training Portal enables employees to access training modules, watch instructional videos, complete assessments, and earn certificates upon successful completion.

Administrators can manage training content, upload courses, create assessments manually or through Excel imports, monitor employee performance, and track certification statistics through a centralized dashboard.

---

## Key Features

### Employee Portal

* Secure Authentication
* Training Dashboard
* Video-Based Learning Modules
* Progress Tracking
* Resume Video Playback
* Assessment System
* Result History
* Certificate Generation
* Training Completion Tracking
* Responsive Mobile-Friendly Interface

### Smart Video Tracking

* Tracks actual watch progress
* Prevents quiz unlocking through video skipping
* Saves progress automatically
* Resumes playback from the last watched position
* Tracks completion percentage

### Assessment Engine

* Multiple Choice Questions
* Configurable Passing Scores
* Timer-Based Assessments
* One-Time Quiz Attempts
* Automatic Scoring
* Instant Result Generation

### Certificate Management

* Automatic Certificate Generation
* Downloadable Certificates
* Performance Records
* Completion Verification

### Admin Portal

* Dashboard Analytics
* User Management Statistics
* Training Management
* Question Bank Management
* Assessment Monitoring
* Results Tracking

### Question Management

#### Manual Question Creation

Create questions individually through the admin panel.

#### Bulk Excel Upload

Import multiple questions using Excel templates.

Supported fields:

* Question
* Option A
* Option B
* Option C
* Option D
* Correct Answer

#### Template Download

Administrators can download a predefined Excel template for bulk uploads.

### Video Management

* Create Training Courses
* Manage Video Catalog
* Configure Passing Scores
* Configure Assessment Duration
* Track Course Completion

---

## Technology Stack

### Frontend

* React.js
* React Router
* CSS3
* React Icons

### Backend

* Firebase Authentication
* Firebase Realtime Database

### Additional Libraries

* XLSX (Excel Import)
* FileSaver
* React Router DOM

---

## Project Structure

```text
src/
│
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx
│   ├── VideoPage.jsx
│   ├── QuizPage.jsx
│   ├── ResultPage.jsx
│   ├── MyResults.jsx
│   ├── CertificatePage.jsx
│   │
│   ├── AdminDashboard.jsx
│   ├── AddVideo.jsx
│   ├── AddQuestion.jsx
│   ├── ManageVideos.jsx
│   └── ManageQuestions.jsx
│
├── styles/
│
├── firebase.js
│
└── App.jsx
```

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
```

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build production version:

```bash
npm run build
```

---

## Firebase Configuration

Create a Firebase project and configure:

Create a local environment file from the template and fill in the Firebase values before running the app.

```bash
cp .env.example .env.local
```

Required variables:

* `VITE_FIREBASE_API_KEY`
* `VITE_FIREBASE_AUTH_DOMAIN`
* `VITE_FIREBASE_DATABASE_URL`
* `VITE_FIREBASE_PROJECT_ID`
* `VITE_FIREBASE_STORAGE_BUCKET`
* `VITE_FIREBASE_MESSAGING_SENDER_ID`
* `VITE_FIREBASE_APP_ID`
* `VITE_FIREBASE_MEASUREMENT_ID`

### Authentication

Enable:

* Email/Password Authentication

### Realtime Database

Required collections:

```text
users/
videos/
questions/
attempts/
progress/
completedCourses/
```

The Cloud Function for deleting users now requires a Firebase ID token in the `Authorization: Bearer <token>` header and only allows requests from a `superAdmin` account.

---

## Video Storage

Training videos are stored inside:

```text
public/videos/
```

Example:

```text
public/videos/
├── onboarding.mp4
├── safety-training.mp4
├── compliance-training.mp4
```

---

## User Workflow

1. Login
2. View Available Courses
3. Watch Training Video
4. Complete Required Watch Time
5. Unlock Assessment
6. Attempt Quiz
7. Receive Result
8. Download Certificate (if passed)

---

## Admin Workflow

1. Login as Administrator
2. Create Training Courses
3. Upload Video References
4. Add Questions Manually
5. Import Questions via Excel
6. Monitor Results
7. Track Certification Statistics

---

## Security Features

* Authentication Protected Routes
* Admin Access Controls
* One-Time Quiz Attempts
* Video Completion Validation
* Progress Persistence
* Secure Certificate Generation

---

## SEO

The portal includes:

* Custom Favicon
* Meta Tags
* Open Graph Metadata
* Mobile Optimization

---

## Developed For

**Zuvius Lifesciences**

Employee Learning & Assessment Platform

Built to streamline training delivery, assessment management, and certification workflows across the organization.
