import { apiRequest } from "./apiClient";

/**
 * Uploads a file to Cloudflare R2.
 *
 * The server checks the user's role and hands back a short-lived signed URL,
 * so no storage keys are shipped to the browser.
 *
 * @param {File} file
 * @param {string} folder  One of the folders allowed in public/api/upload-url.php
 * @param {object} [options]
 * @param {string} [options.department]  Department name, used as a sub-folder
 * @param {(percent: number) => void} [options.onProgress]
 * @returns {Promise<{ url: string, key: string }>}
 */
export const uploadFile = async (file, folder, { department, onProgress } = {}) => {
  if (!file) {
    throw new Error("Please select a file before uploading.");
  }

  const { uploadUrl, publicUrl, key } = await apiRequest("upload-url.php", {
    method: "POST",
    body: { folder, fileName: file.name, department: department || "" },
  });

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", uploadUrl);

    if (file.type) {
      request.setRequestHeader("Content-Type", file.type);
    }

    request.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        // Keep 100% for when the upload is confirmed.
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${request.status}). Please try again.`));
      }
    };

    request.onerror = () =>
      reject(new Error("Upload failed. Check your internet connection and try again."));

    request.send(file);
  });

  if (onProgress) onProgress(100);

  return { url: publicUrl, key };
};
