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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const higherPostKeywords = [
    "manager", "head", "lead", "director", "admin",
    "supervisor", "team leader", "tl", "senior", "chief",
    "officer", "president", "vp", "avp", "gm", "agm", "dgm",
  ];

  const isHigherPost = (user) => {
    const designation = String(user.designation || "").toLowerCase();
    const seniority = String(user.seniority || "").toLowerCase();
    return seniority === "senior" || higherPostKeywords.some((kw) => designation.includes(kw));
  };

  const loadData = async () => {
    const snap = await get(ref(database, "users"));
    if (!snap.exists()) { setUsers([]); setAdmins([]); return; }
    const data = snap.val();

    const userList = Object.entries(data)
      .filter(([, u]) => u.role === "user")
      .map(([id, u]) => ({ id, ...u }))
      .sort((a, b) => {
        const aS = isHigherPost(a) ? 1 : 0;
        const bS = isHigherPost(b) ? 1 : 0;
        if (bS !== aS) return bS - aS;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const adminList = Object.entries(data)
      .filter(([, u]) => u.role === "admin")
      .map(([id, u]) => ({ id, ...u }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    setUsers(userList);
    setAdmins(adminList);
  };

  useEffect(() => { loadData(); }, []);

  const eligibleUsers = useMemo(() => users.filter((u) => isHigherPost(u)), [users]);

  const shownUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = q ? users : eligibleUsers;
    return source
      .filter((user) => {
        if (!q) return true;
        const text = [user.name, user.email, user.designation, user.cityArea, user.state, user.zone, user.seniority]
          .filter(Boolean).join(" ").toLowerCase();
        return text.includes(q);
      })
      .slice(0, 8);
  }, [users, eligibleUsers, search]);

  const filteredAdmins = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((admin) => {
      const text = [admin.name, admin.email, admin.designation, admin.seniority, admin.cityArea, admin.state, admin.zone]
        .filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [admins, adminSearch]);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    setSearch(user.name || "");
    setDropdownOpen(false);
  };

  const openModal = () => { setModalOpen(true); setSearch(""); setSelectedUserId(""); setDropdownOpen(false); };
  const closeModal = () => { setModalOpen(false); setSearch(""); setSelectedUserId(""); setDropdownOpen(false); };

  const assignAdmin = async (e) => {
    e.preventDefault();
    if (!selectedUserId) { alert("Please select a user first."); return; }
    setAssigning(true);
    try {
      await update(ref(database, `users/${selectedUserId}`), {
        role: "admin",
        promotedAt: new Date().toISOString(),
      });
      setSelectedUserId(""); setSearch(""); setModalOpen(false); loadData();
    } catch (error) { alert(error.message); } finally { setAssigning(false); }
  };

  const removeAdminRole = async (uid) => {
    if (!window.confirm("Remove admin access from this user?")) return;
    await update(ref(database, `users/${uid}`), {
      role: "user",
      removedAdminAt: new Date().toISOString(),
    });
    loadData();
  };

  const seniorityColor = (s) => {
    if (s === "senior") return { bg: "#dcfce7", color: "#166534" };
    if (s === "junior") return { bg: "#dbeafe", color: "#1e40af" };
    return { bg: "#fef3c7", color: "#92400e" };
  };

  return (
    <div className="manage-admins-page">

      {/* Hero Banner */}
      <section className="ma-hero">
        <div className="ma-hero-content">
          <h1>Manage Admins</h1>
          <p>View, promote and manage all admins from one place.</p>
        </div>
        <div className="ma-hero-stats">
          <div className="ma-hero-stat">
            <div className="ma-hero-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <strong>{admins.length}</strong>
              <span>Admins</span>
            </div>
          </div>
          <div className="ma-hero-stat">
            <div className="ma-hero-stat-icon eligible-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <strong>{eligibleUsers.length}</strong>
              <span>Eligible Users</span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="ma-action-bar">
        <div className="ma-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search admins by name, email, designation..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} />
        </div>
        <button className="ma-btn ma-btn-primary" onClick={openModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Admin
        </button>
      </div>

      {/* Admins Table */}
      <div className="ma-table-card">
        <div className="ma-table-header">
          <div>
            <h2>All Admins</h2>
            <p>{filteredAdmins.length} admins assigned</p>
          </div>
        </div>
        <div className="ma-table-wrap">
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin, idx) => (
                <tr key={admin.id}>
                  <td className="ma-td-idx">{idx + 1}</td>
                  <td className="ma-td-name">{admin.name || "-"}</td>
                  <td className="ma-td-email">{admin.email || "-"}</td>
                  <td>{admin.designation || "-"}</td>
                  <td>
                    <span className="ma-badge" style={seniorityColor(admin.seniority)}>
                      {admin.seniority ? admin.seniority.charAt(0).toUpperCase() + admin.seniority.slice(1) : "-"}
                    </span>
                  </td>
                  <td>{admin.zone || "-"}</td>
                  <td>{admin.state || "-"}</td>
                  <td>{admin.cityArea || "-"}</td>
                  <td>
                    <button className="ma-action-remove" onClick={() => removeAdminRole(admin.id)} title="Remove Admin">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAdmins.length === 0 && (
                <tr><td colSpan="9" className="ma-empty">No admins found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Admin Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content ma-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-modal-head">
              <div>
                <h2>Make New Admin</h2>
                <p>Search any user or choose from senior eligible users.</p>
              </div>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={assignAdmin} className="ma-assign-form">
              <div className="ma-admin-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Search user by name, email, designation..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedUserId(""); setDropdownOpen(true); }}
                  onFocus={() => { if (!selectedUserId) setDropdownOpen(true); }}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                />
                {dropdownOpen && !selectedUserId && (
                  <div className="ma-user-dropdown" onMouseDown={(e) => e.preventDefault()}>
                    {shownUsers.map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        className="ma-user-option"
                        onClick={() => selectUser(user)}
                      >
                        <div>
                          <strong>{user.name || "Unnamed User"}</strong>
                          <span>{user.email || "No email"}</span>
                        </div>
                        <small>{user.designation || "-"} • {user.seniority || "-"}</small>
                      </button>
                    ))}
                    {shownUsers.length === 0 && <p className="ma-empty-help">No user found.</p>}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="ma-selected-preview" onClick={() => { setSelectedUserId(""); setSearch(""); setDropdownOpen(true); }} style={{ cursor: "pointer" }}>
                  <span>Selected User</span>
                  <h3>{selectedUser.name}</h3>
                  <p>{selectedUser.designation || "No designation"} • {selectedUser.seniority || "No type"} • {selectedUser.cityArea || "No city"}</p>
                </div>
              )}

              <div className="ma-modal-actions">
                <button type="button" className="ma-btn ma-btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="ma-btn ma-btn-primary" disabled={assigning || !selectedUserId}>
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
