import { useEffect, useState } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/manageadmins.css";

function ManageAdmins() {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const loadData = async () => {
    const snap = await get(ref(database, "users"));

    if (!snap.exists()) {
      setUsers([]);
      setAdmins([]);
      return;
    }

    const data = snap.val();

    const userList = Object.entries(data)
      .filter(([_, user]) => user.role === "user")
      .map(([id, user]) => ({ id, ...user }));

    const adminList = Object.entries(data)
      .filter(([_, user]) => user.role === "admin")
      .map(([id, user]) => ({ id, ...user }));

    setUsers(userList);
    setAdmins(adminList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const assignAdmin = async (e) => {
    e.preventDefault();

    if (!selectedUserId) {
      alert("Please select a user first.");
      return;
    }

    setAssigning(true);

    try {
      await update(ref(database, `users/${selectedUserId}`), {
        role: "admin",
        promotedAt: new Date().toISOString(),
      });

      alert("User assigned as Admin successfully.");

      setSelectedUserId("");
      loadData();
    } catch (error) {
      alert(error.message);
    }

    setAssigning(false);
  };

  const removeAdminRole = async (uid) => {
    if (!window.confirm("Remove admin access from this user?")) return;

    await update(ref(database, `users/${uid}`), {
      role: "user",
      removedAdminAt: new Date().toISOString(),
    });

    loadData();
  };

  return (
    <div className="manage-admins-page">
      <div className="manage-admins-header">
        <h1>Manage Admins</h1>
        <p>Select an existing user and assign admin access.</p>
      </div>

      <div className="admin-create-card">
        <h2>Assign Admin Access</h2>

        <form onSubmit={assignAdmin} className="assign-admin-form">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">Select User</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.designation} — {user.cityArea}
              </option>
            ))}
          </select>

          <button type="submit" disabled={assigning}>
            {assigning ? "Assigning..." : "Assign as Admin"}
          </button>
        </form>

        {selectedUser && (
          <div className="selected-user-preview">
            <h3>Selected User</h3>

            <div className="preview-grid">
              <div>
                <span>Name</span>
                <strong>{selectedUser.name}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{selectedUser.email}</strong>
              </div>

              <div>
                <span>Designation</span>
                <strong>{selectedUser.designation}</strong>
              </div>

              <div>
                <span>Zone</span>
                <strong>{selectedUser.zone}</strong>
              </div>

              <div>
                <span>State</span>
                <strong>{selectedUser.state}</strong>
              </div>

              <div>
                <span>City / Area</span>
                <strong>{selectedUser.cityArea}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="admins-table-card">
        <h2>Existing Admins</h2>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Zone</th>
              <th>State</th>
              <th>City / Area</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>{admin.designation}</td>
                <td>{admin.zone}</td>
                <td>{admin.state}</td>
                <td>{admin.cityArea}</td>
                <td>
                  <button onClick={() => removeAdminRole(admin.id)}>
                    Remove Access
                  </button>
                </td>
              </tr>
            ))}

            {admins.length === 0 && (
              <tr>
                <td colSpan="7">No admins assigned yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageAdmins;