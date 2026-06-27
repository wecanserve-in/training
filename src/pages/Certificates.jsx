import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../firebase";
import "../styles/certificates.css";

function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const completedSnap = await get(
          ref(database, `completedCourses/${user.uid}`)
        );

        if (!completedSnap.exists()) {
          setCertificates([]);
          setLoading(false);
          return;
        }

        const completedData = completedSnap.val();

        const passedCertificates = await Promise.all(
          Object.entries(completedData)
            .filter(([_, item]) => item?.passed && item?.attemptId)
            .map(async ([courseId, item]) => {
              const [attemptSnap, courseSnap, userSnap] = await Promise.all([
                get(ref(database, `attempts/${item.attemptId}`)),
                get(ref(database, `courses/${courseId}`)),
                get(ref(database, `users/${user.uid}`)),
              ]);

              return {
                courseId,
                ...item,
                attempt: attemptSnap.exists() ? attemptSnap.val() : {},
                course: courseSnap.exists()
                  ? { id: courseId, ...courseSnap.val() }
                  : {},
                userData: userSnap.exists() ? userSnap.val() : {},
              };
            })
        );

        passedCertificates.sort(
          (a, b) =>
            new Date(b.completedAt || b.attempt?.submittedAt || 0).getTime() -
            new Date(a.completedAt || a.attempt?.submittedAt || 0).getTime()
        );

        setCertificates(passedCertificates);
      } catch (error) {
        console.error(error);
        alert("Failed to load certificates");
      } finally {
        setLoading(false);
      }
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

  if (loading) {
    return <h2 className="dashboard-loading">Loading Certificates...</h2>;
  }

  return (
    <div className="certificates-page">
      <div className="certificates-header">
        <div>
          <span>Achievements</span>
          <h1>My Certificates</h1>
          <p>View and download your earned course certificates.</p>
        </div>

        <strong>{certificates.length} Earned</strong>
      </div>

      {certificates.length === 0 ? (
        <div className="cert-empty-card centered-empty">
          <h2>No certificates earned yet</h2>
          <p>Complete a course and pass the final test to earn your certificate.</p>
        </div>
      ) : (
        <div className="certificate-grid">
          {certificates.map((item) => {
            const courseTitle =
              item.course?.title ||
              item.course?.courseTitle ||
              item.courseTitle ||
              item.attempt?.courseTitle ||
              "Training Course";

            const studentName =
              item.userData?.name ||
              item.userData?.fullName ||
              item.attempt?.userName ||
              "Employee";

            const score = item.attempt?.score ?? item.score ?? 0;

            const completedDate =
              item.completedAt || item.attempt?.submittedAt || item.attempt?.completedAt;

            const certificateId = `CERT-${item.attemptId
              .slice(-8)
              .toUpperCase()}`;

            return (
              <div className="certificate-card" key={item.attemptId}>
                <div className="certificate-preview">
                  <img
                    src="/certificate/certificate.png"
                    alt="Certificate Preview"
                  />

                  <div className="certificate-overlay">
                    <h3>{studentName}</h3>
                    <p>{courseTitle}</p>
                  </div>
                </div>

                <div className="certificate-content">
                  <h2>{courseTitle}</h2>

                  <div className="certificate-meta">
                    <span>Score: {score}%</span>
                    <span>Date: {formatDate(completedDate)}</span>
                  </div>

                  <div className="certificate-id">{certificateId}</div>

                  <Link to={`/certificate/${item.attemptId}`}>
                    <button className="download-certificate-btn">
                      Download Certificate
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Certificates;