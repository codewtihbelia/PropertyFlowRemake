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
): Promise<string | { uri: string; name: string; type: string }> {
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

  // Attempt to read URI into a base64 Data URL to safely bypass FormData part incompatibilities
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
  } catch (err) {
    console.warn(
      "[Cloudinary Mobile] Could not convert URI to DataURL, falling back to React Native part:",
      err,
    );
    const filename = opt.uri.split("/").pop() || "photo.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";
    return {
      uri: opt.uri,
      name: filename,
      type,
    };
  }
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

export const uploadImageToCloudinary = uploadImageToCloudinaryMobile;
export default uploadImageToCloudinaryMobile;
