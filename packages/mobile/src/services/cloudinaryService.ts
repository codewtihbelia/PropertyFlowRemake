/**
 * Cloudinary Upload Service for Mobile (Expo / React Native)
 */
export interface CloudinaryMobileUploadOptions {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

async function resolveFilePayload(
  opt: CloudinaryMobileUploadOptions,
): Promise<any> {
  if (opt.base64) {
    const mime = opt.mimeType || "image/jpeg";
    return `data:${mime};base64,${opt.base64}`;
  }

  if (
    opt.uri.startsWith("data:") ||
    opt.uri.startsWith("http://") ||
    opt.uri.startsWith("https://")
  ) {
    return opt.uri;
  }

  // If on Web with a blob URL, return the blob directly so FormData streams it natively
  if (typeof window !== "undefined" && opt.uri.startsWith("blob:")) {
    try {
      const res = await fetch(opt.uri);
      const blob = await res.blob();
      return blob;
    } catch (e) {
      console.warn("[Cloudinary Mobile] Could not fetch blob directly:", e);
    }
  }

  // Attempt to read URI into a base64 Data URL for smaller images
  const isVideo =
    opt.mimeType?.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(opt.uri);
  if (!isVideo) {
    try {
      const res = await fetch(opt.uri);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("FileReader returned non-string result"));
          }
        };
        reader.onerror = () =>
          reject(new Error("FileReader failed to read blob"));
        reader.readAsDataURL(blob);
      });
    } catch {
      // Fallback to React Native part below
    }
  }

  const filename =
    opt.uri.split("/").pop() || (isVideo ? "video.mp4" : "photo.jpg");
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : isVideo ? "mp4" : "jpg";
  const type =
    opt.mimeType ||
    (ext === "mp4"
      ? "video/mp4"
      : ext === "mov"
        ? "video/quicktime"
        : ext === "png"
          ? "image/png"
          : "image/jpeg");

  return {
    uri: opt.uri,
    name: filename,
    type,
  };
}

export async function uploadImageToCloudinaryMobile(
  options: CloudinaryMobileUploadOptions | string,
): Promise<string> {
  const opt: CloudinaryMobileUploadOptions =
    typeof options === "string" ? { uri: options } : options;

  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "ri4xxxwk";
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "splitzy";

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary cloud name or upload preset is not configured.",
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const filePayload = await resolveFilePayload(opt);

  // If payload is a data URI or remote URL string, we can upload directly
  const formData = new FormData();
  formData.append("upload_preset", uploadPreset);
  formData.append("file", filePayload as any);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cloudinary Mobile] Upload error:", errorText);
    throw new Error(`Failed to upload to Cloudinary: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary did not return a secure_url.");
  }

  return data.secure_url;
}

export async function uploadVideoToCloudinaryMobile(
  options: CloudinaryMobileUploadOptions | string,
): Promise<string> {
  const opt: CloudinaryMobileUploadOptions =
    typeof options === "string" ? { uri: options } : options;

  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "ri4xxxwk";
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "splitzy";

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary cloud name or upload preset is not configured.",
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const filePayload = await resolveFilePayload({
    ...opt,
    mimeType: opt.mimeType || "video/mp4",
  });

  const formData = new FormData();
  formData.append("upload_preset", uploadPreset);
  if (typeof Blob !== "undefined" && filePayload instanceof Blob) {
    formData.append("file", filePayload, "reel_video.mp4");
  } else {
    formData.append("file", filePayload as any);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cloudinary Video Mobile] Upload error:", errorText);
    throw new Error(
      `Failed to upload video to Cloudinary: ${response.statusText}`,
    );
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary did not return a secure_url for video.");
  }

  return data.secure_url;
}

export const uploadImageToCloudinary = uploadImageToCloudinaryMobile;
export const uploadVideoToCloudinary = uploadVideoToCloudinaryMobile;
export default uploadImageToCloudinaryMobile;
