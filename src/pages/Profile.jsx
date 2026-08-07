import { useEffect, useRef, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth, database } from "../firebase";
import { ref, get, update } from "firebase/database";
import "../styles/profile.css";

// --- R2 IMPORT ---
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- R2 CLIENT INITIALIZATION ---
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const createEmptyChild = () => ({
  name: "",
  dob: "",
});

function Profile() {
  const [userData, setUserData] = useState(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    dob: "",
    gender: "",
    maritalStatus: "",
    anniversaryDate: "",
    spouseName: "",
    numberOfKids: 0,
    kids: [],
    nativePlace: "",
    residentialAddress: "",
    emergencyContact: "",
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        return;
      }

      const snapshot = await get(ref(database, `users/${user.uid}`));

      if (snapshot.exists()) {
        const data = snapshot.val();
        const savedKids = Array.isArray(data.kids)
          ? data.kids
          : data.kids && typeof data.kids === "object"
            ? Object.values(data.kids)
            : [];

        const numberOfKids = Math.max(
          Number(data.numberOfKids || 0),
          savedKids.length
        );

        const normalizedKids = Array.from(
          { length: numberOfKids },
          (_, index) => ({
            name: savedKids[index]?.name || "",
            dob: savedKids[index]?.dob || "",
          })
        );

        setUserData(data);
        setPhotoPreview(data.photoURL || "");

        setProfileForm({
          name: data.name || "",
          phone: data.phone || "",
          dob: data.dob || "",
          gender: data.gender || "",
          maritalStatus: data.maritalStatus || "",
          anniversaryDate: data.anniversaryDate || "",
          spouseName:
            data.spouseName ||
            data.wifeName ||
            data.husbandName ||
            "",
          numberOfKids,
          kids: normalizedKids,
          nativePlace: data.nativePlace || "",
          residentialAddress:
            data.residentialAddress ||
            data.address ||
            "",
          emergencyContact: data.emergencyContact || "",
        });
      }
    } catch (error) {
      console.error("Profile load error:", error);
      alert("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED R2 PHOTO UPLOAD ---
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    try {
      setUploadingPhoto(true);
      const previewURL = URL.createObjectURL(file);
      setPhotoPreview(previewURL);

      const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;
      const publicDomain = import.meta.env.VITE_R2_PUBLIC_URL;

      if (!bucketName || !publicDomain) {
        throw new Error("R2 environment variables are missing.");
      }

      // Generate a unique file name for R2
      const user = auth.currentUser;
      const fileExtension = file.name.split('.').pop();
      const uniqueFileName = `${user ? user.uid : Date.now()}-${Date.now()}.${fileExtension}`;
      const fileKey = `profile-photos/${uniqueFileName}`;

      // Upload directly to Cloudflare R2
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: file,
        ContentType: file.type,
      });

      await s3Client.send(command);

      const r2PhotoURL = `${publicDomain}/${fileKey}`;

      if (user) {
        await update(ref(database, `users/${user.uid}`), {
          photoURL: r2PhotoURL,
          updatedAt: new Date().toISOString(),
        });
        setUserData((prev) => ({ ...prev, photoURL: r2PhotoURL }));
        setPhotoPreview(r2PhotoURL);
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      alert("Failed to upload photo. Please try again.");
      setPhotoPreview(userData?.photoURL || "");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm("Remove profile photo?")) return;

    try {
      const user = auth.currentUser;
      if (user) {
        await update(ref(database, `users/${user.uid}`), {
          photoURL: "",
          updatedAt: new Date().toISOString(),
        });
        setUserData((prev) => ({ ...prev, photoURL: "" }));
        setPhotoPreview("");
      }
    } catch (error) {
      console.error("Photo delete error:", error);
      alert("Failed to remove photo. Please try again.");
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "maritalStatus") {
        if (value !== "married") {
          next.anniversaryDate = "";
          next.spouseName = "";
          next.numberOfKids = 0;
          next.kids = [];
        }
      }

      return next;
    });
  };

  const handleKidsCountChange = (value) => {
    const count = Math.max(0, Math.min(10, Number(value || 0)));

    setProfileForm((prev) => {
      const updatedKids = Array.from({ length: count }, (_, index) => {
        return prev.kids[index] || createEmptyChild();
      });

      return {
        ...prev,
        numberOfKids: count,
        kids: updatedKids,
      };
    });
  };

  const handleKidChange = (index, field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      kids: prev.kids.map((kid, kidIndex) =>
        kidIndex === index
          ? {
              ...kid,
              [field]: value,
            }
          : kid
      ),
    }));
  };

  const getSpouseLabel = () => {
    if (profileForm.gender === "male") return "Wife Name";
    if (profileForm.gender === "female") return "Husband Name";
    return "Spouse Name";
  };

  const handleProfileUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!profileForm.name.trim()) {
        alert("Full name is required");
        return;
      }

      if (!profileForm.dob) {
        alert("Date of birth is required");
        return;
      }

      if (!profileForm.gender) {
        alert("Please select gender");
        return;
      }

      if (!profileForm.maritalStatus) {
        alert("Please select marital status");
        return;
      }

      if (profileForm.maritalStatus === "married") {
        if (!profileForm.spouseName.trim()) {
          alert(`${getSpouseLabel()} is required`);
          return;
        }

        if (!profileForm.anniversaryDate) {
          alert("Anniversary date is required");
          return;
        }

        const incompleteKid = profileForm.kids.find(
          (kid) => !kid.name.trim() || !kid.dob
        );

        if (incompleteKid) {
          alert("Please enter every child's name and date of birth");
          return;
        }
      }

      if (!profileForm.nativePlace.trim()) {
        alert("Native place is required");
        return;
      }

      if (!profileForm.residentialAddress.trim()) {
        alert("Residential address is required");
        return;
      }

      setSavingProfile(true);

      const cleanKids = profileForm.kids.map((kid) => ({
        name: kid.name.trim(),
        dob: kid.dob,
      }));

      const cleanData = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        dob: profileForm.dob,
        gender: profileForm.gender,
        maritalStatus: profileForm.maritalStatus,
        anniversaryDate:
          profileForm.maritalStatus === "married"
            ? profileForm.anniversaryDate
            : "",
        spouseName:
          profileForm.maritalStatus === "married"
            ? profileForm.spouseName.trim()
            : "",
        numberOfKids: Number(profileForm.numberOfKids || 0),
        kids: cleanKids,
        nativePlace: profileForm.nativePlace.trim(),
        residentialAddress: profileForm.residentialAddress.trim(),
        address: profileForm.residentialAddress.trim(),
        emergencyContact: profileForm.emergencyContact.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (
        profileForm.maritalStatus === "married" &&
        profileForm.gender === "male"
      ) {
        cleanData.wifeName = profileForm.spouseName.trim();
        cleanData.husbandName = "";
      } else if (
        profileForm.maritalStatus === "married" &&
        profileForm.gender === "female"
      ) {
        cleanData.husbandName = profileForm.spouseName.trim();
        cleanData.wifeName = "";
      } else {
        cleanData.wifeName = "";
        cleanData.husbandName = "";
      }

      await update(ref(database, `users/${user.uid}`), cleanData);

      setUserData((prev) => ({
        ...prev,
        ...cleanData,
      }));

      window.dispatchEvent(new CustomEvent("profile-updated", { detail: cleanData }));

      alert("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      alert("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const closePasswordModal = () => {
    if (savingPassword) return;

    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handlePasswordUpdate = async () => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        alert("Fill all password fields");
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

      const user = auth.currentUser;

      if (!user?.email) {
        alert("Unable to verify your account");
        return;
      }

      setSavingPassword(true);

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      alert("Password updated successfully");
      closePasswordModal();
    } catch (error) {
      console.error("Password update error:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        alert("Current password is incorrect");
      } else if (error.code === "auth/weak-password") {
        alert("Please choose a stronger password");
      } else if (error.code === "auth/requires-recent-login") {
        alert("Please log out, log in again and retry");
      } else {
        alert(error.message || "Failed to update password");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <h2 className="profile-loading">Loading Profile...</h2>;
  }

  const profileFields = [
    profileForm.name,
    profileForm.phone,
    profileForm.dob,
    profileForm.gender,
    profileForm.maritalStatus,
    profileForm.nativePlace,
    profileForm.residentialAddress,
    profileForm.emergencyContact,
  ];

  const marriedFields = profileForm.maritalStatus === "married"
    ? [profileForm.spouseName, profileForm.anniversaryDate]
    : [];

  const allFields = [...profileFields, ...marriedFields];
  const filledFields = allFields.filter((f) => f && String(f).trim()).length;
  const profilePercent = Math.round((filledFields / allFields.length) * 100);

  return (
    <div className="profile-page">
      <div className="profile-hero-section">
        <div className="profile-hero-left">
          <div className="profile-hero-avatar-wrap">
            <div className="profile-hero-avatar">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="profile-hero-img"
                />
              ) : (
                (profileForm.name || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="profile-photo-actions">
              <button
                type="button"
                className="profile-photo-edit-btn"
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="Change profile photo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
              {photoPreview && (
                <button
                  type="button"
                  className="profile-photo-delete-btn"
                  onClick={handleDeletePhoto}
                  disabled={uploadingPhoto}
                  title="Remove profile photo"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: "none" }}
            />
            {uploadingPhoto && <span className="profile-photo-uploading">Uploading...</span>}
          </div>
          <div className="profile-hero-info">
            <h1>{profileForm.name || "User"}</h1>
            <p>{auth.currentUser?.email || ""}</p>
            <div className="profile-completion-row">
              <div className="profile-completion-bar">
                <div
                  className="profile-completion-fill"
                  style={{ width: `${profilePercent}%` }}
                />
              </div>
              <span className="profile-completion-text">
                Profile {profilePercent}% complete
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="change-password-btn"
          onClick={() => setShowPasswordModal(true)}
        >
          Change Password
        </button>
      </div>

      <div className="profile-grid">
        <div className="profile-card profile-main-card">

          <div className="profile-section">
            <div className="profile-section-header">
              <h2>Personal Information</h2>
              <p>Basic details about yourself</p>
            </div>

            <div className="profile-form profile-two-column-form">
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
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => handleProfileChange("phone", e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="profile-row">
                <label>Date of Birth</label>
                <input
                  type="date"
                  value={profileForm.dob}
                  onChange={(e) => handleProfileChange("dob", e.target.value)}
                />
              </div>

              <div className="profile-row">
                <label>Gender</label>
                <div className="profile-radio-group">
                  {["male", "female", "other"].map((option) => (
                    <label className="profile-radio-label" key={option}>
                      <input
                        type="radio"
                        name="gender"
                        value={option}
                        checked={profileForm.gender === option}
                        onChange={(e) => handleProfileChange("gender", e.target.value)}
                      />
                      <span className="profile-radio-custom" />
                      <span className="profile-radio-text">
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="profile-divider" />

          <div className="profile-section">
            <div className="profile-section-header">
              <h2>Family Details</h2>
              <p>Marital status and family information</p>
            </div>

            <div className="profile-form profile-two-column-form">
              <div className="profile-row">
                <label>Marital Status</label>
                <div className="profile-radio-group">
                  {["unmarried", "married"].map((option) => (
                    <label className="profile-radio-label" key={option}>
                      <input
                        type="radio"
                        name="maritalStatus"
                        value={option}
                        checked={profileForm.maritalStatus === option}
                        onChange={(e) => handleProfileChange("maritalStatus", e.target.value)}
                      />
                      <span className="profile-radio-custom" />
                      <span className="profile-radio-text">
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {profileForm.maritalStatus === "married" && (
                <>
                  <div className="profile-row">
                    <label>{getSpouseLabel()}</label>
                    <input
                      value={profileForm.spouseName}
                      onChange={(e) => handleProfileChange("spouseName", e.target.value)}
                      placeholder={`Enter ${getSpouseLabel().toLowerCase()}`}
                    />
                  </div>

                  <div className="profile-row">
                    <label>Anniversary Date</label>
                    <input
                      type="date"
                      value={profileForm.anniversaryDate}
                      onChange={(e) => handleProfileChange("anniversaryDate", e.target.value)}
                    />
                  </div>

                  <div className="profile-row">
                    <label>Number of Kids</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={profileForm.numberOfKids}
                      onChange={(e) => handleKidsCountChange(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {profileForm.numberOfKids > 0 && (
              <div className="children-section">
                <div className="children-section-head">
                  <div>
                    <h3>Children Details</h3>
                    <p>Enter every child&apos;s name and date of birth.</p>
                  </div>
                </div>

                <div className="children-list">
                  {profileForm.kids.map((kid, index) => (
                    <div className="child-card" key={`child-${index}`}>
                      <span className="child-number">
                        Child {index + 1}
                      </span>
                      <div className="profile-row">
                        <label>Child Name</label>
                        <input
                          value={kid.name}
                          onChange={(e) => handleKidChange(index, "name", e.target.value)}
                          placeholder={`Enter child ${index + 1} name`}
                        />
                      </div>
                      <div className="profile-row">
                        <label>Date of Birth</label>
                        <input
                          type="date"
                          value={kid.dob}
                          onChange={(e) => handleKidChange(index, "dob", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="profile-divider" />

          <div className="profile-section">
            <div className="profile-section-header">
              <h2>Address & Emergency</h2>
              <p>Residential address and emergency contact</p>
            </div>

            <div className="profile-form profile-two-column-form">
              <div className="profile-row">
                <label>Native Place</label>
                <input
                  value={profileForm.nativePlace}
                  onChange={(e) => handleProfileChange("nativePlace", e.target.value)}
                  placeholder="Enter native place"
                />
              </div>

              <div className="profile-row">
                <label>Emergency Contact</label>
                <input
                  type="tel"
                  value={profileForm.emergencyContact}
                  onChange={(e) => handleProfileChange("emergencyContact", e.target.value)}
                  placeholder="Enter emergency contact"
                />
              </div>

              <div className="profile-row profile-full-row">
                <label>Residential Address</label>
                <textarea
                  rows="3"
                  value={profileForm.residentialAddress}
                  onChange={(e) => handleProfileChange("residentialAddress", e.target.value)}
                  placeholder="Enter complete residential address"
                />
              </div>
            </div>
          </div>

          <div className="profile-full-row profile-save-row">
            <button
              type="button"
              className="profile-btn"
              onClick={handleProfileUpdate}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="profile-card company-details-card">
          <div className="profile-section-header">
            <h2>Company Details</h2>
            <p>Information assigned by your organization</p>
          </div>

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
      </div>

      {showPasswordModal && (
        <div
          className="password-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <div
            className="password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-modal-title"
          >
            <div className="password-modal-head">
              <div>
                <span>Account Security</span>
                <h2 id="password-modal-title">Change Password</h2>
                <p>Enter your current password before setting a new one.</p>
              </div>

              <button
                type="button"
                className="password-modal-close"
                onClick={closePasswordModal}
                aria-label="Close password popup"
              >
                ×
              </button>
            </div>

            <div className="profile-form password-modal-form">
              <div className="profile-row">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) =>
                    setCurrentPassword(e.target.value)
                  }
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>

              <div className="profile-row">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
              </div>

              <div className="profile-row">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>

              <div className="password-modal-actions">
                <button
                  type="button"
                  className="password-cancel-btn"
                  onClick={closePasswordModal}
                  disabled={savingPassword}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="profile-btn"
                  onClick={handlePasswordUpdate}
                  disabled={savingPassword}
                >
                  {savingPassword
                    ? "Updating..."
                    : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;