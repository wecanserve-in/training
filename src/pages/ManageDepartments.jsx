import { useEffect, useState } from "react";
import { ref, get, push, set, remove, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/managedepartments.css";

function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);

  const [departmentName, setDepartmentName] = useState("");
  const [selectedMember, setSelectedMember] = useState("");

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
        }));

      setMembers(memberList);
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createDepartment = async (e) => {
    e.preventDefault();

    if (!departmentName || !selectedMember) {
      alert("Please fill all fields");
      return;
    }

    const member = members.find((m) => m.id === selectedMember);

    const deptRef = push(ref(database, "departments"));

    await set(deptRef, {
      departmentName: departmentName.trim(),
      departmentAdminId: member.id,
      departmentAdminName: member.name,
      departmentAdminEmail: member.email,
      departmentAdminDesignation: member.designation || "",
      createdAt: new Date().toISOString(),
    });

    await update(ref(database, `users/${member.id}`), {
      role: "departmentAdmin",
      department: departmentName.trim(),
      promotedToDepartmentAdminAt: new Date().toISOString(),
    });

    setDepartmentName("");
    setSelectedMember("");

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
        removedDepartmentAdminAt: new Date().toISOString(),
      });
    }

    loadData();
  };

  return (
    <div className="manage-dept-page">
      <div className="dept-header">
        <h1>Departments</h1>
        <p>Create departments and assign a department admin from existing members.</p>
      </div>

      <div className="dept-card">
        <h2>Create Department</h2>

        <form className="dept-form" onSubmit={createDepartment}>
          <input
            placeholder="Department Name"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            required
          />

          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            required
          >
            <option value="">Select Member as Department Admin</option>

            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} — {member.designation} — {member.cityArea}
              </option>
            ))}
          </select>

          <button type="submit">Create Department</button>
        </form>
      </div>

      <div className="dept-card">
        <h2>Department List</h2>

        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Department Admin</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id}>
                <td>{dept.departmentName}</td>
                <td>{dept.departmentAdminName}</td>
                <td>{dept.departmentAdminEmail}</td>
                <td>{dept.departmentAdminDesignation}</td>
                <td>
                  <button onClick={() => deleteDepartment(dept)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {departments.length === 0 && (
              <tr>
                <td colSpan="5">No departments created.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageDepartments;