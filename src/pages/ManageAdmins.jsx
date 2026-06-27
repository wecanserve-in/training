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
      .filter(([_, user]) => user.role === "user")
      .map(([id, user]) => ({ id, ...user }))
      .sort((a, b) => {
        const aSenior = isHigherPost(a) ? 1 : 0;
        const bSenior = isHigherPost(b) ? 1 : 0;

        if (bSenior !== aSenior) return bSenior - aSenior;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const adminList = Object.entries(data)
      .filter(([_, user]) => user.role === "admin")
      .map(([id, user]) => ({ id, ...user }));

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

    if (!q) return eligibleUsers.slice(0, 8);

    return users
      .filter((user) => {
        const searchText = [
          user.name,
          user.email,
          user.designation,
          user.cityArea,
          user.state,
          user.zone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(q);
      })
      .slice(0, 8);
  }, [users, eligibleUsers, search]);

  useEffect(() => {
    if (!search.trim()) return;

    const q = search.trim().toLowerCase();

    const matchedUser =
      users.find((user) => String(user.name || "").toLowerCase() === q) ||
      users.find((user) =>
        String(user.name || "").toLowerCase().includes(q)
      );

    if (matchedUser) {
      setSelectedUserId(matchedUser.id);
    }
  }, [search, users]);

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    setSearch(user.name || "");
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

      alert("User assigned as Admin successfully.");
      setSelectedUserId("");
      setSearch("");
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
          <p>Create admins quickly. Search by name or choose from top eligible users.</p>
        </div>
      </div>

      <div className="admin-create-card clean-admin-card">
        <div className="card-title-row">
          <div>
            <h2>Make User Admin</h2>
            <p>Admin will be able to manage users, courses, departments and reports.</p>
          </div>
        </div>

        <form onSubmit={assignAdmin} className="assign-admin-form clean-admin-form">
          <input
            type="text"
            placeholder="Search user by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button type="submit" disabled={assigning || !selectedUserId}>
            {assigning ? "Assigning..." : "Make Admin"}
          </button>
        </form>

        {selectedUser && (
          <div className="selected-user-preview clean-selected-user">
            <span>Selected User</span>
            <h3>{selectedUser.name}</h3>
            <p>
              {selectedUser.designation || "No designation"} •{" "}
              {selectedUser.seniority || "No type"} •{" "}
              {selectedUser.cityArea || "No city"}
            </p>
          </div>
        )}
      </div>

      <div className="admin-info-card clean-user-list-card">
        <div className="card-title-row">
          <div>
            <h2>{search ? "Search Results" : "Top Eligible Users"}</h2>
            <p>
              {search
                ? "Matching users are shown below."
                : "Senior and higher-post users are shown first."}
            </p>
          </div>
        </div>

        <div className="quick-admin-list">
          {shownUsers.map((user) => (
            <button
              type="button"
              key={user.id}
              className={`quick-admin-chip ${
                selectedUserId === user.id ? "active" : ""
              }`}
              onClick={() => selectUser(user)}
            >
              <strong>{user.name || "Unnamed User"}</strong>
              <span>
                {user.designation || "No designation"} •{" "}
                {user.cityArea || "No city"}
              </span>
            </button>
          ))}

          {shownUsers.length === 0 && (
            <p className="empty-help">No user found with this name.</p>
          )}
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
                <th>Name</th>
                <th>Email</th>
                <th>Designation</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {admins.map((admin) => (
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
                  <td>
                    <button onClick={() => removeAdminRole(admin.id)}>
                      Remove Access
                    </button>
                  </td>
                </tr>
              ))}

              {admins.length === 0 && (
                <tr>
                  <td colSpan="5">No admins assigned yet.</td>
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