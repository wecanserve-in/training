import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/departmentadmin.css";

function DepartmentAdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [videos, setVideos] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedUser) => {
      if (!loggedUser) {
        setLoading(false);
        return;
      }

      try {
        const userSnap = await get(ref(database, `users/${loggedUser.uid}`));

        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }

        const userData = {
          id: loggedUser.uid,
          email: loggedUser.email,
          ...userSnap.val(),
        };

        setCurrentUser(userData);

        const departmentName = userData.department || "";

        const [
          usersSnap,
          coursesSnap,
          videosSnap,
          assignmentsSnap,
          completedSnap,
          resultsSnap,
        ] = await Promise.all([
          get(ref(database, "users")),
          get(ref(database, "courses")),
          get(ref(database, "videos")),
          get(ref(database, "assignments")),
          get(ref(database, "completedCourses")),
          get(ref(database, "results")),
        ]);

        const allUsers = usersSnap.exists()
          ? Object.entries(usersSnap.val()).map(([id, user]) => ({
              id,
              ...user,
            }))
          : [];

        const departmentMembers = allUsers.filter(
          (user) =>
            user.department === departmentName && user.role !== "superAdmin"
        );

        const allCourses = coursesSnap.exists()
          ? Object.entries(coursesSnap.val()).map(([id, course]) => ({
              id,
              ...course,
            }))
          : [];

        const departmentCourses = allCourses.filter(
          (course) =>
            course.department === departmentName ||
            course.createdBy === loggedUser.uid ||
            course.createdById === loggedUser.uid
        );

        const departmentCourseIds = departmentCourses.map((course) => course.id);

        const allVideos = videosSnap.exists()
          ? Object.entries(videosSnap.val()).map(([id, video]) => ({
              id,
              ...video,
            }))
          : [];

        const departmentVideos = allVideos.filter(
          (video) =>
            departmentCourseIds.includes(video.courseId) ||
            video.department === departmentName ||
            video.createdBy === loggedUser.uid ||
            video.createdById === loggedUser.uid
        );

        const allAssignments = assignmentsSnap.exists()
          ? Object.entries(assignmentsSnap.val()).map(([id, assignment]) => ({
              id,
              ...assignment,
            }))
          : [];

        const departmentAssignments = allAssignments.filter((assignment) => {
          return (
            assignment.department === departmentName ||
            assignment.createdBy === loggedUser.uid ||
            assignment.createdById === loggedUser.uid ||
            departmentCourseIds.includes(assignment.courseId)
          );
        });

        setMembers(departmentMembers);
        setCourses(departmentCourses);
        setVideos(departmentVideos);
        setAssignments(departmentAssignments);
        setCompletedCourses(completedSnap.exists() ? completedSnap.val() : {});
        setResults(resultsSnap.exists() ? resultsSnap.val() : {});
      } catch (error) {
        alert(error.message);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getCompletedCount = (userId) => {
    if (!completedCourses[userId]) return 0;

    const departmentCourseIds = courses.map((course) => course.id);

    return Object.keys(completedCourses[userId]).filter((courseId) =>
      departmentCourseIds.includes(courseId)
    ).length;
  };

  const getCertificateCount = (userId) => {
    if (!results[userId]) return 0;

    const departmentCourseIds = courses.map((course) => course.id);

    return Object.entries(results[userId]).filter(([courseId, result]) => {
      return departmentCourseIds.includes(courseId) && result.passed;
    }).length;
  };

  const totalCompleted = members.reduce(
    (total, member) => total + getCompletedCount(member.id),
    0
  );

  const totalCertificates = members.reduce(
    (total, member) => total + getCertificateCount(member.id),
    0
  );

  const totalAssignedTrainings = assignments.length;

  const pendingTrainings = Math.max(totalAssignedTrainings - totalCompleted, 0);

  const completionRate =
    totalAssignedTrainings > 0
      ? Math.min(Math.round((totalCompleted / totalAssignedTrainings) * 100), 100)
      : 0;

  const latestCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [courses]);

  const usersNeedingFollowUp = useMemo(() => {
    return members
      .map((member) => {
        const completed = getCompletedCount(member.id);
        const completion =
          courses.length > 0 ? Math.round((completed / courses.length) * 100) : 0;

        return {
          ...member,
          completed,
          completion,
        };
      })
      .filter((member) => member.completion < 100)
      .sort((a, b) => a.completion - b.completion)
      .slice(0, 5);
  }, [members, courses, completedCourses]);

  const courseRows = useMemo(() => {
    return courses.slice(0, 6).map((course) => {
      const completed = members.filter((member) => {
        return completedCourses[member.id]?.[course.id];
      }).length;

      const assigned = members.length;
      const pending = Math.max(assigned - completed, 0);
      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return {
        id: course.id,
        title: course.title || course.courseName || course.name || "Untitled Course",
        assigned,
        completed,
        pending,
        rate,
      };
    });
  }, [courses, members, completedCourses]);

  const downloadReport = () => {
    const rows = members.map((member) => {
      const completed = getCompletedCount(member.id);
      const certificates = getCertificateCount(member.id);
      const completion =
        courses.length > 0 ? Math.round((completed / courses.length) * 100) : 0;

      return {
        Name: member.name || "",
        Email: member.email || "",
        Designation: member.designation || "",
        Seniority: member.seniority || "",
        Department: currentUser?.department || "",
        City: member.cityArea || "",
        State: member.state || "",
        Zone: member.zone || "",
        "Total Courses": courses.length,
        "Completed Trainings": completed,
        Certificates: certificates,
        "Completion %": `${completion}%`,
      };
    });

    const headers = Object.keys(
      rows[0] || {
        Name: "",
        Email: "",
        Designation: "",
        Seniority: "",
        Department: "",
        City: "",
        State: "",
        Zone: "",
        "Total Courses": "",
        "Completed Trainings": "",
        Certificates: "",
        "Completion %": "",
      }
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] || "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `department-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="dept-dashboard-page">
        <div className="dept-large-card">
          <h2>Loading dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-dashboard-page">
      <div className="dept-dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <h2>Welcome back, {currentUser?.name || "Department Admin"}</h2>
          <p>
            Real-time overview for{" "}
            <strong>{currentUser?.department || "your department"}</strong>.
          </p>
        </div>

        <div className="dept-header-actions">
          <button onClick={downloadReport}>Export Report</button>
        </div>
      </div>

      <div className="dept-kpi-grid">
        <div className="dept-kpi-card">
          <span>Total Courses Created</span>
          <h3>{courses.length}</h3>
         
        </div>

        <div className="dept-kpi-card">
          <span>Total Videos Uploaded</span>
          <h3>{videos.length}</h3>
          
        </div>

        <div className="dept-kpi-card">
          <span>Total Members Assigned</span>
          <h3>{members.length}</h3>
          
        </div>

        <div className="dept-kpi-card">
          <span>Assigned Trainings</span>
          <h3>{totalAssignedTrainings}</h3>
          
        </div>

        <div className="dept-kpi-card">
          <span>Pending Trainings</span>
          <h3>{pendingTrainings}</h3>
          
        </div>

        <div className="dept-kpi-card">
          <span>Completion Rate</span>
          <h3>{completionRate}%</h3>
          
        </div>
      </div>

      <div className="dept-main-layout">
        <div className="dept-large-card">
          <div className="dept-section-head">
            <h2>Course Progress Overview</h2>
            <Link to="/department-admin/courses">View All</Link>
          </div>

          <div className="dept-table">
            <div className="dept-table-head">
              <span>Course Name</span>
              <span>Assigned</span>
              <span>Completed</span>
              <span>Pending</span>
              <span>Completion</span>
            </div>

            {courseRows.map((course) => (
              <div className="dept-table-row" key={course.id}>
                <strong>{course.title}</strong>
                <span>{course.assigned}</span>
                <span>{course.completed}</span>
                <span>{course.pending}</span>
                <div className="dept-progress-line">
                  <b>{course.rate}%</b>
                  <div>
                    <span style={{ width: `${course.rate}%` }}></span>
                  </div>
                </div>
              </div>
            ))}

            {courseRows.length === 0 && (
              <div className="dept-empty-row">No courses created yet.</div>
            )}
          </div>

          <Link to="/department-admin/courses" className="dept-outline-btn">
            View All Courses
          </Link>
        </div>

        <div className="dept-side-column">
          <div className="dept-small-card">
            <div className="dept-section-head">
              <h2>Quick Actions</h2>
            </div>

            <div className="dept-quick-actions">
              <Link to="/department-admin/courses/create">Create Course</Link>
              <Link to="/department-admin/assignments">Assign Course</Link>
              <Link to="/department-admin/members">View Members</Link>
              <Link to="/department-admin/courses">Manage Courses</Link>
            </div>
          </div>

          <div className="dept-small-card">
            <div className="dept-section-head">
              <h2>Needs Follow-up</h2>
            </div>

            <div className="dept-follow-list">
              {usersNeedingFollowUp.map((member) => (
                <div className="dept-follow-row" key={member.id}>
                  <div>
                    <strong>{member.name || "Unnamed User"}</strong>
                    <span>{member.designation || "No designation"}</span>
                  </div>
                  <b>{member.completion}%</b>
                </div>
              ))}

              {usersNeedingFollowUp.length === 0 && (
                <p className="dept-empty-text">All members are fully completed.</p>
              )}
            </div>
          </div>

          <div className="dept-small-card">
            <h2>Access Scope</h2>
            <p>You can manage only users, courses and reports linked to:</p>
            <strong>{currentUser?.department || "Your Department"}</strong>
          </div>
        </div>
      </div>

      <div className="dept-large-card">
        <div className="dept-section-head">
          <h2>Latest Courses</h2>
          <Link to="/department-admin/courses">Manage Courses</Link>
        </div>

        <div className="dept-follow-list">
          {latestCourses.map((course) => (
            <div className="dept-follow-row" key={course.id}>
              <div>
                <strong>
                  {course.title || course.courseName || course.name || "Untitled Course"}
                </strong>
                <span>{course.department || currentUser?.department || "Department Course"}</span>
              </div>
              <b>{course.status || "Active"}</b>
            </div>
          ))}

          {latestCourses.length === 0 && (
            <p className="dept-empty-text">No latest courses available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentAdminDashboard;