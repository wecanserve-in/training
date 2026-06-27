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

  const [filters, setFilters] = useState({
    seniority: "all",
    designation: "all",
    search: "",
  });

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
    const designation = (user.designation || "").toLowerCase();
    const seniority = (user.seniority || "").toLowerCase();

    return (
      seniority === "senior" ||
      higherPostKeywords.some((keyword) => designation.includes(keyword))
    );
  };

  const loadData = async () => {
    const deptSnap = await get(ref(database, "departments"));
    const userSnap = await get(ref(database, "users"));

    if (deptSnap.exists()) {
      setDepartments(
        Object.entries(deptSnap.val()).map(([id, data]) => ({
          id,
          ...data,
        }))
      );
    } else {
      setDepartments([]);
    }

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

          return (a.name || "").localeCompare(b.name || "");
        });

      setMembers(memberList);
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const designations = useMemo(() => {
    return [...new Set(members.map((m) => m.designation).filter(Boolean))];
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = filters.search.trim().toLowerCase();

    return members.filter((member) => {
      const searchText = `${member.name || ""} ${member.email || ""} ${
        member.designation || ""
      } ${member.cityArea || ""} ${member.state || ""} ${
        member.zone || ""
      }`.toLowerCase();

      const matchSearch = searchText.includes(q);

      if (q) return matchSearch;

      const matchHigherPost = isHigherPost(member);

      const matchSeniority =
        filters.seniority === "all" ||
        member.seniority === filters.seniority;

      const matchDesignation =
        filters.designation === "all" ||
        member.designation === filters.designation;

      return matchHigherPost && matchSeniority && matchDesignation;
    });
  }, [members, filters]);

  const selectedMemberData = members.find((m) => m.id === selectedMember);

  const createDepartment = async (e) => {
    e.preventDefault();

    if (!departmentName || !departmentType || !selectedMember) {
      alert("Please fill all fields");
      return;
    }

    const member = members.find((m) => m.id === selectedMember);

    if (!member) {
      alert("Selected member not found.");
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

    setDepartmentName("");
    setDepartmentType("");
    setSelectedMember("");

    setFilters({
      seniority: "all",
      designation: "all",
      search: "",
    });

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
        <p>
          Create departments, choose department type and assign Department Admins
          from senior or higher-post users.
        </p>
      </div>

      <div className="dept-top-grid">
        <div className="dept-card">
          <div className="card-title-row">
            <div>
              <h2>Create Department</h2>
              <p>
                Department type will control video upload filters later.
              </p>
            </div>
          </div>

          <form className="dept-form" onSubmit={createDepartment}>
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

            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              required
            >
              <option value="">
                {filters.search
                  ? "Select searched user"
                  : "Department Admin"}
              </option>

              {filteredMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.designation || "No Designation"} — {member.name}{" "}
                  {member.seniority ? `(${member.seniority})` : ""}
                </option>
              ))}
            </select>

            <button type="submit">Create Department</button>
          </form>

          {filteredMembers.length === 0 && (
            <p className="empty-help">
              No users found. Try searching by name, email, designation or city.
            </p>
          )}

          {selectedMemberData && (
            <div className="selected-member-box">
              <span>Selected Admin</span>
              <h3>{selectedMemberData.name}</h3>
              <p>
                {selectedMemberData.designation || "No Designation"} •{" "}
                {selectedMemberData.seniority
                  ? selectedMemberData.seniority.charAt(0).toUpperCase() +
                    selectedMemberData.seniority.slice(1)
                  : "No seniority selected"}
              </p>
            </div>
          )}
        </div>

        <div className="dept-card filter-card">
          <div className="card-title-row">
            <div>
              <h2>Filters</h2>
              <p>Keep dropdown clean. Use search to find any user manually.</p>
            </div>
          </div>

          <div className="dept-filter-grid">
            <select
              value={filters.seniority}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  seniority: e.target.value,
                  search: "",
                })
              }
            >
              <option value="all">All Eligible</option>
              <option value="senior">Senior Only</option>
              <option value="junior">Junior</option>
              <option value="intern">Intern</option>
            </select>

            <select
              value={filters.designation}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  designation: e.target.value,
                  search: "",
                })
              }
            >
              <option value="all">All Designations</option>
              {designations.map((designation) => (
                <option key={designation} value={designation}>
                  {designation}
                </option>
              ))}
            </select>

            <input
              placeholder="Search any user by name / email / designation / city"
              value={filters.search}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  search: e.target.value,
                })
              }
            />
          </div>

          <div className="filter-count-box">
            <strong>{filteredMembers.length}</strong>
            <span>
              {filters.search ? "searched users found" : "eligible members found"}
            </span>
          </div>
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
                  <td>{dept.departmentAdminName}</td>
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