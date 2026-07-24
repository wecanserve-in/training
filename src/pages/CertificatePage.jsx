import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FaArrowLeft,
  FaDownload,
  FaCertificate,
  FaUser,
  FaBookOpen,
  FaCalendarAlt,
  FaCheckCircle,
  FaPercentage,
} from "react-icons/fa";
import "../styles/certificatepage.css";

function CertificatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = useBasePath();
  const certificateRef = useRef(null);

  const [result, setResult] = useState(null);
  const [userData, setUserData] = useState(null);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchCertificateData();
  }, [id]);

  const fetchCertificateData = async () => {
    try {
      const attemptUserId = id.split("_")[0];

      let attemptSnap = await get(ref(database, `attempts/${attemptUserId}/${id}`));
      let attemptData = attemptSnap.exists() ? attemptSnap.val() : null;
      let attemptUserIdFound = attemptUserId;

      if (!attemptData) {
        const resultsSnap = await get(ref(database, `results/${attemptUserId}`));
        if (resultsSnap.exists()) {
          const allResults = resultsSnap.val();
          const match = Object.entries(allResults).find(
            ([key]) => key === id || key.includes(id)
          );
          if (match) {
            attemptData = match[1];
          }
        }
      }

      if (!attemptData) {
        const quizSnap = await get(ref(database, `quizAttempts/${attemptUserId}`));
        if (quizSnap.exists()) {
          const allCourses = quizSnap.val();
          for (const courseId of Object.keys(allCourses)) {
            const courseAttempts = allCourses[courseId];
            const match = Object.entries(courseAttempts).find(
              ([key]) => key === id || key.includes(id)
            );
            if (match) {
              attemptData = match[1];
              break;
            }
          }
        }
      }

      if (!attemptData) {
        setLoading(false);
        return;
      }

      setResult(attemptData);
      if (attemptData.userId) attemptUserIdFound = attemptData.userId;

      const [userSnap, courseSnap] = await Promise.all([
        attemptData.userId
          ? get(ref(database, `users/${attemptData.userId}`))
          : Promise.resolve(null),
        attemptData.courseId
          ? get(ref(database, `courses/${attemptData.courseId}`))
          : Promise.resolve(null),
      ]);

      if (userSnap?.exists()) setUserData(userSnap.val());
      if (courseSnap?.exists()) setCourse({ id: attemptData.courseId, ...courseSnap.val() });
    } catch (err) {
      console.error("Certificate fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const studentName =
    userData?.name || userData?.fullName || result?.userName || "Student Name";

  const courseName =
    course?.title || course?.courseTitle || result?.courseTitle || "Training Course";

  const score = result?.score ?? result?.percentage ?? 0;
  const total = result?.total ?? result?.totalMarks ?? 0;
  const correct = result?.correct ?? 0;

  const downloadCertificate = async () => {
    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "px", [1600, 1100]);
      pdf.addImage(imgData, "PNG", 0, 0, 1600, 1100);
      pdf.save(`${studentName}-${courseName}-certificate.pdf`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download certificate. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="cert-page-container">
        <div className="cert-loading-state">
          <div className="cert-loading-spinner"></div>
          <p>Loading Certificate...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="cert-page-container">
        <div className="cert-empty-state">
          <FaCertificate className="cert-empty-icon" />
          <h2>Certificate Not Found</h2>
          <p>This certificate doesn't exist or has been removed.</p>
          <button onClick={() => navigate(`${basePath}/certificates`)} className="btn-cert-primary">
            View My Certificates
          </button>
        </div>
      </div>
    );
  }

  const date = new Date(result.submittedAt || result.attemptedAt || result.completedAt || Date.now()).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const certificateId = `CERT-${id.slice(-10).toUpperCase()}`;

  return (
    <div className="cert-page-container">
      <div className="cert-header-bar">
        <button className="cert-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>
        <h1 className="cert-page-title">Your Certificate</h1>
      </div>

      <div className="cert-info-strip">
        <div className="cert-info-item">
          <div className="cert-info-icon green"><FaUser /></div>
          <div>
            <span>Student</span>
            <strong>{studentName}</strong>
          </div>
        </div>
        <div className="cert-info-item">
          <div className="cert-info-icon blue"><FaBookOpen /></div>
          <div>
            <span>Course</span>
            <strong>{courseName}</strong>
          </div>
        </div>
        <div className="cert-info-item">
          <div className="cert-info-icon purple"><FaPercentage /></div>
          <div>
            <span>Score</span>
            <strong>{score}%{total > 0 ? ` (${correct}/${total})` : ""}</strong>
          </div>
        </div>
        <div className="cert-info-item">
          <div className="cert-info-icon amber"><FaCalendarAlt /></div>
          <div>
            <span>Date</span>
            <strong>{date}</strong>
          </div>
        </div>
        <div className="cert-info-item">
          <div className="cert-info-icon teal"><FaCertificate /></div>
          <div>
            <span>Certificate ID</span>
            <strong>{certificateId}</strong>
          </div>
        </div>
      </div>

      <div className="cert-canvas-preview-frame">
        <div
          ref={certificateRef}
          className="cert-canvas-element"
          style={{
            width: "1600px",
            height: "1100px",
            position: "relative",
            backgroundImage: "url('/certificate/certificate.png')",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            margin: "25px auto 0",
            transform: "scale(0.45)",
            transformOrigin: "top center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "450px",
              left: "0",
              width: "100%",
              textAlign: "center",
              fontSize: "72px",
              fontFamily: "'Times New Roman', serif",
              fontWeight: "600",
              color: "#101828",
              textTransform: "capitalize",
              lineHeight: "1",
            }}
          >
            {studentName}
          </div>

          <div
            style={{
              position: "absolute",
              top: "605px",
              left: "0",
              width: "100%",
              textAlign: "center",
              fontSize: "40px",
              fontFamily: "'Times New Roman', serif",
              fontWeight: "600",
              color: "#101828",
              lineHeight: "1.2",
            }}
          >
            {courseName}
          </div>

          <div
            style={{
              position: "absolute",
              top: "800px",
              left: "770px",
              fontSize: "28px",
               fontWeight: "600",
              fontFamily: "Arial, sans-serif",
              color: "#101828",
              lineHeight: "1",
            }}
          >
            {date}
          </div>

          {/* <div
            style={{
              position: "absolute",
              top: "825px",
              left: "1090px",
              fontSize: "22px",
              fontFamily: "Arial, sans-serif",
              color: "#101828",
              lineHeight: "1",
            }}
          >
            {certificateId}
          </div> */}
        </div>
      </div>

      <div className="cert-trigger-footer">
        <div className="cert-footer-left">
          <FaCheckCircle className="cert-passed-icon" />
          <div>
            <strong>Course Passed</strong>
            <span>{score}% Score</span>
          </div>
        </div>
        <button
          onClick={downloadCertificate}
          className="btn-cert-primary"
          disabled={downloading}
        >
          <FaDownload /> {downloading ? "Generating..." : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

export default CertificatePage;
