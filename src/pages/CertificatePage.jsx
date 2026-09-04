import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database, auth } from "../firebase";
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
      const rawUserId = id.includes("_") ? id.split("_")[0] : "";
      const isLikelyUid = rawUserId && !["final", "practice", "cert", "result"].includes(rawUserId.toLowerCase()) && rawUserId.length > 5;
      const candidateUserIds = [
        isLikelyUid ? rawUserId : null,
        auth.currentUser?.uid,
      ].filter(Boolean);

      let attemptData = null;

      // 1. Try candidate user IDs
      for (const candidateUid of candidateUserIds) {
        if (!attemptData) {
          const attemptSnap = await get(ref(database, `attempts/${candidateUid}/${id}`));
          if (attemptSnap.exists()) {
            attemptData = { userId: candidateUid, ...attemptSnap.val() };
            break;
          }
        }

        if (!attemptData) {
          const quizSnap = await get(ref(database, `quizAttempts/${candidateUid}`));
          if (quizSnap.exists()) {
            const allCourses = quizSnap.val();
            for (const cId of Object.keys(allCourses)) {
              const courseAttempts = allCourses[cId];
              if (courseAttempts && typeof courseAttempts === "object") {
                const match = Object.entries(courseAttempts).find(
                  ([key, val]) => key === id || val?.quizId === id || val?.legacyAttemptId === id || key.includes(id)
                );
                if (match) {
                  attemptData = { userId: candidateUid, courseId: cId, ...match[1] };
                  break;
                }
              }
            }
          }
        }

        if (!attemptData) {
          const compSnap = await get(ref(database, `completedCourses/${candidateUid}`));
          if (compSnap.exists()) {
            const compCourses = compSnap.val();
            const match = Object.entries(compCourses).find(
              ([cId, val]) => val?.attemptId === id || val?.quizId === id || val?.legacyAttemptId === id || cId === id
            );
            if (match) {
              attemptData = { userId: candidateUid, courseId: match[0], ...match[1] };
              break;
            }
          }
        }

        if (!attemptData) {
          const resultsSnap = await get(ref(database, `results/${candidateUid}`));
          if (resultsSnap.exists()) {
            const allResults = resultsSnap.val();
            const match = Object.entries(allResults).find(
              ([key]) => key === id || key.includes(id)
            );
            if (match) {
              attemptData = { userId: candidateUid, ...match[1] };
              break;
            }
          }
        }
      }

      // 2. Global search across completedCourses / quizAttempts if viewing as admin/super-admin
      if (!attemptData) {
        const [allCompletedSnap, allQuizSnap] = await Promise.all([
          get(ref(database, "completedCourses")),
          get(ref(database, "quizAttempts")),
        ]);

        if (allCompletedSnap.exists()) {
          const allCompleted = allCompletedSnap.val();
          for (const [uId, courses] of Object.entries(allCompleted)) {
            if (courses && typeof courses === "object") {
              const match = Object.entries(courses).find(
                ([cId, val]) => val?.attemptId === id || val?.quizId === id || val?.legacyAttemptId === id || cId === id
              );
              if (match) {
                attemptData = { userId: uId, courseId: match[0], ...match[1] };
                break;
              }
            }
          }
        }

        if (!attemptData && allQuizSnap.exists()) {
          const allQuizzes = allQuizSnap.val();
          for (const [uId, courses] of Object.entries(allQuizzes)) {
            if (courses && typeof courses === "object") {
              for (const [cId, attempts] of Object.entries(courses)) {
                if (attempts && typeof attempts === "object") {
                  const match = Object.entries(attempts).find(
                    ([key, val]) => key === id || val?.quizId === id || val?.legacyAttemptId === id
                  );
                  if (match) {
                    attemptData = { userId: uId, courseId: cId, ...match[1] };
                    break;
                  }
                }
              }
            }
            if (attemptData) break;
          }
        }
      }

      if (!attemptData) {
        setLoading(false);
        return;
      }

      setResult(attemptData);

      const targetUid = attemptData.userId || (candidateUserIds.length > 0 ? candidateUserIds[0] : null);
      const targetCourseId = attemptData.courseId;

      const [userSnap, courseSnap] = await Promise.all([
        targetUid ? get(ref(database, `users/${targetUid}`)) : Promise.resolve(null),
        targetCourseId ? get(ref(database, `courses/${targetCourseId}`)) : Promise.resolve(null),
      ]);

      if (userSnap?.exists()) setUserData(userSnap.val());
      if (courseSnap?.exists()) setCourse({ id: targetCourseId, ...courseSnap.val() });
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

        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(
            new Error("Failed to load certificate background image")
          );

        img.src = "/certificate/certificate.png";
      });

      /*
       * IMPORTANT:
       * The visible certificate preview is designed at EXACTLY:
       *
       *   1600 x 1100
       *
       * All text below uses the SAME coordinates, font sizes and
       * positions as the preview JSX.
       *
       * Do NOT use a 3200x2200 canvas here because that makes it
       * very easy for text measurements/positions to differ from
       * the browser preview.
       */

      const W = 1600;
      const H = 1100;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not create certificate canvas");
      }

      // Same background as the preview.
      ctx.drawImage(bgImage, 0, 0, W, H);

      ctx.fillStyle = "#101828";
      ctx.textBaseline = "top";

      // =====================================================
      // STUDENT NAME
      // Preview:
      // top: 460px
      // left: 0
      // width: 100%
      // font-size: 64px
      // text-align: center
      // =====================================================

      ctx.textAlign = "center";
      ctx.font = "600 64px 'Times New Roman', serif";

      const capitalizedName = studentName.replace(
        /\b\w/g,
        (c) => c.toUpperCase()
      );

      ctx.fillText(
        capitalizedName,
        W / 2,
        460,
        W - 200
      );

      // =====================================================
      // COURSE NAME
      // Preview:
      // top: 610px
      // left: 0
      // width: 100%
      // font-size: 38px
      // text-align: center
      // =====================================================

      ctx.font = "600 38px 'Times New Roman', serif";

      ctx.fillText(
        courseName,
        W / 2,
        610,
        W - 240
      );

      // =====================================================
      // DATE
      // Preview:
      // top: 800px
      // left: 740px
      // font-size: 26px
      // font-family: Arial
      // =====================================================

      ctx.textAlign = "left";
      ctx.font = "600 26px Arial, sans-serif";

      ctx.fillText(
        date,
        740,
        800
      );

      // Convert the exact 1600x1100 certificate to PNG.
      const imgData = canvas.toDataURL("image/png");

      // PDF is ALSO exactly 1600x1100.
      // Therefore there is no additional scaling/repositioning.
      const pdf = new jsPDF(
        "landscape",
        "px",
        [1600, 1100],
        true
      );

      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        1600,
        1100
      );

      const safeName = (studentName || "Student").replace(
        /[\/\\:*?"<>|]/g,
        "_"
      );

      const safeCourse = (courseName || "Course").replace(
        /[\/\\:*?"<>|]/g,
        "_"
      );

      pdf.save(
        `${safeName}-${safeCourse}-certificate.pdf`
      );
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
              left: "740px",
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
