import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, get, update } from "firebase/database";
import "../styles/profile.css";

function Profile() {
  const [userData, setUserData] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    address: "",
    emergencyContact: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const snapshot = await get(ref(database, `users/${user.uid}`));

    if (snapshot.exists()) {
      const data = snapshot.val();
      setUserData(data);

      setProfileForm({
        name: data.name || "",
        phone: data.phone || "",
        address: data.address || "",
        emergencyContact: data.emergencyContact || "",
      });
    }

    setLoading(false);
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfileUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!profileForm.name.trim()) {
        alert("Full name is required");
        return;
      }

      setSavingProfile(true);

      const cleanData = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
        emergencyContact: profileForm.emergencyContact.trim(),
        updatedAt: new Date().toISOString(),
      };

      await update(ref(database, `users/${user.uid}`), cleanData);

      setUserData((prev) => ({
        ...prev,
        ...cleanData,
      }));

      alert("Profile updated successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

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

      if (newPassword.length < 6) {
        alert("Password should be at least 6 characters");
        return;
      }

      setSavingPassword(true);

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
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <h2 className="profile-loading">Loading Profile...</h2>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <span>Account Settings</span>
          <h1>Profile & Settings</h1>
          <p>Manage your personal information and password.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <h2>Profile Information</h2>

          <div className="profile-top">
            <div className="profile-avatar">
              {(profileForm.name || "U").charAt(0).toUpperCase()}
            </div>

            <div>
              <h3>{profileForm.name || "User"}</h3>
              <p>{auth.currentUser?.email || ""}</p>
            </div>
          </div>

          <div className="profile-form">
            <div className="profile-row">
              <label>Full Name</label>
              <input
                value={profileForm.name}
                onChange={(e) => handleProfileChange("name", e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div className="profile-row">
              <label>Phone Number</label>
              <input
                value={profileForm.phone}
                onChange={(e) => handleProfileChange("phone", e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="profile-row">
              <label>Address</label>
              <input
                value={profileForm.address}
                onChange={(e) => handleProfileChange("address", e.target.value)}
                placeholder="Enter address"
              />
            </div>

            <div className="profile-row">
              <label>Emergency Contact</label>
              <input
                value={profileForm.emergencyContact}
                onChange={(e) =>
                  handleProfileChange("emergencyContact", e.target.value)
                }
                placeholder="Enter emergency contact"
              />
            </div>

            <button
              className="profile-btn"
              onClick={handleProfileUpdate}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="profile-card">
          <h2>Company Details</h2>

          <div className="profile-form">
            <div className="profile-row">
              <label>Email</label>
              <input value={auth.currentUser?.email || ""} disabled />
            </div>

            <div className="profile-row">
              <label>Designation</label>
              <input value={userData?.designation || "-"} disabled />
            </div>

            <div className="profile-row">
              <label>Role</label>
              <input value={userData?.role || "-"} disabled />
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
              <input value={userData?.cityArea || userData?.city || "-"} disabled />
            </div>
          </div>
        </div>

        <div className="profile-card password-card">
          <h2>Change Password</h2>

          <div className="profile-form">
            <div className="profile-row">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="profile-row">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="profile-row">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <button
              className="profile-btn"
              onClick={handlePasswordUpdate}
              disabled={savingPassword}
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;