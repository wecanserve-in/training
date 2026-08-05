const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads an image file to Cloudinary and returns the secure URL.
 *
 * @param {File} file - The image file to upload
 * @param {string} folder - Cloudinary folder path (e.g. "profile-photos")
 * @param {object} options - Optional overrides
 * @param {number} options.maxWidth - Max width in pixels (default 400)
 * @param {number} options.maxHeight - Max height in pixels (default 400)
 * @returns {Promise<string>} The secure_url of the uploaded image
 */
export const uploadImageToCloudinary = async (
  file,
  folder = "profile-photos",
  { maxWidth = 400, maxHeight = 400 } = {}
) => {
  if (!file) throw new Error("No file provided");

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary environment variables are missing.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);
  formData.append("resource_type", "image");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Image upload failed");
  }

  return data.secure_url;
};

/**
 * Reads a File and returns a temporary object URL for preview.
 */
export const getObjectURL = (file) => {
  if (!file) return "";
  return URL.createObjectURL(file);
};
