import { useEffect, useMemo, useState } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../firebase";
import "../styles/manageadmins.css";

function ManageAdmins() {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");

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
    const snap = await get(ref(database, "users"));

    if (!snap.exists()) {
      setUsers([]);
      setAdmins([]);
      return;
    }

    const data = snap.val();

    const normalUsers = Object.entries(data)
      .filter(([_, user]) => user.role === "user")
      .map(([id, user]) => ({ id, ...user }));

    const adminList = Object.entries(data)
      .filter(([_, user]) => user.role === "admin")
      .map(([id, user]) => ({ id, ...user }));

    setUsers(normalUsers);
    setAdmins(adminList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (q) {
      return users.filter((user) => {
        return (
          user.name?.toLowerCase().includes(q) ||
          user.email?.toLowerCase().includes(q) ||
          user.designation?.toLowerCase().includes(q) ||
          user.cityArea?.toLowerCase().includes(q) ||
          user.state?.toLowerCase().includes(q) ||
          user.zone?.toLowerCase().includes(q)
        );
      });
    }

    return users.filter((user) => isHigherPost(user));
  }, [users, search]);

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
      setSearch("");
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
        <div>
          <h1>Manage Admins</h1>
          <p>
            Default list shows only senior and higher-post users. Search can find
            any user if needed.
          </p>
        </div>
      </div>

      <div className="admins-layout-grid">
        <div className="admin-create-card">
          <div className="card-title-row">
            <div>
              <h2>Assign Admin Access</h2>
              <p>Select a senior or higher-post user and promote them as Admin.</p>
            </div>
          </div>

          <form onSubmit={assignAdmin} className="assign-admin-form">
            <input
              type="text"
              placeholder="Search any user by name, email, designation, city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedUserId("");
              }}
            />

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">
                {search ? "Select searched user" : "Select eligible user"}
              </option>

              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.designation || "No Designation"} — {user.name}{" "}
                  {user.seniority ? `(${user.seniority})` : ""}
                </option>
              ))}
            </select>

            <button type="submit" disabled={assigning}>
              {assigning ? "Assigning..." : "Assign Admin"}
            </button>
          </form>

          {filteredUsers.length === 0 && (
            <p className="empty-help">
              No users found. Try searching by name, email, designation or city.
            </p>
          )}

          {selectedUser && (
            <div className="selected-user-preview">
              <span>Selected User</span>
              <h3>{selectedUser.name}</h3>
              <p>{selectedUser.designation}</p>
              <p>
                {selectedUser.seniority
                  ? selectedUser.seniority.charAt(0).toUpperCase() +
                    selectedUser.seniority.slice(1)
                  : "No seniority selected"}
              </p>
            </div>
          )}
        </div>

        <div className="admin-info-card">
          <h2>Admin Assignment Rule</h2>
          <p>
            The normal dropdown stays clean by showing only Senior users and
            higher posts like Manager, Head, Lead, Director or Supervisor.
          </p>

          <div className="rule-box">
            <strong>Default dropdown</strong>
            <span>Senior + higher designation users</span>
          </div>

          <div className="rule-box">
            <strong>Search backup</strong>
            <span>Can find any user manually</span>
          </div>
        </div>
      </div>

      <div className="admins-table-card">
        <div className="card-title-row">
          <div>
            <h2>Existing Admins</h2>
            <p>{admins.length} admins assigned</p>
          </div>
        </div>

        <div className="admins-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Designation</th>
                <th>Name</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.designation || "-"}</td>
                  <td>{admin.name || "-"}</td>
                  <td>
                    {admin.seniority
                      ? admin.seniority.charAt(0).toUpperCase() +
                        admin.seniority.slice(1)
                      : "-"}
                  </td>
                  <td>
                    <button onClick={() => removeAdminRole(admin.id)}>
                      Remove Access
                    </button>
                  </td>
                </tr>
              ))}

              {admins.length === 0 && (
                <tr>
                  <td colSpan="4">No admins assigned yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManageAdmins;