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
    designation: "",
    zone: "",
    state: "",
    cityArea: "",
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
      } else {
        setUsers([]);
      }

      if (coursesSnap.exists()) {
        const coursesData = coursesSnap.val();
        setCourses(
          Object.entries(coursesData).map(([id, course]) => ({
            id,
            ...course,
          }))
        );
      } else {
        setCourses([]);
      }

      if (completedSnap.exists()) {
        setCompletedCourses(completedSnap.val());
      } else {
        setCompletedCourses({});
      }

      if (resultsSnap.exists()) {
        setResults(resultsSnap.val());
      } else {
        setResults({});
      }
    };

    fetchData();
  }, []);

  const employeeUsers = useMemo(() => {
    return users.filter((user) => user.role !== "superAdmin");
  }, [users]);

  const locationMap = useMemo(() => {
    const map = {};

    employeeUsers.forEach((user) => {
      if (user.cityArea) {
        map[user.cityArea] = {
          cityArea: user.cityArea,
          state: user.state || "",
          zone: user.zone || "",
        };
      }
    });

    return map;
  }, [employeeUsers]);

  const zones = useMemo(() => {
    return [...new Set(employeeUsers.map((u) => u.zone).filter(Boolean))].sort();
  }, [employeeUsers]);

  const states = useMemo(() => {
    return [
      ...new Set(
        employeeUsers
          .filter((u) => !filters.zone || u.zone === filters.zone)
          .map((u) => u.state)
          .filter(Boolean)
      ),
    ].sort();
  }, [employeeUsers, filters.zone]);

  const cities = useMemo(() => {
    return [
      ...new Set(
        employeeUsers
          .filter((u) => !filters.zone || u.zone === filters.zone)
          .filter((u) => !filters.state || u.state === filters.state)
          .map((u) => u.cityArea)
          .filter(Boolean)
      ),
    ].sort();
  }, [employeeUsers, filters.zone, filters.state]);

  const designations = useMemo(() => {
    return [
      ...new Set(
        employeeUsers
          .filter((u) => !filters.zone || u.zone === filters.zone)
          .filter((u) => !filters.state || u.state === filters.state)
          .filter((u) => !filters.cityArea || u.cityArea === filters.cityArea)
          .map((u) => u.designation)
          .filter(Boolean)
      ),
    ].sort();
  }, [employeeUsers, filters.zone, filters.state, filters.cityArea]);

  const handleZoneChange = (zone) => {
    setFilters({
      designation: "",
      zone,
      state: "",
      cityArea: "",
    });
  };

  const handleStateChange = (state) => {
    const matchedUser = employeeUsers.find(
      (user) =>
        user.state === state &&
        (!filters.zone || user.zone === filters.zone)
    );

    setFilters({
      designation: "",
      zone: matchedUser?.zone || filters.zone,
      state,
      cityArea: "",
    });
  };

  const handleCityChange = (cityArea) => {
    if (!cityArea) {
      setFilters({
        ...filters,
        cityArea: "",
        designation: "",
      });
      return;
    }

    const matchedLocation = locationMap[cityArea];

    setFilters({
      designation: "",
      zone: matchedLocation?.zone || "",
      state: matchedLocation?.state || "",
      cityArea,
    });
  };

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

  const getCompletedCount = (userId) => {
    if (!completedCourses[userId]) return 0;
    return Object.keys(completedCourses[userId]).length;
  };

  const getCertificateCount = (userId) => {
    if (!results[userId]) return 0;

    return Object.values(results[userId]).filter((result) => result.passed)
      .length;
  };

  const getUserCompletion = (userId) => {
    const completed = getCompletedCount(userId);
    return courses.length > 0 ? Math.round((completed / courses.length) * 100) : 0;
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

  const downloadCompleteReport = () => {
    const rows = filteredUsers.map((user) => {
      const completed = getCompletedCount(user.id);
      const certificates = getCertificateCount(user.id);
      const completionPercent = getUserCompletion(user.id);

      return {
        Name: user.name || "",
        Email: user.email || "",
        Role: user.role || "",
        Designation: user.designation || "",
        Seniority: user.seniority || "",
        Zone: user.zone || "",
        State: user.state || "",
        City: user.cityArea || "",
        "Total Courses": courses.length,
        "Completed Trainings": completed,
        Certificates: certificates,
        "Completion %": `${completionPercent}%`,
      };
    });

    const headers = Object.keys(rows[0] || {
      Name: "",
      Email: "",
      Role: "",
      Designation: "",
      Seniority: "",
      Zone: "",
      State: "",
      City: "",
      "Total Courses": "",
      "Completed Trainings": "",
      Certificates: "",
      "Completion %": "",
    });

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
    link.download = `training-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({
      designation: "",
      zone: "",
      state: "",
      cityArea: "",
    });
  };

  return (
    <div className="super-analytics-page">
      <div className="analytics-header">
        <div>
          <h1>Super Admin Analytics</h1>
          <p>Track real training performance by zone, state, city and designation.</p>
        </div>

        <button className="download-report-btn" onClick={downloadCompleteReport}>
          Download Complete Report
        </button>
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

          <button onClick={clearFilters}>Clear Filters</button>
        </div>

        <div className="analytics-filter-grid">
          <select
            value={filters.zone}
            onChange={(e) => handleZoneChange(e.target.value)}
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
            onChange={(e) => handleStateChange(e.target.value)}
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
            onChange={(e) => handleCityChange(e.target.value)}
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

            {zonePerformance.length === 0 && (
              <p className="empty-help">No zone data available.</p>
            )}
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

            {designationPerformance.length === 0 && (
              <p className="empty-help">No designation data available.</p>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-head">
          <h2>User Training Report</h2>

          <button onClick={downloadCompleteReport}>Download Report</button>
        </div>

        <div className="analytics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Type</th>
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
                const userCompletion = getUserCompletion(user.id);

                return (
                  <tr key={user.id}>
                    <td>{user.name || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>{user.designation || "-"}</td>
                    <td>
                      {user.seniority
                        ? user.seniority.charAt(0).toUpperCase() +
                          user.seniority.slice(1)
                        : "-"}
                    </td>
                    <td>{user.zone || "-"}</td>
                    <td>{user.state || "-"}</td>
                    <td>{user.cityArea || "-"}</td>
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
                  <td colSpan="10">No users found for selected filters.</td>
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