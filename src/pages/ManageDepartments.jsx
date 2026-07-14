import { useEffect, useState } from "react";
import { ref, get, push, set, remove, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/managedepartments.css";

const cascadeDepartmentRename = async (deptId, oldName, newName, oldType, newType) => {
  if (oldName === newName && oldType === newType) return;

  const updates = {};

  const [usersSnap, coursesSnap, videoLibSnap, assignmentsSnap, questionsSnap, quizzesSnap] = await Promise.all([
    get(ref(database, "users")),
    get(ref(database, "courses")),
    get(ref(database, "videoLibrary")),
    get(ref(database, "userAssignments")),
    get(ref(database, "questions")),
    get(ref(database, "videoQuizzes")),
  ]);

  if (usersSnap.exists()) {
    const users = usersSnap.val();
    Object.entries(users).forEach(([uid, user]) => {
      const matchesDept = user.departmentId === deptId ||
        String(user.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
      if (matchesDept) {
        updates[`users/${uid}/department`] = newName;
        updates[`users/${uid}/departmentType`] = newType;
      }
    });
  }

  if (coursesSnap.exists()) {
    const courses = coursesSnap.val();
    Object.entries(courses).forEach(([courseId, course]) => {
      const matchesDept = course.departmentId === deptId ||
        String(course.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
      if (matchesDept) {
        updates[`courses/${courseId}/department`] = newName;
        updates[`courses/${courseId}/departmentType`] = newType;
        updates[`courses/${courseId}/departmentId`] = deptId;
      }
    });
  }

  if (videoLibSnap.exists()) {
    const videos = videoLibSnap.val();
    Object.entries(videos).forEach(([videoId, video]) => {
      const matchesDept = video.departmentId === deptId ||
        String(video.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
      if (matchesDept) {
        updates[`videoLibrary/${videoId}/department`] = newName;
        updates[`videoLibrary/${videoId}/departmentType`] = newType;
        updates[`videoLibrary/${videoId}/departmentId`] = deptId;
      }
    });
  }

  if (assignmentsSnap.exists()) {
    const allAssignments = assignmentsSnap.val();
    Object.entries(allAssignments).forEach(([userId, userCourses]) => {
      if (userCourses && typeof userCourses === "object") {
        Object.entries(userCourses).forEach(([courseId, assignment]) => {
          if (assignment && typeof assignment === "object") {
            const matchesDept = String(assignment.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
            if (matchesDept) {
              updates[`userAssignments/${userId}/${courseId}/department`] = newName;
              updates[`userAssignments/${userId}/${courseId}/departmentId`] = deptId;
            }
          }
        });
      }
    });
  }

  if (questionsSnap.exists()) {
    const allQuestions = questionsSnap.val();
    Object.entries(allQuestions).forEach(([courseId, courseQuestions]) => {
      if (courseQuestions && typeof courseQuestions === "object") {
        Object.entries(courseQuestions).forEach(([qId, question]) => {
          if (question && typeof question === "object") {
            const matchesDept = String(question.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
            if (matchesDept) {
              updates[`questions/${courseId}/${qId}/department`] = newName;
              updates[`questions/${courseId}/${qId}/departmentType`] = newType;
              updates[`questions/${courseId}/${qId}/departmentId`] = deptId;
            }
          }
        });
      }
    });
  }

  if (quizzesSnap.exists()) {
    const allQuizzes = quizzesSnap.val();
    Object.entries(allQuizzes).forEach(([videoId, videoQuestions]) => {
      if (videoQuestions && typeof videoQuestions === "object") {
        Object.entries(videoQuestions).forEach(([qId, question]) => {
          if (question && typeof question === "object") {
            const matchesDept = String(question.department || "").trim().toLowerCase() === String(oldName).trim().toLowerCase();
            if (matchesDept) {
              updates[`videoQuizzes/${videoId}/${qId}/department`] = newName;
              updates[`videoQuizzes/${videoId}/${qId}/departmentType`] = newType;
            }
          }
        });
      }
    });
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }
};

function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const deptSnap = await get(ref(database, "departments"));
    const userSnap = await get(ref(database, "users"));

    setDepartments(
      deptSnap.exists()
        ? Object.entries(deptSnap.val()).map(([id, item]) => ({ id, ...item }))
        : []
    );

    setMembers(
      userSnap.exists()
        ? Object.entries(userSnap.val())
            .map(([id, item]) => ({ id, ...item }))
            .filter((user) => user.role === "user" || user.role === "departmentAdmin")
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
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

  const openCreateModal = () => { resetForm(); setShowModal(true); };

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
    if (!admin) { alert("Select Department Admin"); return; }

    try {
      setIsSaving(true);
      let departmentId = editingDepartment?.id;

      if (editingDepartment) {
        const oldName = editingDepartment.departmentName || "";
        const oldType = editingDepartment.departmentType || "";

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

        if (oldName !== departmentName || oldType !== departmentType) {
          await cascadeDepartmentRename(
            editingDepartment.id,
            oldName,
            departmentName,
            oldType,
            departmentType
          );
        }

        if (editingDepartment.departmentAdminId && editingDepartment.departmentAdminId !== admin.id) {
          await update(ref(database, `users/${editingDepartment.departmentAdminId}`), {
            role: "user", departmentId: "", department: "", departmentType: "",
          });
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
        role: "departmentAdmin", departmentId, department: departmentName, departmentType,
      });

      if (!editingDepartment) {
        const existingUsersSnap = await get(ref(database, "users"));
        if (existingUsersSnap.exists()) {
          const userUpdates = {};
          Object.entries(existingUsersSnap.val()).forEach(([uid, user]) => {
            if (uid !== admin.id && String(user.department || "").trim().toLowerCase() === String(departmentName).trim().toLowerCase() && !user.departmentId) {
              userUpdates[`users/${uid}/departmentId`] = departmentId;
              userUpdates[`users/${uid}/departmentType`] = departmentType;
            }
          });
          if (Object.keys(userUpdates).length > 0) {
            await update(ref(database), userUpdates);
          }
        }
      }

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
    if (!window.confirm(`Delete ${dept.departmentName}? This will also remove department admin role.`)) return;
    try {
      await remove(ref(database, `departments/${dept.id}`));
      if (dept.departmentAdminId) {
        await update(ref(database, `users/${dept.departmentAdminId}`), {
          role: "user", departmentId: "", department: "", departmentType: "",
        });
      }
      await loadData();
    } catch (error) {
      console.error("Department delete error:", error);
      alert("Something went wrong while deleting department.");
    }
  };

  const filteredDepts = departments.filter((d) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [d.departmentName, d.departmentType, d.departmentAdminName, d.departmentAdminEmail, d.departmentAdminDesignation]
      .filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  return (
    <div className="md-page">

      {/* Hero */}
      <section className="md-hero">
        <div className="md-hero-content">
          <h1>Manage Departments</h1>
          <p>Create, edit and manage all departments and their admins.</p>
        </div>
        <div className="md-hero-stats">
          <div className="md-hero-stat">
            <div className="md-hero-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <strong>{departments.length}</strong>
              <span>Departments</span>
            </div>
          </div>
          <div className="md-hero-stat">
            <div className="md-hero-stat-icon admin-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <strong>{departments.filter((d) => d.departmentAdminName).length}</strong>
              <span>With Admin</span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="md-action-bar">
        <div className="md-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search departments, admins..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="md-btn md-btn-primary" onClick={openCreateModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Department
        </button>
      </div>

      {/* Table */}
      <div className="md-table-card">
        <div className="md-table-header">
          <div>
            <h2>All Departments</h2>
            <p>{filteredDepts.length} departments</p>
          </div>
        </div>
        <div className="md-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Department</th>
                <th>Type</th>
                <th>Admin</th>
                <th>Designation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepts.map((dept, idx) => (
                <tr key={dept.id}>
                  <td className="md-td-idx">{idx + 1}</td>
                  <td className="md-td-name">{dept.departmentName}</td>
                  <td>
                    <span className="md-type-badge">{dept.departmentType}</span>
                  </td>
                  <td>
                    <div className="md-admin-cell">
                      <div className="md-admin-avatar">
                        {(dept.departmentAdminName || "A").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{dept.departmentAdminName || "-"}</strong>
                        <span>{dept.departmentAdminEmail || "-"}</span>
                      </div>
                    </div>
                  </td>
                  <td>{dept.departmentAdminDesignation || "-"}</td>
                  <td>
                    <div className="md-actions">
                      <button className="md-action-edit" onClick={() => openEditModal(dept)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="md-action-delete" onClick={() => deleteDepartment(dept)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDepts.length === 0 && (
                <tr><td colSpan="6" className="md-empty">No departments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content md-modal" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-head">
              <div>
                <h2>{editingDepartment ? "Edit Department" : "Create Department"}</h2>
                <p>{editingDepartment ? "Update department details below." : "Fill in the details to create a new department."}</p>
              </div>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            <form className="md-form" onSubmit={saveDepartment}>
              <div className="md-form-group">
                <label>Department Name</label>
                <input type="text" placeholder="e.g. Quality Control" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} required />
              </div>

              <div className="md-form-group">
                <label>Department Type</label>
                <select className="nice-select" value={departmentType} onChange={(e) => setDepartmentType(e.target.value)} required>
                  <option value="">Select Department Type</option>
                  {departmentTypes.map((type) => (<option key={type} value={type}>{type}</option>))}
                </select>
              </div>

              <div className="md-form-group">
                <label>Department Admin</label>
                <select className="nice-select" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} required>
                  <option value="">Select Department Admin</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}{member.designation ? ` - ${member.designation}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md-modal-actions">
                <button type="button" className="md-btn md-btn-cancel" onClick={resetForm}>Cancel</button>
                <button type="submit" className="md-btn md-btn-primary" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingDepartment ? "Save Changes" : "Create Department"}
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
