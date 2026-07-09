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
  const [adminSearch, setAdminSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

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
    const snap = await get(ref(database, "users"));

    if (!snap.exists()) {
      setUsers([]);
      setAdmins([]);
      return;
    }

    const data = snap.val();

    const userList = Object.entries(data)
      .filter(([, user]) => user.role === "user")
      .map(([id, user]) => ({ id, ...user }))
      .sort((a, b) => {
        const aSenior = isHigherPost(a) ? 1 : 0;
        const bSenior = isHigherPost(b) ? 1 : 0;

        if (bSenior !== aSenior) return bSenior - aSenior;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const adminList = Object.entries(data)
      .filter(([, user]) => user.role === "admin")
      .map(([id, user]) => ({ id, ...user }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    setUsers(userList);
    setAdmins(adminList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const eligibleUsers = useMemo(() => {
    return users.filter((user) => isHigherPost(user));
  }, [users]);

  const shownUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    const source = q ? users : eligibleUsers;

    return source
      .filter((user) => {
        if (!q) return true;

        const searchText = [
          user.name,
          user.email,
          user.designation,
          user.cityArea,
          user.state,
          user.zone,
          user.seniority,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(q);
      })
      .slice(0, 8);
  }, [users, eligibleUsers, search]);

  const filteredAdmins = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();

    if (!q) return admins;

    return admins.filter((admin) => {
      const text = [
        admin.name,
        admin.email,
        admin.designation,
        admin.seniority,
        admin.cityArea,
        admin.state,
        admin.zone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [admins, adminSearch]);

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    setSearch(user.name || "");
  };

  const openModal = () => {
    setModalOpen(true);
    setSearch("");
    setSelectedUserId("");
  };

  const closeModal = () => {
    setModalOpen(false);
    setSearch("");
    setSelectedUserId("");
  };

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

      setSelectedUserId("");
      setSearch("");
      setModalOpen(false);
      loadData();
    } catch (error) {
      alert(error.message);
    } finally {
      setAssigning(false);
    }
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
          <h1>Admins</h1>
          <p>View and manage all admins from one clean dashboard.</p>
        </div>

        <button className="new-admin-btn" onClick={openModal}>
          + New Admin
        </button>
      </div>

      <div className="admins-table-card">
        <div className="admins-top-row">
          <div>
            <h2>All Admins</h2>
            <p>{admins.length} admins assigned</p>
          </div>

          <input
            type="text"
            placeholder="Search admins..."
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
          />
        </div>

        <div className="admins-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Type</th>
                <th>City</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.name || "-"}</td>
                  <td>{admin.email || "-"}</td>
                  <td>{admin.designation || "-"}</td>
                  <td>
                    {admin.seniority
                      ? admin.seniority.charAt(0).toUpperCase() +
                        admin.seniority.slice(1)
                      : "-"}
                  </td>
                  <td>{admin.cityArea || "-"}</td>
                  <td>
                    <button
                      className="remove-admin-btn"
                      onClick={() => removeAdminRole(admin.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {filteredAdmins.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table">
                    No admins found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <h2>Make New Admin</h2>
                <p>Search any user or choose from senior eligible users.</p>
              </div>

              <button onClick={closeModal}>×</button>
            </div>

            <form onSubmit={assignAdmin} className="assign-admin-form">
              <div className="admin-search-box">
                <input
                  type="text"
                  placeholder="Search user by name, email, designation..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedUserId("");
                  }}
                  autoFocus
                />

                <div className="user-dropdown">
                  {shownUsers.map((user) => (
                    <button
                      type="button"
                      key={user.id}
                      className={`user-option ${
                        selectedUserId === user.id ? "active" : ""
                      }`}
                      onClick={() => selectUser(user)}
                    >
                      <div>
                        <strong>{user.name || "Unnamed User"}</strong>
                        <span>{user.email || "No email"}</span>
                      </div>

                      <small>
                        {user.designation || "No designation"} •{" "}
                        {user.seniority || "No type"}
                      </small>
                    </button>
                  ))}

                  {shownUsers.length === 0 && (
                    <p className="empty-help">No user found.</p>
                  )}
                </div>
              </div>

              {selectedUser && (
                <div className="selected-user-preview">
                  <span>Selected User</span>
                  <h3>{selectedUser.name}</h3>
                  <p>
                    {selectedUser.designation || "No designation"} •{" "}
                    {selectedUser.seniority || "No type"} •{" "}
                    {selectedUser.cityArea || "No city"}
                  </p>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>

                <button type="submit" disabled={assigning || !selectedUserId}>
                  {assigning ? "Assigning..." : "Make Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageAdmins;