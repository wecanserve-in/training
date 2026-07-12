import { useEffect, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { ref, set, get, update, remove, push } from "firebase/database";
import { auth } from "../firebase";
import * as XLSX from "xlsx";
import { database, firebaseConfig } from "../firebase";
import { locations } from "../data/masterData";
import "../styles/manageusers.css";

const DEFAULT_PASSWORD = "portal@123";

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [isDesignationModalOpen, setIsDesignationModalOpen] = useState(false);
  const [designations, setDesignations] = useState([]);
  const [newDesignation, setNewDesignation] = useState("");

  const [uploadModal, setUploadModal] = useState({
    open: false,
    current: 0,
    total: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    status: "idle",
    errors: [],
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    designation: "",
    seniority: "",
    zone: "",
    state: "",
    cityArea: "",
  });

  const availableZones = [...new Set(locations.map((loc) => loc.zone))].filter(Boolean);

  const availableStates = [...new Set(
    locations.filter((loc) => loc.zone === form.zone).map((loc) => loc.state)
  )].filter(Boolean);

  const availableCities = locations
    .filter((loc) => loc.zone === form.zone && loc.state === form.state)
    .flatMap((loc) => loc.cities || []);

  useEffect(() => {
    fetchMasterData();
    fetchUsers();
  }, []);

  const fetchMasterData = async () => {
    const snap = await get(ref(database, "master/designations"));
    if (snap.exists()) {
      const data = snap.val();
      setDesignations(Object.entries(data).map(([id, item]) => ({ id, ...item })));
    } else {
      setDesignations([]);
    }
  };

  const fetchUsers = async () => {
    const snap = await get(ref(database, "users"));
    if (!snap.exists()) return setUsers([]);
    const data = snap.val();
    const userList = Object.entries(data)
      .filter(([_, user]) => user.role === "user" || user.role === "departmentAdmin")
      .map(([id, user]) => ({ id, ...user }));
    setUsers(userList);
  };

  const addDesignation = async () => {
    const name = newDesignation.trim();
    if (!name) return;
    if (designations.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      alert("Designation already exists.");
      return;
    }
    const newRef = push(ref(database, "master/designations"));
    await set(newRef, { name, createdAt: new Date().toISOString() });
    setNewDesignation("");
    fetchMasterData();
  };

  const removeDesignation = async (id) => {
    if (!window.confirm("Remove this designation?")) return;
    await remove(ref(database, `master/designations/${id}`));
    fetchMasterData();
  };

  const resetForm = () => {
    setForm({ name: "", email: "", designation: "", seniority: "", zone: "", state: "", cityArea: "" });
  };

  const createUserRecord = async (userData) => {
    if (!userData.name || !userData.email || !userData.designation || !userData.seniority || !userData.cityArea) {
      return { success: false, error: "Missing required fields" };
    }
    const appName = `user-${Date.now()}-${Math.random()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email.trim(), DEFAULT_PASSWORD);
      await updateProfile(userCredential.user, { displayName: userData.name.trim() });
      await set(ref(database, `users/${userCredential.user.uid}`), {
        uid: userCredential.user.uid,
        name: userData.name.trim(),
        email: userData.email.trim(),
        role: "user",
        designation: userData.designation.trim(),
        seniority: userData.seniority,
        zone: userData.zone.trim(),
        state: userData.state.trim(),
        cityArea: userData.cityArea.trim(),
        defaultPassword: DEFAULT_PASSWORD,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
      });
      await sendPasswordResetEmail(secondaryAuth, userData.email.trim());
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const createSingleUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    const result = await createUserRecord(form);
    if (result.success) {
      alert("User created successfully. Password reset email sent.");
      resetForm();
      setShowForm(false);
      fetchUsers();
    } else {
      alert(result.error);
    }
    setCreating(false);
  };

  const updateExistingUser = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      const oldUser = users.find((u) => u.id === editingUserId);
      await update(ref(database, `users/${editingUserId}`), {
        role: oldUser?.role || "user",
        department: oldUser?.department || "",
        departmentId: oldUser?.departmentId || "",
        departmentType: oldUser?.departmentType || "",
        name: form.name.trim(),
        designation: form.designation.trim(),
        seniority: form.seniority,
        zone: form.zone.trim(),
        state: form.state.trim(),
        cityArea: form.cityArea.trim(),
        updatedAt: new Date().toISOString(),
      });
      alert("User updated successfully.");
      setEditingUserId(null);
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      alert(error.message);
    }
  };

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      designation: user.designation || "",
      seniority: user.seniority || "",
      zone: user.zone || "",
      state: user.state || "",
      cityArea: user.cityArea || "",
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setShowForm(false);
    resetForm();
  };

  const deleteUser = async (uid) => {
    if (!window.confirm("Remove this user from database?")) return;
    try {
      await remove(ref(database, `users/${uid}`));
      fetchUsers();
    } catch (error) {
      alert(error.message);
    }
  };

  const resetUserPassword = async (email) => {
    if (!window.confirm(`Send password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent successfully.");
    } catch (error) {
      alert(error.message);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setCreating(true);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;
    const uploadErrors = [];

    setUploadModal({ open: true, current: 0, total: rows.length, success: 0, failed: 0, status: "processing", errors: [] });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setUploadModal((prev) => ({ ...prev, current: i + 1 }));
      const city = row.cityArea || row.CityArea || row.City || row.city || "";
      const matchedLocation = locations.find((location) => location.cities.includes(city));
      const result = await createUserRecord({
        name: row.name || row.Name || "",
        email: row.email || row.Email || "",
        designation: row.designation || row.Designation || "",
        seniority: row.seniority || row.Seniority || row.type || row.Type || "",
        cityArea: city,
        zone: matchedLocation?.zone || "",
        state: matchedLocation?.state || "",
      });
      if (result.success) {
        successCount++;
      } else if (result.error.includes("already-in-use")) {
        skippedCount++;
        uploadErrors.push({ row: i + 2, name: row.name || "", email: row.email || "", type: "warning", reason: "User exists." });
      } else {
        failCount++;
        uploadErrors.push({ row: i + 2, name: row.name || "", email: row.email || "", type: "error", reason: result.error });
      }
    }

    setUploadModal((prev) => ({ ...prev, status: "done", success: successCount, skipped: skippedCount, failed: failCount, errors: uploadErrors }));
    setCreating(false);
    fetchUsers();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const templateData = [{ name: "Rahul Sharma", email: "rahul@example.com", designation: "Sales Executive", seniority: "senior", cityArea: "Mumbai" }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "user-template.xlsx");
  };

  const filteredUsers = users.filter((user) => {
    const searchText = [user.name, user.email, user.designation, user.zone, user.state, user.cityArea, user.role, user.seniority]
      .map((v) => String(v ?? "")).join(" ").toLowerCase();
    return searchText.includes(searchTerm.toLowerCase());
  });

  const seniorityColor = (s) => {
    if (s === "senior") return { bg: "#dcfce7", color: "#166534" };
    if (s === "junior") return { bg: "#dbeafe", color: "#1e40af" };
    return { bg: "#fef3c7", color: "#92400e" };
  };

  return (
    <div className="manage-users-page">

      {/* Hero Banner */}
      <section className="mu-hero">
        <div className="mu-hero-content">
          <h1>Manage Users</h1>
          <p>Add, edit, upload and manage all users from one place.</p>
        </div>
        <div className="mu-hero-stats">
          <div className="mu-hero-stat">
            <div className="mu-hero-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <strong>{users.length}</strong>
              <span>Total Users</span>
            </div>
          </div>
          <div className="mu-hero-stat">
            <div className="mu-hero-stat-icon dept-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div>
              <strong>{users.filter((u) => u.role === "departmentAdmin").length}</strong>
              <span>Dept Admins</span>
            </div>
          </div>
        </div>
      </section>

      {/* Top Action Bar */}
      <div className="mu-action-bar">
        <div className="mu-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search by name, email, designation, city..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="mu-action-buttons">
          <button className="mu-btn mu-btn-outline" onClick={downloadTemplate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Template
          </button>
          <label className="mu-btn mu-btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
          <button className="mu-btn mu-btn-outline" onClick={() => setIsDesignationModalOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Manage Designation
          </button>
          <button className="mu-btn mu-btn-primary" onClick={() => { setEditingUserId(null); resetForm(); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New User
          </button>
        </div>
      </div>

      {/* Inline Form (Add/Edit) */}
      {showForm && (
        <div className="mu-form-card">
          <div className="mu-form-header">
            <h2>{editingUserId ? "Edit User" : "Add New User"}</h2>
            <span className="mu-password-pill">Default Password: {DEFAULT_PASSWORD}</span>
          </div>
          <form onSubmit={editingUserId ? updateExistingUser : createSingleUser} className="mu-form-grid">
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Email Address" type="email" value={form.email} disabled={!!editingUserId} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <select className="nice-select" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required>
              <option value="" disabled>Select Designation</option>
              {designations.map((item) => (<option key={item.id} value={item.name}>{item.name}</option>))}
            </select>
            <select className="nice-select" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} required>
              <option value="" disabled>Select Seniority</option>
              <option value="senior">Senior</option>
              <option value="junior">Junior</option>
              <option value="intern">Intern</option>
            </select>
            <select className="nice-select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value, state: "", cityArea: "" })} required>
              <option value="" disabled>1. Select Zone</option>
              {availableZones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <select className="nice-select" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, cityArea: "" })} disabled={!form.zone} required>
              <option value="" disabled>{form.zone ? "2. Select State" : "Select Zone First"}</option>
              {availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="nice-select" value={form.cityArea} onChange={(e) => setForm({ ...form, cityArea: e.target.value })} disabled={!form.state} required>
              <option value="" disabled>{form.state ? "3. Select City" : "Select State First"}</option>
              {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="mu-form-actions">
              <button type="submit" className="mu-btn mu-btn-primary" disabled={creating}>
                {editingUserId ? "Update User" : creating ? "Creating..." : "Create User"}
              </button>
              <button type="button" className="mu-btn mu-btn-cancel" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table Card */}
      <div className="mu-table-card">
        <div className="mu-table-header">
          <div>
            <h2>All Users</h2>
            <p>{filteredUsers.length} users found</p>
          </div>
        </div>
        <div className="mu-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Seniority</th>
                <th>Zone</th>
                <th>State</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, idx) => (
                <tr key={user.id}>
                  <td className="mu-td-idx">{idx + 1}</td>
                  <td className="mu-td-name">{user.name}</td>
                  <td className="mu-td-email">{user.email}</td>
                  <td>{user.designation || "-"}</td>
                  <td>
                    <span className="mu-badge" style={seniorityColor(user.seniority)}>
                      {user.seniority || "-"}
                    </span>
                  </td>
                  <td>{user.zone || "-"}</td>
                  <td>{user.state || "-"}</td>
                  <td>{user.cityArea || "-"}</td>
                  <td>
                    <div className="mu-actions">
                      <button className="mu-action-edit" onClick={() => startEditUser(user)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="mu-action-reset" onClick={() => resetUserPassword(user.email)} title="Reset Password">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                      </button>
                      <button className="mu-action-delete" onClick={() => deleteUser(user.id)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan="9" className="mu-empty">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Designation Modal */}
      {isDesignationModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDesignationModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Designations</h2>
              <button className="close-btn" onClick={() => setIsDesignationModalOpen(false)}>×</button>
            </div>
            <div className="designation-input-row">
              <input placeholder="Type new designation..." value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
              <button className="mu-btn mu-btn-primary" onClick={addDesignation}>Add</button>
            </div>
            <div className="designations-list">
              {designations.length === 0 && <p className="text-muted">No designations added.</p>}
              {designations.map((item) => (
                <div key={item.id} className="designation-item">
                  <span>{item.name}</span>
                  <button className="delete-icon-btn" onClick={() => removeDesignation(item.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Modal */}
      {uploadModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{uploadModal.status === "done" ? "Upload Completed" : "Uploading Data..."}</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadModal.total > 0 ? (uploadModal.current / uploadModal.total) * 100 : 0}%` }}></div>
            </div>
            <div className="stats-row">
              <span className="success">✅ {uploadModal.success} Added</span>
              <span className="warning">🟡 {uploadModal.skipped} Skipped</span>
              <span className="error">❌ {uploadModal.failed} Failed</span>
            </div>
            {uploadModal.status === "done" && (
              <button className="mu-btn mu-btn-primary w-100 mt-3" onClick={() => setUploadModal({ ...uploadModal, open: false })}>Done</button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default ManageUsers;
