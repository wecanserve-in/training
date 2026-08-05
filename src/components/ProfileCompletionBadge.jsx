import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/profilecompletion.css";

function ProfileCompletionBadge({ profileData, profilePath = "/profile" }) {
  const navigate = useNavigate();

  const percent = useMemo(() => {
    if (!profileData) return 0;

    const fields = [
      profileData.name,
      profileData.phone,
      profileData.dob,
      profileData.gender,
      profileData.maritalStatus,
      profileData.nativePlace,
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

  if (percent >= 100) return null;

  const getColor = (pct) => {
    if (pct < 30) return { ring: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#dc2626", label: "#dc2626" };
    if (pct < 60) return { ring: "#d97706", bg: "#fffbeb", border: "#fde68a", text: "#d97706", label: "#d97706" };
    if (pct < 85) return { ring: "#ea580c", bg: "#fff7ed", border: "#fed7aa", text: "#ea580c", label: "#ea580c" };
    return { ring: "#059669", bg: "#f0fdf4", border: "#bbf7d0", text: "#059669", label: "#059669" };
  };

  const colors = getColor(percent);

  const radius = 22;
  const stroke = 4;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="pcb-floating"
      onClick={() => navigate(profilePath)}
      title="Complete your profile"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div className="pcb-ring-wrap">
        <svg height={radius * 2} width={radius * 2} className="pcb-ring">
          <circle
            stroke="#e2e8f0"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={colors.ring}
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease" }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(-90 ${radius} ${radius})`}
          />
        </svg>
        <span className="pcb-percent" style={{ color: colors.text }}>{percent}</span>
      </div>
      <span className="pcb-label" style={{ background: colors.label }}>Complete Your Profile</span>
    </div>
  );
}

export default ProfileCompletionBadge;
