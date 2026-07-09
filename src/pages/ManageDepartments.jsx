import { useEffect, useState } from "react";
import { ref, get, push, set, remove, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/managedepartments.css";

function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);

  const [departmentName, setDepartmentName] = useState("");
  const [departmentType, setDepartmentType] = useState("");
  const [selectedMember, setSelectedMember] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const deptSnap = await get(ref(database, "departments"));
    const userSnap = await get(ref(database, "users"));

    setDepartments(
      deptSnap.exists()
        ? Object.entries(deptSnap.val()).map(([id, item]) => ({
            id,
            ...item,
          }))
        : []
    );

    setMembers(
      userSnap.exists()
        ? Object.entries(userSnap.val())
            .map(([id, item]) => ({
              id,
              ...item,
            }))
            .filter(
              (user) =>
                user.role === "user" || user.role === "departmentAdmin"
            )
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        : []
    );
  };

  const resetForm = () => {
    setDepartmentName("");
    setDepartmentType("");
    setSelectedMember("");
    setEditingDepartment(null);
    setShowModal(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (dept) => {
    setEditingDepartment(dept);
    setDepartmentName(dept.departmentName || "");
    setDepartmentType(dept.departmentType || "");
    setSelectedMember(dept.departmentAdminId || "");
    setShowModal(true);
  };

  const saveDepartment = async (e) => {
    e.preventDefault();

    if (!departmentName || !departmentType || !selectedMember) {
      alert("Please fill all fields.");
      return;
    }

    const admin = members.find((m) => m.id === selectedMember);

    if (!admin) {
      alert("Select Department Admin");
      return;
    }

    try {
      setIsSaving(true);

      let departmentId = editingDepartment?.id;

      if (editingDepartment) {
        await update(ref(database, `departments/${editingDepartment.id}`), {
          departmentName,
          departmentType,
          departmentAdminId: admin.id,
          departmentAdminName: admin.name || "",
          departmentAdminEmail: admin.email || "",
          departmentAdminDesignation: admin.designation || "",
          departmentAdminSeniority: admin.seniority || "",
          updatedAt: new Date().toISOString(),
        });

        if (
          editingDepartment.departmentAdminId &&
          editingDepartment.departmentAdminId !== admin.id
        ) {
          await update(
            ref(database, `users/${editingDepartment.departmentAdminId}`),
            {
              role: "user",
              departmentId: "",
              department: "",
              departmentType: "",
            }
          );
        }
      } else {
        const deptRef = push(ref(database, "departments"));
        departmentId = deptRef.key;

        await set(deptRef, {
          departmentName,
          departmentType,
          departmentAdminId: admin.id,
          departmentAdminName: admin.name || "",
          departmentAdminEmail: admin.email || "",
          departmentAdminDesignation: admin.designation || "",
          departmentAdminSeniority: admin.seniority || "",
          createdAt: new Date().toISOString(),
        });
      }

      await update(ref(database, `users/${admin.id}`), {
        role: "departmentAdmin",
        departmentId,
        department: departmentName,
        departmentType,
      });

      resetForm();
      await loadData();
    } catch (error) {
      console.error("Department save error:", error);
      alert("Something went wrong while saving department.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDepartment = async (dept) => {
    const confirmDelete = window.confirm(
      `Delete ${dept.departmentName}? This will also remove department admin role.`
    );

    if (!confirmDelete) return;

    try {
      await remove(ref(database, `departments/${dept.id}`));

      if (dept.departmentAdminId) {
        await update(ref(database, `users/${dept.departmentAdminId}`), {
          role: "user",
          departmentId: "",
          department: "",
          departmentType: "",
        });
      }

      await loadData();
    } catch (error) {
      console.error("Department delete error:", error);
      alert("Something went wrong while deleting department.");
    }
  };

  return (
    <div className="manage-dept-page">
      <div className="dept-page-header">
        <div>
          <h1>Departments</h1>
          <p>Manage all departments and their department admins.</p>
        </div>

        <button className="new-dept-btn" onClick={openCreateModal}>
          + New Department
        </button>
      </div>

      <div className="department-table-card">
        <table className="department-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Department Type</th>
              <th>Department Admin</th>
              <th>Designation</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-table">
                  No departments created.
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <strong>{dept.departmentName}</strong>
                  </td>

                  <td>{dept.departmentType}</td>

                  <td>
                    <div className="dept-admin-cell">
                      <div className="dept-admin-avatar">
                        {(dept.departmentAdminName || "A")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>{dept.departmentAdminName || "-"}</strong>
                        <span>{dept.departmentAdminEmail || "-"}</span>
                      </div>
                    </div>
                  </td>

                  <td>{dept.departmentAdminDesignation || "-"}</td>

                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => openEditModal(dept)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteDepartment(dept)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="department-modal">
            <h2>{editingDepartment ? "Edit Department" : "Create Department"}</h2>

            <form className="department-form" onSubmit={saveDepartment}>
              <div className="form-group">
                <label>Department Name</label>
                <input
                  type="text"
                  placeholder="Department Name"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Department Type</label>
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
              </div>

              <div className="form-group">
                <label>Department Admin</label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  required
                >
                  <option value="">Select Department Admin</option>

                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.designation ? ` - ${member.designation}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>

                <button type="submit" className="save-btn" disabled={isSaving}>
                  {isSaving
                    ? "Saving..."
                    : editingDepartment
                    ? "Save Changes"
                    : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageDepartments;