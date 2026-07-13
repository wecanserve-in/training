import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/adminanalytics.css";

function AdminAnalytics() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    zone: "",
    state: "",
    cityArea: "",
    designation: "",
  });

  const [showAllZones, setShowAllZones] = useState(false);
  const [showAllDesignations, setShowAllDesignations] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersSnap, coursesSnap, completedSnap, resultsSnap] =
          await Promise.all([
            get(ref(database, "users")),
            get(ref(database, "courses")),
            get(ref(database, "completedCourses")),
            get(ref(database, "results")),
          ]);

        if (usersSnap.exists()) {
          setUsers(
            Object.entries(usersSnap.val())
              .filter(([_, user]) => user.role !== "superAdmin")
              .map(([id, user]) => ({ id, ...user }))
          );
        }

        if (coursesSnap.exists()) {
          setCourses(
            Object.entries(coursesSnap.val()).map(([id, course]) => ({
              id,
              ...course,
            }))
          );
        }

        if (completedSnap.exists()) setCompletedCourses(completedSnap.val());
        if (resultsSnap.exists()) setResults(resultsSnap.val());
      } catch (e) {
        console.error("Analytics fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const zones = [...new Set(users.map((u) => u.zone).filter(Boolean))];
  const states = [...new Set(users.map((u) => u.state).filter(Boolean))];
  const cities = [...new Set(users.map((u) => u.cityArea).filter(Boolean))];
  const designations = [
    ...new Set(users.map((u) => u.designation).filter(Boolean)),
  ];

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      return (
        (!filters.zone || user.zone === filters.zone) &&
        (!filters.state || user.state === filters.state) &&
        (!filters.cityArea || user.cityArea === filters.cityArea) &&
        (!filters.designation || user.designation === filters.designation)
      );
    });
  }, [users, filters]);

  const getCompletedCount = (userId) =>
    completedCourses[userId] ? Object.keys(completedCourses[userId]).length : 0;

  const getCertificateCount = (userId) => {
    if (!results[userId]) return 0;
    return Object.values(results[userId]).filter((result) => result.passed)
      .length;
  };

  const totalPossible = filteredUsers.length * courses.length;

  const completedTotal = filteredUsers.reduce(
    (sum, user) => sum + getCompletedCount(user.id),
    0
  );

  const certificatesTotal = filteredUsers.reduce(
    (sum, user) => sum + getCertificateCount(user.id),
    0
  );

  const completionRate =
    totalPossible > 0 ? Math.round((completedTotal / totalPossible) * 100) : 0;

  const pendingTrainings = Math.max(totalPossible - completedTotal, 0);

  const buildPerformance = (key) => {
    const values = [...new Set(users.map((u) => u[key]).filter(Boolean))];

    return values.map((value) => {
      const groupUsers = users.filter((u) => u[key] === value);
      const possible = groupUsers.length * courses.length;
      const completed = groupUsers.reduce(
        (sum, user) => sum + getCompletedCount(user.id),
        0
      );

      return {
        name: value,
        percent: possible > 0 ? Math.round((completed / possible) * 100) : 0,
      };
    });
  };

  const zonePerformance = buildPerformance("zone").sort((a, b) => b.percent - a.percent);
  const designationPerformance = buildPerformance("designation").sort((a, b) => b.percent - a.percent);

  const topUsers = [...filteredUsers]
    .map((user) => {
      const completed = getCompletedCount(user.id);
      const percent =
        courses.length > 0 ? Math.round((completed / courses.length) * 100) : 0;

      return { ...user, completed, percent };
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const lowUsers = [...filteredUsers]
    .map((user) => {
      const completed = getCompletedCount(user.id);
      const pending = Math.max(courses.length - completed, 0);

      return { ...user, pending };
    })
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="admin-analytics-page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#64748b", fontSize: "0.95rem" }}>
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-analytics-page">
      <section className="admin-analytics-hero">
        <div className="admin-analytics-hero-left">
          <div className="admin-analytics-hero-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
          </div>
          <div>
            <h1>Training Analytics</h1>
            <p>Track training progress, certificates and user performance.</p>
          </div>
        </div>
        <div className="admin-analytics-hero-right">
          <div className="admin-analytics-hero-stat">
            <strong>{filteredUsers.length}</strong>
            <span>Users</span>
          </div>
          <div className="admin-analytics-hero-stat">
            <strong>{courses.length}</strong>
            <span>Courses</span>
          </div>
          <div className="admin-analytics-hero-stat cert">
            <strong>{certificatesTotal}</strong>
            <span>Certificates</span>
          </div>
        </div>
      </section>

      <section className="admin-analytics-kpi-row">
        <div className="admin-analytics-kpi kpi-users">
          <div className="admin-analytics-kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <span>Total Users</span>
            <strong>{filteredUsers.length}</strong>
          </div>
        </div>

        <div className="admin-analytics-kpi kpi-completed">
          <div className="admin-analytics-kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <span>Completed</span>
            <strong>{completedTotal}</strong>
          </div>
        </div>

        <div className="admin-analytics-kpi kpi-pending">
          <div className="admin-analytics-kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span>Pending</span>
            <strong>{pendingTrainings}</strong>
          </div>
        </div>

        <div className="admin-analytics-kpi kpi-rate">
          <div className="admin-analytics-kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
          </div>
          <div>
            <span>Completion</span>
            <strong>{completionRate}%</strong>
          </div>
        </div>
      </section>

      <section className="admin-analytics-filters">
        <div className="admin-analytics-filters-head">
          <div>
            <h2>Filters</h2>
            <p>Filter reports by location and designation.</p>
          </div>
          <button
            className="admin-analytics-clear-btn"
            onClick={() =>
              setFilters({ zone: "", state: "", cityArea: "", designation: "" })
            }
          >
            Clear
          </button>
        </div>
        <div className="admin-analytics-filters-row">
          <select
            className="admin-analytics-filter-select"
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>

          <select
            className="admin-analytics-filter-select"
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          >
            <option value="">All States</option>
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>

          <select
            className="admin-analytics-filter-select"
            value={filters.cityArea}
            onChange={(e) =>
              setFilters({ ...filters, cityArea: e.target.value })
            }
          >
            <option value="">All Cities</option>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>

          <select
            className="admin-analytics-filter-select"
            value={filters.designation}
            onChange={(e) =>
              setFilters({ ...filters, designation: e.target.value })
            }
          >
            <option value="">All Designations</option>
            {designations.map((designation) => (
              <option key={designation}>{designation}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="admin-analytics-perf-grid">
        <div className="admin-analytics-perf-card">
          <div className="admin-analytics-perf-head">
            <h3>Zone Performance</h3>
            {zonePerformance.length > 4 && (
              <button
                className="admin-analytics-viewall-btn"
                onClick={() => setShowAllZones(!showAllZones)}
              >
                {showAllZones ? "Show Less" : "View All"}
              </button>
            )}
          </div>
          <div className="admin-rank-list">
            {zonePerformance.length === 0 ? (
              <p className="admin-analytics-empty">No zone data available.</p>
            ) : (
              (showAllZones ? zonePerformance : zonePerformance.slice(0, 4)).map((item) => (
                <div className="admin-rank-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.percent}%</span>
                  </div>
                  <div className="admin-rank-bar">
                    <i style={{ width: `${item.percent}%` }}></i>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="admin-analytics-perf-card">
          <div className="admin-analytics-perf-head">
            <h3>Designation Performance</h3>
            {designationPerformance.length > 4 && (
              <button
                className="admin-analytics-viewall-btn"
                onClick={() => setShowAllDesignations(!showAllDesignations)}
              >
                {showAllDesignations ? "Show Less" : "View All"}
              </button>
            )}
          </div>
          <div className="admin-rank-list">
            {designationPerformance.length === 0 ? (
              <p className="admin-analytics-empty">No designation data available.</p>
            ) : (
              (showAllDesignations ? designationPerformance : designationPerformance.slice(0, 4)).map((item) => (
                <div className="admin-rank-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.percent}%</span>
                  </div>
                  <div className="admin-rank-bar">
                    <i style={{ width: `${item.percent}%` }}></i>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="admin-analytics-users-grid">
        <div className="admin-analytics-users-card">
          <h3>Top Performing Users</h3>
          <div className="admin-mini-user-list">
            {topUsers.length === 0 ? (
              <p className="admin-analytics-empty">No user data available.</p>
            ) : (
              topUsers.map((user) => (
                <div className="admin-mini-user-row" key={user.id}>
                  <strong>{user.name}</strong>
                  <span>{user.designation}</span>
                  <b>{user.percent}%</b>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="admin-analytics-users-card">
          <h3>Low Engagement Users</h3>
          <div className="admin-mini-user-list">
            {lowUsers.length === 0 ? (
              <p className="admin-analytics-empty">No user data available.</p>
            ) : (
              lowUsers.map((user) => (
                <div className="admin-mini-user-row" key={user.id}>
                  <strong>{user.name}</strong>
                  <span>{user.designation}</span>
                  <b className="low">{user.pending} pending</b>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="admin-analytics-card">
        <div className="admin-analytics-card-head">
          <div>
            <h2>User Training Report</h2>
            <p>Complete report of all users and their training status.</p>
          </div>
        </div>

        <div className="admin-analytics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Zone</th>
                <th>State</th>
                <th>City</th>
                <th>Completed</th>
                <th>Certificates</th>
                <th>Completion</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const completed = getCompletedCount(user.id);
                const certificates = getCertificateCount(user.id);
                const percent =
                  courses.length > 0
                    ? Math.round((completed / courses.length) * 100)
                    : 0;

                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{user.email}</td>
                    <td>{user.designation}</td>
                    <td>{user.zone}</td>
                    <td>{user.state}</td>
                    <td>{user.cityArea}</td>
                    <td>{completed}</td>
                    <td>{certificates}</td>
                    <td>
                      <div className="admin-pct-cell">
                        <div className="admin-pct-bar">
                          <span style={{ width: `${percent}%` }}></span>
                        </div>
                        <strong>{percent}%</strong>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="9">
                    <p className="admin-analytics-empty">No users found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminAnalytics;
