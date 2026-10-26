import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/profilecompletion.css";

const DISMISS_KEY = "pcb-dismissed";

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Small floating reminder to finish the profile.
 * Can be hidden for the session, and is not shown on the profile page itself.
 */
function ProfileCompletionBadge({ profileData, profilePath = "/profile" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  const percent = useMemo(() => {
    if (!profileData) return 0;

    const fields = [
      profileData.name,
      profileData.phone,
      profileData.dob,
      profileData.gender,
      profileData.maritalStatus,
      profileData.residentialAddress,
      profileData.emergencyContact,
    ];

    const marital = String(profileData.maritalStatus || "").toLowerCase();
    if (marital === "married") {
      fields.push(profileData.spouseName || profileData.wifeName || profileData.husbandName);
      fields.push(profileData.anniversaryDate);
    }

    const total = fields.length;
    const filled = fields.filter((f) => f && String(f).trim()).length;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [profileData]);

  const onProfilePage = location.pathname.endsWith("/profile");
  const visible = Boolean(profileData) && percent < 100 && !dismissed && !onProfilePage;

  // Leave room at the bottom of pages so the badge never hides the last button.
  useEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add("has-pcb");
    return () => document.body.classList.remove("has-pcb");
  }, [visible]);

  if (!visible) return null;

  const tone = percent < 30 ? "low" : percent < 60 ? "mid" : percent < 85 ? "high" : "done";

  const radius = 14;
  const stroke = 3;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const dismiss = (event) => {
    event.stopPropagation();
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked: hide for this page view only.
    }
  };

  return (
    <div className={`pcb-floating pcb-${tone}`} role="complementary" aria-label="Profile completion">
      <button type="button" className="pcb-main" onClick={() => navigate(profilePath)}>
        <svg height={radius * 2} width={radius * 2} className="pcb-ring" aria-hidden="true">
          <circle className="pcb-ring-track" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
          <circle
            className="pcb-ring-value"
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
        </svg>
        <span className="pcb-text">
          <strong>Complete your profile</strong>
          <span>{percent}% done</span>
        </span>
      </button>
      <button type="button" className="pcb-close" onClick={dismiss} aria-label="Hide profile reminder">
        ×
      </button>
    </div>
  );
}

export default ProfileCompletionBadge;
