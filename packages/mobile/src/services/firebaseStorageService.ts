import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadString,
} from "firebase/storage";
import { storage } from "../firebase/config";

/**
 * Uploads an image to Firebase Storage for mobile.
 *
 * To avoid React Native's Blob overhead ("WARN Response.blob() is using React Native's Blob...")
 * and Firebase Web SDK "storage/unknown" errors in React Native/Expo, callers should pass
 * base64Data obtained via `ImagePicker.launchImageLibraryAsync({ base64: true })`.
 *
 * If Firebase Storage is temporarily unavailable or rules deny upload, this gracefully
 * falls back to an inline base64 data-URL so user operations (QR codes, receipts, custom bank icons)
 * never fail or lose data.
 */
export async function uploadToFirebaseStorageMobile(
  imageUri: string,
  folder = "propertyflow/mobile_receipts",
  base64Data?: string,
): Promise<string> {
  const filename = imageUri.split("/").pop() || `img_${Date.now()}.jpg`;
  const match = /\.(\w+)(\?.*)?$/.exec(filename);
  const ext = (match ? match[1] : "jpg").toLowerCase();
  const type =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const storagePath = `${folder}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // 1. If image is already an HTTP URL, no need to re-upload
  if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
    return imageUri;
  }

  // 2. If caller already provided base64
  if (base64Data) {
    const cleanBase64 = base64Data.includes(",")
      ? base64Data.split(",")[1]
      : base64Data;
    const fallbackDataUrl = `data:${type};base64,${cleanBase64}`;

    try {
      if (storage) {
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, cleanBase64, "base64", {
          contentType: type,
          customMetadata: {
            uploadedFrom: "mobile",
            originalFilename: filename,
          },
        });
        const downloadUrl = await getDownloadURL(storageRef);
        if (downloadUrl) return downloadUrl;
      }
    } catch (storageErr) {
      console.warn(
        "[FirebaseStorageMobile] Storage upload fell back to inline representation:",
        storageErr,
      );
    }
    return fallbackDataUrl;
  }

  // 3. If imageUri is already a data-URL
  if (imageUri.startsWith("data:")) {
    try {
      if (storage) {
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, imageUri, "data_url", {
          contentType: type,
          customMetadata: {
            uploadedFrom: "mobile",
            originalFilename: filename,
          },
        });
        const downloadUrl = await getDownloadURL(storageRef);
        if (downloadUrl) return downloadUrl;
      }
    } catch (storageErr) {
      console.warn(
        "[FirebaseStorageMobile] Storage data_url upload fell back to original data URL:",
        storageErr,
      );
    }
    return imageUri;
  }

  // 4. Fallback when neither base64 nor data-URL is passed:
  // Convert via fetch without unhandled crash, and return uri or cloud URL
  try {
    if (storage) {
      const storageRef = ref(storage, storagePath);
      const response = await fetch(imageUri);
      const blob = await response.blob();
      await uploadBytes(storageRef, blob, {
        contentType: type,
        customMetadata: {
          uploadedFrom: "mobile",
          originalFilename: filename,
        },
      });
      return await getDownloadURL(storageRef);
    }
  } catch (err) {
    console.warn(
      "[FirebaseStorageMobile] Could not upload raw blob to storage, using URI:",
      err,
    );
  }

  return imageUri;
}

/**
 * Uploads a video file (MP4/MOV) to Firebase Storage as a cloud-hosted video.
 * Returns a permanent HTTPS download URL.
 */
export async function uploadVideoToFirebaseStorageMobile(
  videoUri: string,
  folder = "community_reels",
): Promise<string> {
  if (videoUri.startsWith("http://") || videoUri.startsWith("https://")) {
    return videoUri;
  }
  const filename = videoUri.split("/").pop() || `reel_${Date.now()}.mp4`;
  const storagePath = `${folder}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  if (storage) {
    const storageRef = ref(storage, storagePath);
    const response = await fetch(videoUri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob, {
      contentType: "video/mp4",
      customMetadata: {
        uploadedFrom: "mobile_reels",
        originalFilename: filename,
      },
    });
    const downloadUrl = await getDownloadURL(storageRef);
    if (downloadUrl) return downloadUrl;
  }
  throw new Error("Firebase storage is not configured.");
}
