import { useEffect, useMemo, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import "../styles/superanalytics.css";

function SuperAdminAnalytics() {
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
        const usersData = usersSnap.val();
        setUsers(
          Object.entries(usersData).map(([id, user]) => ({
            id,
            ...user,
          }))
        );
      }

      if (coursesSnap.exists()) {
        const coursesData = coursesSnap.val();
        setCourses(
          Object.entries(coursesData).map(([id, course]) => ({
            id,
            ...course,
          }))
        );
      }

      if (completedSnap.exists()) {
        setCompletedCourses(completedSnap.val());
      }

      if (resultsSnap.exists()) {
        setResults(resultsSnap.val());
      }
    };

    fetchData();
  }, []);

  const employeeUsers = users.filter((user) => user.role !== "superAdmin");

  const filteredUsers = useMemo(() => {
    return employeeUsers.filter((user) => {
      return (
        (!filters.zone || user.zone === filters.zone) &&
        (!filters.state || user.state === filters.state) &&
        (!filters.cityArea || user.cityArea === filters.cityArea) &&
        (!filters.designation || user.designation === filters.designation)
      );
    });
  }, [employeeUsers, filters]);

  const zones = [...new Set(employeeUsers.map((u) => u.zone).filter(Boolean))];
  const states = [...new Set(employeeUsers.map((u) => u.state).filter(Boolean))];
  const cities = [...new Set(employeeUsers.map((u) => u.cityArea).filter(Boolean))];
  const designations = [
    ...new Set(employeeUsers.map((u) => u.designation).filter(Boolean)),
  ];

  const getCompletedCount = (userId) => {
    if (!completedCourses[userId]) return 0;
    return Object.keys(completedCourses[userId]).length;
  };

  const getCertificateCount = (userId) => {
    if (!results[userId]) return 0;

    return Object.values(results[userId]).filter((result) => result.passed)
      .length;
  };

  const totalPossible = filteredUsers.length * courses.length;

  const totalCompleted = filteredUsers.reduce(
    (total, user) => total + getCompletedCount(user.id),
    0
  );

  const totalCertificates = filteredUsers.reduce(
    (total, user) => total + getCertificateCount(user.id),
    0
  );

  const completionRate =
    totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  const zonePerformance = zones.map((zone) => {
    const zoneUsers = employeeUsers.filter((u) => u.zone === zone);
    const possible = zoneUsers.length * courses.length;
    const completed = zoneUsers.reduce(
      (total, user) => total + getCompletedCount(user.id),
      0
    );

    return {
      name: zone,
      percent: possible > 0 ? Math.round((completed / possible) * 100) : 0,
    };
  });

  const designationPerformance = designations.map((designation) => {
    const designationUsers = employeeUsers.filter(
      (u) => u.designation === designation
    );
    const possible = designationUsers.length * courses.length;
    const completed = designationUsers.reduce(
      (total, user) => total + getCompletedCount(user.id),
      0
    );

    return {
      name: designation,
      percent: possible > 0 ? Math.round((completed / possible) * 100) : 0,
    };
  });

  return (
    <div className="super-analytics-page">
      <div className="analytics-header">
        <div>
          <h1>Super Admin Analytics</h1>
          <p>Track training performance by zone, state, city and designation.</p>
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <div className="analytics-kpi">
          <span>Total Users</span>
          <h2>{filteredUsers.length}</h2>
        </div>

        <div className="analytics-kpi">
          <span>Total Courses</span>
          <h2>{courses.length}</h2>
        </div>

        <div className="analytics-kpi">
          <span>Completed Trainings</span>
          <h2>{totalCompleted}</h2>
        </div>

        <div className="analytics-kpi">
          <span>Certificates</span>
          <h2>{totalCertificates}</h2>
        </div>

        <div className="analytics-kpi primary">
          <span>Completion Rate</span>
          <h2>{completionRate}%</h2>
        </div>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-head">
          <h2>Filters</h2>
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
            Clear Filters
          </button>
        </div>

        <div className="analytics-filter-grid">
          <select
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>

          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          >
            <option value="">All States</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>

          <select
            value={filters.cityArea}
            onChange={(e) =>
              setFilters({ ...filters, cityArea: e.target.value })
            }
          >
            <option value="">All Cities / Areas</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
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
              <option key={designation} value={designation}>
                {designation}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="analytics-two-grid">
        <div className="analytics-card">
          <h2>Zone Wise Performance</h2>

          <div className="ranking-list">
            {zonePerformance.map((item) => (
              <div className="ranking-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.percent}% completed</span>
                </div>

                <div className="ranking-bar">
                  <span style={{ width: `${item.percent}%` }}></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>Designation Wise Performance</h2>

          <div className="ranking-list">
            {designationPerformance.map((item) => (
              <div className="ranking-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.percent}% completed</span>
                </div>

                <div className="ranking-bar">
                  <span style={{ width: `${item.percent}%` }}></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-card">
        <h2>User Training Report</h2>

        <div className="analytics-table-wrap">
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
                <th>Completion %</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const completed = getCompletedCount(user.id);
                const certificates = getCertificateCount(user.id);

                const userCompletion =
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
                      <strong>{userCompletion}%</strong>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="9">No users found for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SuperAdminAnalytics;