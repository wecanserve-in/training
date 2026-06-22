import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/dashboard.css";

function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const completedSnap = await get(
        ref(database, `completedCourses/${user.uid}`)
      );

      if (!completedSnap.exists()) {
        setCertificates([]);
        setLoading(false);
        return;
      }

      const completedData = completedSnap.val();

      const passedCertificates = Object.entries(completedData)
        .filter(([_, item]) => item?.passed && item?.attemptId)
        .map(([courseId, item]) => ({
          courseId,
          ...item,
        }))
        .sort(
          (a, b) =>
            new Date(b.completedAt || 0).getTime() -
            new Date(a.completedAt || 0).getTime()
        );

      setCertificates(passedCertificates);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) return <h2 className="dashboard-loading">Loading Certificates...</h2>;

  return (
    <div className="certificates-page">
      <div className="certificates-header">
        <h1>My Certificates</h1>
        <p>View and download your earned certificates.</p>
      </div>

      {certificates.length === 0 ? (
        <div className="cert-empty-card">
          <h2>No certificates earned yet.</h2>
          <p>Complete a course and pass the quiz to earn a certificate.</p>
        </div>
      ) : (
        <div className="certificate-grid">
          {certificates.map((item, index) => (
            <div className="certificate-card" key={item.attemptId}>
              <div className={`cert-ribbon ribbon-${index % 4}`}>
                <span>Certificate</span>
              </div>

              <h2>{item.courseTitle || item.videoTitle || "Training Course"}</h2>

              <p>Earned on {formatDate(item.completedAt)}</p>

              <Link to={`/certificate/${item.attemptId}`}>
                <button>Download</button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Certificates;