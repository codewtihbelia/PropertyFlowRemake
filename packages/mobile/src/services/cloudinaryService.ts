import { Platform } from "react-native";

/**
 * Cloudinary Upload Service for Mobile & Web (Expo / React Native)
 * Resolves "Unsupported FormDataPart implementation" in Expo winter fetch
 * by utilizing FileSystem.uploadAsync on native devices and standard Blob on Web.
 */
export interface CloudinaryMobileUploadOptions {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

/**
 * Upload an arbitrary file using native XMLHttpRequest in React Native,
 * which talks directly to RCTNetworking without going through Expo's
 * JavaScript convertFormDataAsync polyfill.
 */
function uploadViaNativeXHR(
  endpoint: string,
  uploadPreset: string,
  filePayload: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (e: any) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      } else {
        reject(
          new Error(
            `Cloudinary upload failed with status ${xhr.status}: ${xhr.responseText}`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new Error("Network error during Cloudinary upload"));
    xhr.ontimeout = () => reject(new Error("Timeout during Cloudinary upload"));

    const formData = new FormData();
    formData.append("upload_preset", uploadPreset);
    formData.append("file", filePayload);
    xhr.send(formData);
  });
}

export async function uploadImageToCloudinaryMobile(
  options: CloudinaryMobileUploadOptions | string,
): Promise<string> {
  const opt: CloudinaryMobileUploadOptions =
    typeof options === "string" ? { uri: options } : options;

  if (opt.uri.startsWith("http://") || opt.uri.startsWith("https://")) {
    return opt.uri;
  }

  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "ri4xxxwk";
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "splitzy";

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary cloud name or upload preset is not configured.",
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const filename = opt.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = opt.mimeType || (ext === "png" ? "image/png" : "image/jpeg");

  // 1. Direct Base64 upload if provided
  if (opt.base64) {
    const cleanBase64 = opt.base64.includes(",")
      ? opt.base64
      : `data:${mimeType};base64,${opt.base64}`;
    const res = await uploadViaNativeXHR(endpoint, uploadPreset, cleanBase64);
    if (res.secure_url) return res.secure_url;
  }

  // 2. Web browser: fetch blob and use standard FormData
  if (Platform.OS === "web") {
    const res = await fetch(opt.uri);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("upload_preset", uploadPreset);
    formData.append("file", blob, filename);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Cloudinary upload failed: ${response.statusText} - ${errText}`,
      );
    }
    const data = await response.json();
    if (data.secure_url) return data.secure_url;
    throw new Error("Cloudinary did not return a secure_url.");
  }

  // 3. React Native Mobile: Use FileSystem.uploadAsync (streaming from native disk)
  try {
    const FileSystem = require("expo-file-system");
    if (
      FileSystem &&
      FileSystem.uploadAsync &&
      FileSystem.FileSystemUploadType
    ) {
      const uploadResult = await FileSystem.uploadAsync(endpoint, opt.uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        parameters: {
          upload_preset: uploadPreset,
        },
      });
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const parsed = JSON.parse(uploadResult.body);
        if (parsed.secure_url) {
          return parsed.secure_url;
        }
      }
    }
  } catch (fsErr) {
    console.warn(
      "[Cloudinary] FileSystem.uploadAsync failed, attempting XHR fallback:",
      fsErr,
    );
  }

  // 4. Native XHR fallback with React Native's native FormData file object
  const xhrResult = await uploadViaNativeXHR(endpoint, uploadPreset, {
    uri: opt.uri,
    name: filename,
    type: mimeType,
  });
  if (xhrResult.secure_url) {
    return xhrResult.secure_url;
  }

  throw new Error("Could not upload image to Cloudinary.");
}

export async function uploadVideoToCloudinaryMobile(
  options: CloudinaryMobileUploadOptions | string,
): Promise<string> {
  const opt: CloudinaryMobileUploadOptions =
    typeof options === "string" ? { uri: options } : options;

  if (opt.uri.startsWith("http://") || opt.uri.startsWith("https://")) {
    return opt.uri;
  }

  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "ri4xxxwk";
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "splitzy";

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary cloud name or upload preset is not configured.",
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const filename = opt.uri.split("/").pop() || `reel_${Date.now()}.mp4`;
  const ext = filename.split(".").pop()?.toLowerCase() || "mp4";
  const mimeType =
    opt.mimeType || (ext === "mov" ? "video/quicktime" : "video/mp4");

  // 1. Direct Base64 upload if provided
  if (opt.base64) {
    const cleanBase64 = opt.base64.includes(",")
      ? opt.base64
      : `data:${mimeType};base64,${opt.base64}`;
    const res = await uploadViaNativeXHR(endpoint, uploadPreset, cleanBase64);
    if (res.secure_url) return res.secure_url;
  }

  // 2. Web browser: fetch blob and use standard FormData
  if (Platform.OS === "web") {
    const res = await fetch(opt.uri);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("upload_preset", uploadPreset);
    formData.append("file", blob, filename);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Cloudinary video upload failed: ${response.statusText} - ${errText}`,
      );
    }
    const data = await response.json();
    if (data.secure_url) return data.secure_url;
    throw new Error("Cloudinary did not return a secure_url for video.");
  }

  // 3. React Native Mobile: Use FileSystem.uploadAsync (streaming from native disk)
  try {
    const FileSystem = require("expo-file-system");
    if (
      FileSystem &&
      FileSystem.uploadAsync &&
      FileSystem.FileSystemUploadType
    ) {
      const uploadResult = await FileSystem.uploadAsync(endpoint, opt.uri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        parameters: {
          upload_preset: uploadPreset,
        },
      });
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const parsed = JSON.parse(uploadResult.body);
        if (parsed.secure_url) {
          return parsed.secure_url;
        }
      }
    }
  } catch (fsErr) {
    console.warn(
      "[Cloudinary] FileSystem.uploadAsync failed, attempting XHR fallback:",
      fsErr,
    );
  }

  // 4. Native XHR fallback with React Native's native FormData file object
  // Native XMLHttpRequest talks to RCTNetworking (okhttp), avoiding Expo JS fetch convertFormDataAsync
  const xhrResult = await uploadViaNativeXHR(endpoint, uploadPreset, {
    uri: opt.uri,
    name: filename,
    type: mimeType,
  });
  if (xhrResult.secure_url) {
    return xhrResult.secure_url;
  }

  throw new Error("Could not upload video to Cloudinary.");
}

export const uploadImageToCloudinary = uploadImageToCloudinaryMobile;
export const uploadVideoToCloudinary = uploadVideoToCloudinaryMobile;
export default uploadImageToCloudinaryMobile;
