import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/adminanalytics.css";

function AdminAnalytics() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [completedCourses, setCompletedCourses] = useState({});
  const [results, setResults] = useState({});

  const [filters, setFilters] = useState({
    zone: "",
    state: "",
    cityArea: "",
    designation: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const usersSnap = await get(ref(database, "users"));
      const coursesSnap = await get(ref(database, "courses"));
      const completedSnap = await get(ref(database, "completedCourses"));
      const resultsSnap = await get(ref(database, "results"));

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

  const zonePerformance = buildPerformance("zone");
  const designationPerformance = buildPerformance("designation");

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

  return (
    <div className="admin-analytics-page">
      <div className="admin-analytics-header">
        <div>
          <h1>Admin Analytics</h1>
          <p>Track training progress, certificates and user performance.</p>
        </div>
      </div>

      <div className="admin-analytics-kpis">
        <div>
          <span>Total Users</span>
          <h2>{filteredUsers.length}</h2>
        </div>

        <div>
          <span>Courses</span>
          <h2>{courses.length}</h2>
        </div>

        <div>
          <span>Completed</span>
          <h2>{completedTotal}</h2>
        </div>

        <div>
          <span>Pending</span>
          <h2>{pendingTrainings}</h2>
        </div>

        <div className="primary">
          <span>Completion</span>
          <h2>{completionRate}%</h2>
        </div>

        <div>
          <span>Certificates</span>
          <h2>{certificatesTotal}</h2>
        </div>
      </div>

      <div className="admin-analytics-card">
        <div className="admin-card-head">
          <div>
            <h2>Filters</h2>
            <p>Filter reports by location and designation.</p>
          </div>

          <button
            onClick={() =>
              setFilters({
                zone: "",
                state: "",
                cityArea: "",
                designation: "",
              })
            }
          >
            Clear
          </button>
        </div>

        <div className="admin-filter-grid">
          <select
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>

          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          >
            <option value="">All States</option>
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>

          <select
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
      </div>

      <div className="admin-analytics-grid">
        <div className="admin-analytics-card">
          <h2>Zone Performance</h2>

          <div className="admin-rank-list">
            {zonePerformance.map((item) => (
              <div className="admin-rank-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.percent}%</span>
                </div>

                <div className="admin-rank-bar">
                  <i style={{ width: `${item.percent}%` }}></i>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-analytics-card">
          <h2>Designation Performance</h2>

          <div className="admin-rank-list">
            {designationPerformance.map((item) => (
              <div className="admin-rank-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.percent}%</span>
                </div>

                <div className="admin-rank-bar">
                  <i style={{ width: `${item.percent}%` }}></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-analytics-grid">
        <div className="admin-analytics-card">
          <h2>Top Performing Users</h2>

          <div className="mini-user-list">
            {topUsers.map((user) => (
              <div key={user.id}>
                <strong>{user.name}</strong>
                <span>{user.designation}</span>
                <b>{user.percent}%</b>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-analytics-card">
          <h2>Low Engagement Users</h2>

          <div className="mini-user-list">
            {lowUsers.map((user) => (
              <div key={user.id}>
                <strong>{user.name}</strong>
                <span>{user.designation}</span>
                <b>{user.pending} pending</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-analytics-card">
        <h2>User Training Report</h2>

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
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.designation}</td>
                    <td>{user.zone}</td>
                    <td>{user.state}</td>
                    <td>{user.cityArea}</td>
                    <td>{completed}</td>
                    <td>{certificates}</td>
                    <td>
                      <strong>{percent}%</strong>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="9">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminAnalytics;