import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { ref, set, get, update, remove } from "firebase/database";
import { auth } from "../firebase";
import * as XLSX from "xlsx";
import { database, firebaseConfig } from "../firebase";
import { designations, locations } from "../data/masterData";
import "../styles/manageusers.css";

const DEFAULT_PASSWORD = "portal@123";

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [creating, setCreating] = useState(false);
const [editingUserId, setEditingUserId] = useState(null);
  const [uploadModal, setUploadModal] = useState({
    open: false,
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    status: "idle",
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    designation: "",
    zone: "",
    state: "",
    cityArea: "",
  });

  const allCities = locations.flatMap((location) => location.cities);

  const handleCityChange = (city) => {
    const matchedLocation = locations.find((location) =>
      location.cities.includes(city)
    );

    setForm({
      ...form,
      cityArea: city,
      zone: matchedLocation?.zone || "",
      state: matchedLocation?.state || "",
    });
  };

  const fetchUsers = async () => {
    const snap = await get(ref(database, "users"));
    if (!snap.exists()) return setUsers([]);

    const data = snap.val();

    const userList = Object.entries(data)
      .filter(([_, user]) => user.role === "user")
      .map(([id, user]) => ({ id, ...user }));

    setUsers(userList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      designation: "",
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
        name: userData.name.trim(),
        email: userData.email.trim(),
        role: "user",
        designation: userData.designation.trim(),
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

  const downloadTemplate = () => {
    const templateData = [
      {
        name: "Rahul Sharma",
        email: "rahul@example.com",
        designation: "Sales Executive",
        cityArea: "Mumbai",
      },
      {
        name: "Priya Mehta",
        email: "priya@example.com",
        designation: "Web Developer",
        cityArea: "Navi Mumbai",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Users Template");
    XLSX.writeFile(workbook, "user-upload-template.xlsx");
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkStatus("");
    setCreating(true);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let successCount = 0;
    let failCount = 0;

    setUploadModal({
      open: true,
      current: 0,
      total: rows.length,
      success: 0,
      failed: 0,
      status: "processing",
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      setUploadModal((prev) => ({
        ...prev,
        current: i + 1,
      }));

      const city = row.cityArea || row.CityArea || row.City || row.city || "";

      const matchedLocation = locations.find((location) =>
        location.cities.includes(city)
      );

      const result = await createUserRecord({
        name: row.name || row.Name || "",
        email: row.email || row.Email || "",
        designation: row.designation || row.Designation || "",
        cityArea: city,
        zone: matchedLocation?.zone || "",
        state: matchedLocation?.state || "",
      });

      if (result.success) successCount += 1;
      else failCount += 1;

      setUploadModal((prev) => ({
        ...prev,
        success: successCount,
        failed: failCount,
      }));
    }

    setBulkStatus(`${successCount} users created, ${failCount} failed.`);

    setUploadModal((prev) => ({
      ...prev,
      status: "done",
      success: successCount,
      failed: failCount,
    }));

    setCreating(false);
    fetchUsers();
    e.target.value = "";
  };

  const startEditUser = (user) => {
  setEditingUserId(user.id);

  setForm({
    name: user.name || "",
    email: user.email || "",
    designation: user.designation || "",
    zone: user.zone || "",
    state: user.state || "",
    cityArea: user.cityArea || "",
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const cancelEdit = () => {
  setEditingUserId(null);
  resetForm();
};

const updateExistingUser = async (e) => {
  e.preventDefault();

  if (!editingUserId) return;

  try {
    await update(ref(database, `users/${editingUserId}`), {
      name: form.name.trim(),
      email: form.email.trim(),
      designation: form.designation.trim(),
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

const deleteUser = async (uid) => {
  if (!window.confirm("Remove this user from database?")) return;

  try {
    await remove(ref(database, `users/${uid}`));
    alert("User removed from database.");
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

  return (
    <div className="manage-users-page">
      <div className="users-header">
        <div>
          <Link to="/super-admin">← Back to Dashboard</Link>
          <h1>User Master Data</h1>
          <p>Create employees with designation, city, state and zone.</p>
        </div>
      </div>

      <div className="users-card form-card">
        <div className="card-title-row">
          <div>
           <h2>{editingUserId ? "Edit User" : "Add Single User"}</h2>
<p>
  {editingUserId
    ? "Update employee details."
    : "Create one employee account with default password."}
</p>
          </div>

          <span className="password-pill">Default: {DEFAULT_PASSWORD}</span>
        </div>

        <form
  onSubmit={editingUserId ? updateExistingUser : createSingleUser}
  className="users-form-grid"
>
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

         <input
  placeholder="Email Address"
  type="email"
  value={form.email}
  disabled={!!editingUserId}
  onChange={(e) => setForm({ ...form, email: e.target.value })}
  required
/>

          <select
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            required
          >
            <option value="">Select Designation</option>
            {designations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={form.cityArea}
            onChange={(e) => handleCityChange(e.target.value)}
            required
          >
            <option value="">Select City / Area</option>
            {allCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <input placeholder="State Auto-filled" value={form.state} readOnly required />
          <input placeholder="Zone Auto-filled" value={form.zone} readOnly required />

        <button type="submit" disabled={creating}>
  {editingUserId
    ? "Update User"
    : creating
    ? "Creating..."
    : "Create User"}
</button>

{editingUserId && (
  <button type="button" className="cancel-edit-btn" onClick={cancelEdit}>
    Cancel
  </button>
)}
        </form>
      </div>

      <div className="users-card">
        <div className="bulk-head">
          <div>
            <h2>Bulk Upload Users</h2>
            <p className="upload-help">
              Excel columns required: name, email, designation, cityArea
            </p>
          </div>

          <button className="template-btn" onClick={downloadTemplate}>
            Download Template
          </button>
        </div>

        <label className="upload-box">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleBulkUpload}
          />

          <div className="upload-icon">⬆</div>
          <h3>Upload Excel File</h3>
          <p>Click here to upload .xlsx, .xls or .csv user list</p>
        </label>

        {bulkStatus && <p className="bulk-status">{bulkStatus}</p>}
      </div>

      <div className="users-card">
        <h2>Existing Users</h2>

        <div className="users-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Zone</th>
                <th>State</th>
                <th>City / Area</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.designation}</td>
                  <td>{user.zone}</td>
                  <td>{user.state}</td>
                  <td>{user.cityArea}</td>
                  <td>
  <div className="user-actions">
    <button onClick={() => startEditUser(user)}>Edit</button>

    <button onClick={() => resetUserPassword(user.email)}>
      Reset Password
    </button>

    <button className="danger" onClick={() => deleteUser(user.id)}>
      Remove
    </button>
  </div>
</td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                <td colSpan="7">No users created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {uploadModal.open && (
        <div className="upload-modal-overlay">
          <div className="upload-modal">
            <div className="modal-loader"></div>

            <h2>
              {uploadModal.status === "done"
                ? "Upload Completed"
                : "Adding Users"}
            </h2>

            <p>
              {uploadModal.status === "done"
                ? `${uploadModal.success} users added, ${uploadModal.failed} failed.`
                : `Adding ${uploadModal.current}/${uploadModal.total}`}
            </p>

            <div className="modal-progress">
              <span
                style={{
                  width: `${
                    uploadModal.total > 0
                      ? Math.round(
                          (uploadModal.current / uploadModal.total) * 100
                        )
                      : 0
                  }%`,
                }}
              ></span>
            </div>

            <div className="modal-counts">
              <span>Success: {uploadModal.success}</span>
              <span>Failed: {uploadModal.failed}</span>
            </div>

            {uploadModal.status === "done" && (
              <button
                onClick={() =>
                  setUploadModal({
                    open: false,
                    current: 0,
                    total: 0,
                    success: 0,
                    failed: 0,
                    status: "idle",
                  })
                }
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;