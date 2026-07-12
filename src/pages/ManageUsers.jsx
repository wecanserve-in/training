import { useEffect, useState, useRef } from "react";
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

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);

  // Modals State
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

  // Strict Cascading Logic
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
      setDesignations(
        Object.entries(data).map(([id, item]) => ({
          id,
          ...item,
        }))
      );
    } else {
      setDesignations([]);
    }
  };

  const fetchUsers = async () => {
    const snap = await get(ref(database, "users"));
    if (!snap.exists()) return setUsers([]);

    const data = snap.val();
  const userList = Object.entries(data)
  .filter(([_, user]) =>
    user.role === "user" ||
    user.role === "departmentAdmin"
  )
  .map(([id, user]) => ({
    id,
    ...user,
  }));

    setUsers(userList);
  };

  // Designation Functions
  const addDesignation = async () => {
    const name = newDesignation.trim();
    if (!name) return;

    const exists = designations.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("Designation already exists.");
      return;
    }

    const newRef = push(ref(database, "master/designations"));
    await set(newRef, {
      name,
      createdAt: new Date().toISOString(),
    });

    setNewDesignation("");
    fetchMasterData();
  };

  const removeDesignation = async (id) => {
    if (!window.confirm("Remove this designation?")) return;
    await remove(ref(database, `master/designations/${id}`));
    fetchMasterData();
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      designation: "",
      seniority: "",
      zone: "",
      state: "",
      cityArea: "",
    });
  };

  const createUserRecord = async (userData) => {
    if (
      !userData.name ||
      !userData.email ||
      !userData.designation ||
      !userData.seniority ||
      !userData.cityArea
    ) {
      return { success: false, error: "Missing required fields" };
    }

    const appName = `user-${Date.now()}-${Math.random()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        userData.email.trim(),
        DEFAULT_PASSWORD
      );

      await updateProfile(userCredential.user, {
        displayName: userData.name.trim(),
      });

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
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

  // Bulk Upload Logic
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

    setUploadModal({
      open: true,
      current: 0,
      total: rows.length,
      success: 0,
      failed: 0,
      status: "processing",
      errors: [],
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setUploadModal((prev) => ({ ...prev, current: i + 1 }));

      const city = row.cityArea || row.CityArea || row.City || row.city || "";
      const matchedLocation = locations.find((location) =>
        location.cities.includes(city)
      );

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

    setUploadModal((prev) => ({
      ...prev,
      status: "done",
      success: successCount,
      skipped: skippedCount,
      failed: failCount,
      errors: uploadErrors,
    }));
    setCreating(false);
    fetchUsers();
  };

  // Drag Events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = ""; // reset input
  };

  const downloadTemplate = () => {
    const templateData = [{ name: "Rahul Sharma", email: "rahul@example.com", designation: "Sales Executive", seniority: "senior", cityArea: "Mumbai" }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "user-template.xlsx");
  };
const filteredUsers = users.filter((user) => {
  const searchText = [
    user.name,
    user.email,
    user.designation,
    user.zone,
    user.state,
    user.cityArea,
    user.role,
    user.seniority,
  ]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();

  return searchText.includes(searchTerm.toLowerCase());
});
  return (
    <div className="manage-users-page">
      
      {/* 1. USER CREATION FORM */}
      <div className="users-card full-user-form-card">
        <div className="card-title-row">
          <div>
            <h2>{editingUserId ? "Edit User" : "Add New User"}</h2>
            <p>Select Zone first, then State, then City to ensure correct mapping.</p>
          </div>
          <div className="title-actions">
            <button type="button" className="outline-btn green" onClick={() => setIsDesignationModalOpen(true)}>
              + Manage Designations
            </button>
            <span className="password-pill">Default Password: {DEFAULT_PASSWORD}</span>
          </div>
        </div>

        <form onSubmit={editingUserId ? updateExistingUser : createSingleUser} className="users-form-grid">
          <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email Address" type="email" value={form.email} disabled={!!editingUserId} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          
          <select className="nice-select" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required>
            <option value="" disabled>Select Designation</option>
            {designations.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>

          <select className="nice-select" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} required>
            <option value="" disabled>Select Seniority</option>
            <option value="senior">Senior</option>
            <option value="junior">Junior</option>
            <option value="intern">Intern</option>
          </select>

          {/* STRICT CASCADING LOCATIONS */}
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

          <button type="submit" className="primary-btn" disabled={creating}>
            {editingUserId ? "Update User" : creating ? "Creating..." : "Create User"}
          </button>
          
          {editingUserId && (
            <button type="button" className="cancel-btn" onClick={cancelEdit}>Cancel</button>
          )}
        </form>
      </div>

      {/* 2. DRAG & DROP BULK UPLOAD */}
      <div 
        className={`users-card bulk-drag-card ${dragActive ? "drag-active" : ""}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      >
        <div className="bulk-drag-content">
          <div className="drag-icon">📁</div>
          <h2>Drag & Drop Excel File Here</h2>
          <p>or click the button below to browse files</p>
          
          <div className="bulk-actions">
            <label className="primary-btn upload-label">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: "none" }} />
              Browse File
            </label>
            <button className="outline-btn" onClick={downloadTemplate}>Download Template</button>
          </div>
        </div>
      </div>

      {/* 3. USERS TABLE */}
      <div className="users-card">
        <div className="card-title-row">
          <div>
            <h2>Existing Users</h2>
            <p>{filteredUsers.length} users found</p>
          </div>
          <input type="text" className="search-input" placeholder="Search by name, email or city..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="users-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Zone</th>
                <th>State</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.designation}</td>
                  <td>{user.zone}</td>
                  <td>{user.state}</td>
                  <td>{user.cityArea}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="text-btn" onClick={() => startEditUser(user)}>Edit</button>
                      <button className="text-btn" onClick={() => resetUserPassword(user.email)}>Reset Password</button>
                      <button className="text-btn danger" onClick={() => deleteUser(user.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan="7" className="text-center">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. DESIGNATION MODAL */}
      {isDesignationModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDesignationModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Designations</h2>
              <button className="close-btn" onClick={() => setIsDesignationModalOpen(false)}>×</button>
            </div>
            
            <div className="designation-input-row">
              <input placeholder="Type new designation..." value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
              <button className="primary-btn" onClick={addDesignation}>Add</button>
            </div>

            <div className="designations-list">
              {designations.length === 0 ? <p className="text-muted">No designations added.</p> : null}
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

      {/* 5. UPLOAD PROGRESS MODAL (Kept similar to your original logic) */}
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
              <button className="primary-btn w-100 mt-3" onClick={() => setUploadModal({ ...uploadModal, open: false })}>Done</button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default ManageUsers;