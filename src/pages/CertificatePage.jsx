import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import useBasePath from "../hooks/useBasePath";
import jsPDF from "jspdf";
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
      const bgImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load certificate background image"));
        img.src = "/certificate/certificate.png";
      });

      const W = 3200;
      const H = 2200;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(bgImage, 0, 0, W, H);

      ctx.fillStyle = "#101828";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.font = "600 128px 'Times New Roman', serif";
      const nameY = (460 / 1100) * H;
      const capitalizedName = studentName.replace(/\b\w/g, (c) => c.toUpperCase());
      ctx.fillText(capitalizedName, W / 2, nameY, W - 200);

      ctx.font = "600 76px 'Times New Roman', serif";
      const courseY = (610 / 1100) * H;
      ctx.fillText(courseName, W / 2, courseY, W - 240);

      ctx.textAlign = "left";
      ctx.font = "600 52px Arial, sans-serif";
      const dateX = (790 / 1600) * W;
      const dateY = (800 / 1100) * H;
      ctx.fillText(date, dateX, dateY);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "px", [1600, 1100], true);
      pdf.addImage(imgData, "PNG", 0, 0, 1600, 1100);

      const safeName = (studentName || "Student").replace(/[\/\\:*?"<>|]/g, "_");
      const safeCourse = (courseName || "Course").replace(/[\/\\:*?"<>|]/g, "_");
      pdf.save(`${safeName}-${safeCourse}-certificate.pdf`);
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

      <div className="cert-canvas-preview-frame" style={{ position: "relative" }}>
        {downloading && (
          <div className="cert-downloading-overlay">
            <div className="cert-loading-spinner"></div>
            <p>Generating your certificate...</p>
          </div>
        )}
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
              top: "460px",
              left: "0",
              width: "100%",
              textAlign: "center",
              fontSize: "64px",
              fontFamily: "'Times New Roman', serif",
              fontWeight: "600",
              color: "#101828",
              textTransform: "capitalize",
              lineHeight: "1",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              padding: "0 100px",
            }}
          >
            {studentName}
          </div>

          <div
            style={{
              position: "absolute",
              top: "610px",
              left: "0",
              width: "100%",
              textAlign: "center",
              fontSize: "38px",
              fontFamily: "'Times New Roman', serif",
              fontWeight: "600",
              color: "#101828",
              lineHeight: "1.2",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              padding: "0 120px",
            }}
          >
            {courseName}
          </div>

          <div
            style={{
              position: "absolute",
              top: "800px",
              left: "790px",
              fontSize: "26px",
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
