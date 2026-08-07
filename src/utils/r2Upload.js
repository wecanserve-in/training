import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const createSafeSlug = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function uploadFileToR2(file, baseFolder, departmentName) {
  if (!file) throw new Error("No file selected.");

  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;
  const publicDomain = import.meta.env.VITE_R2_PUBLIC_URL;

  const safeDepartment = createSafeSlug(departmentName) || "general";

  const extension = file.name.split(".").pop();

  const uniqueName =
    `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

  const fileKey = `${baseFolder}/${safeDepartment}/${uniqueName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: file,
      ContentType: file.type,
    })
  );

  return {
    secure_url: `${publicDomain}/${fileKey}`,
    public_id: fileKey,
  };
}