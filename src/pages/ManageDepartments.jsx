import { useEffect, useMemo, useState } from "react";
import { ref, get, push, set, remove, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/managedepartments.css";

function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);

  const [departmentName, setDepartmentName] = useState("");
  const [departmentType, setDepartmentType] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [adminSearch, setAdminSearch] = useState("");

  const departmentTypes = [
    "Research & Development",
    "Sales & Marketing",
    "Production & Manufacturing",
    "Quality Assurance & Quality Control",
    "Regulatory Affairs",
    "Business Development",
    "Admin & Operations",
    "Key Leadership & Corporate Contact",
  ];

  const higherPostKeywords = [
    "manager",
    "head",
    "lead",
    "director",
    "admin",
    "supervisor",
    "team leader",
    "tl",
    "senior",
    "chief",
    "officer",
    "president",
    "vp",
    "avp",
    "gm",
    "agm",
    "dgm",
  ];

  const isHigherPost = (user) => {
    const designation = String(user.designation || "").toLowerCase();
    const seniority = String(user.seniority || "").toLowerCase();

    return (
      seniority === "senior" ||
      higherPostKeywords.some((keyword) => designation.includes(keyword))
    );
  };

  const loadData = async () => {
    const deptSnap = await get(ref(database, "departments"));
    const userSnap = await get(ref(database, "users"));

    setDepartments(
      deptSnap.exists()
        ? Object.entries(deptSnap.val()).map(([id, data]) => ({
            id,
            ...data,
          }))
        : []
    );

    if (userSnap.exists()) {
      const memberList = Object.entries(userSnap.val())
        .filter(([_, user]) => user.role === "user")
        .map(([id, user]) => ({
          id,
          ...user,
        }))
        .sort((a, b) => {
          const aSenior = isHigherPost(a) ? 1 : 0;
          const bSenior = isHigherPost(b) ? 1 : 0;

          if (bSenior !== aSenior) return bSenior - aSenior;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      setMembers(memberList);
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const eligibleMembers = useMemo(() => {
    return members.filter((member) => isHigherPost(member));
  }, [members]);

  const searchedMembers = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();

    if (!q) return eligibleMembers.slice(0, 8);

    return members
      .filter((member) => {
        const searchText = [
          member.name,
          member.email,
          member.designation,
          member.cityArea,
          member.state,
          member.zone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(q);
      })
      .slice(0, 8);
  }, [members, eligibleMembers, adminSearch]);

  useEffect(() => {
    if (!adminSearch.trim()) return;

    const q = adminSearch.trim().toLowerCase();

    const exactMatch =
      members.find((member) => String(member.name || "").toLowerCase() === q) ||
      members.find((member) =>
        String(member.name || "").toLowerCase().includes(q)
      );

    if (exactMatch) {
      setSelectedMember(exactMatch.id);
    }
  }, [adminSearch, members]);

  const selectedMemberData = members.find((m) => m.id === selectedMember);

  const selectAdmin = (member) => {
    setSelectedMember(member.id);
    setAdminSearch(member.name || "");
  };

  const resetForm = () => {
    setDepartmentName("");
    setDepartmentType("");
    setSelectedMember("");
    setAdminSearch("");
  };

  const createDepartment = async (e) => {
    e.preventDefault();

    if (!departmentName || !departmentType || !selectedMember) {
      alert("Please fill department name, type and department admin.");
      return;
    }

    const member = members.find((m) => m.id === selectedMember);

    if (!member) {
      alert("Selected user not found.");
      return;
    }

    const deptRef = push(ref(database, "departments"));

    await set(deptRef, {
      departmentName: departmentName.trim(),
      departmentType,
      departmentAdminId: member.id,
      departmentAdminName: member.name,
      departmentAdminEmail: member.email,
      departmentAdminDesignation: member.designation || "",
      departmentAdminSeniority: member.seniority || "",
      createdAt: new Date().toISOString(),
    });

    await update(ref(database, `users/${member.id}`), {
      role: "departmentAdmin",
      department: departmentName.trim(),
      departmentType,
      promotedToDepartmentAdminAt: new Date().toISOString(),
    });

    resetForm();
    loadData();
  };

  const deleteDepartment = async (dept) => {
    if (!window.confirm("Delete department and remove department admin access?")) {
      return;
    }

    await remove(ref(database, `departments/${dept.id}`));

    if (dept.departmentAdminId) {
      await update(ref(database, `users/${dept.departmentAdminId}`), {
        role: "user",
        department: "",
        departmentType: "",
        removedDepartmentAdminAt: new Date().toISOString(),
      });
    }

    loadData();
  };

  return (
    <div className="manage-dept-page">
      <div className="dept-header">
        <h1>Departments</h1>
        <p>Create departments and quickly assign eligible department admins.</p>
      </div>

      <div className="dept-card create-dept-full">
        <div className="card-title-row">
          <div>
            <h2>Create Department</h2>
            <p>Search by name or choose from top eligible users.</p>
          </div>
        </div>

        <form className="dept-form clean-dept-form" onSubmit={createDepartment}>
          <input
            placeholder="Department Name"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            required
          />

          <select
            value={departmentType}
            onChange={(e) => setDepartmentType(e.target.value)}
            required
          >
            <option value="">Select Department Type</option>
            {departmentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            placeholder="Search admin by name"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
          />

          <button type="submit">Create Department</button>
        </form>

        {selectedMemberData && (
          <div className="selected-admin-strip">
            <span>Selected Department Admin</span>
            <strong>{selectedMemberData.name}</strong>
            <p>
              {selectedMemberData.designation || "No designation"} •{" "}
              {selectedMemberData.seniority || "No type"} •{" "}
              {selectedMemberData.cityArea || "No city"}
            </p>
          </div>
        )}
      </div>

      <div className="dept-card quick-admin-card">
        <div className="card-title-row">
          <div>
            <h2>{adminSearch ? "Search Results" : "Top Eligible Users"}</h2>
            <p>
              {adminSearch
                ? "Best matching users are shown below."
                : "Senior / higher-post users are shown first."}
            </p>
          </div>
        </div>

        <div className="quick-admin-list">
          {searchedMembers.map((member) => (
            <button
              type="button"
              key={member.id}
              className={`quick-admin-chip ${
                selectedMember === member.id ? "active" : ""
              }`}
              onClick={() => selectAdmin(member)}
            >
              <strong>{member.name}</strong>
              <span>
                {member.designation || "No designation"} •{" "}
                {member.cityArea || "No city"}
              </span>
            </button>
          ))}

          {searchedMembers.length === 0 && (
            <p className="empty-help">No user found with this name.</p>
          )}
        </div>
      </div>

      <div className="dept-card">
        <div className="card-title-row">
          <div>
            <h2>Department List</h2>
            <p>{departments.length} departments created</p>
          </div>
        </div>

        <div className="dept-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Department Type</th>
                <th>Department Admin</th>
                <th>Designation</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td>{dept.departmentName}</td>
                  <td>{dept.departmentType || "-"}</td>
                  <td>{dept.departmentAdminName || "-"}</td>
                  <td>{dept.departmentAdminDesignation || "-"}</td>
                  <td>
                    {dept.departmentAdminSeniority
                      ? dept.departmentAdminSeniority.charAt(0).toUpperCase() +
                        dept.departmentAdminSeniority.slice(1)
                      : "-"}
                  </td>
                  <td>
                    <button onClick={() => deleteDepartment(dept)}>Delete</button>
                  </td>
                </tr>
              ))}

              {departments.length === 0 && (
                <tr>
                  <td colSpan="6">No departments created.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManageDepartments;