import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, get } from "firebase/database";
import "../styles/profile.css";

function Profile() {
  const [userData, setUserData] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;

      if (!user) return;

      const snapshot = await get(ref(database, `users/${user.uid}`));

      if (snapshot.exists()) {
        setUserData(snapshot.val());
      }

      setLoading(false);
    };

    fetchUser();
  }, []);

  const handlePasswordUpdate = async () => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        alert("Fill all fields");
        return;
      }

      if (newPassword !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }

      setSaving(true);

      const user = auth.currentUser;

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);

      alert("Password updated successfully");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }

    setSaving(false);
  };

  if (loading) {
    return <h2>Loading Profile...</h2>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profile & Settings</h1>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <h2>Profile Information</h2>

          <div className="profile-top">
            <div className="profile-avatar">
              {(userData?.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="profile-form">
            <div className="profile-row">
              <label>Full Name</label>
              <input value={userData?.name || ""} disabled />
            </div>

            <div className="profile-row">
              <label>Email</label>
              <input value={auth.currentUser?.email || ""} disabled />
            </div>

            <div className="profile-row">
              <label>Designation</label>
              <input value={userData?.designation || "-"} disabled />
            </div>

            <div className="profile-row">
              <label>Zone</label>
              <input value={userData?.zone || "-"} disabled />
            </div>

            <div className="profile-row">
              <label>State</label>
              <input value={userData?.state || "-"} disabled />
            </div>

            <div className="profile-row">
              <label>City</label>
              <input value={userData?.cityArea || "-"} disabled />
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h2>Change Password</h2>

          <div className="profile-form">
            <div className="profile-row">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="profile-row">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="profile-row">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              className="profile-btn"
              onClick={handlePasswordUpdate}
              disabled={saving}
            >
              {saving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;