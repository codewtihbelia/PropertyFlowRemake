import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase/config";

export async function uploadToFirebaseStorageMobile(
  imageUri: string,
  folder = "propertyflow/mobile_receipts",
): Promise<string> {
  try {
    const filename = imageUri.split("/").pop() || `receipt_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const storagePath = `${folder}/${Date.now()}_${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: type,
      customMetadata: {
        uploadedFrom: "mobile",
        originalFilename: filename,
      },
    });
    return getDownloadURL(storageRef);
  } catch (err) {
    console.warn("[FirebaseStorageMobile] Error uploading image:", err);
    throw err;
  }
}
