import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';

export interface FirebaseUploadResult {
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
}

export async function uploadToFirebaseStorage(
  file: File | Blob | string,
  folder = "propertyflow/receipts",
): Promise<string> {
  try {
    const blob = typeof file === "string" ? await (await fetch(file)).blob() : file;
    const name = file instanceof File ? file.name : `upload_${Date.now()}`;
    const storageRef = ref(storage, `${folder}/${Date.now()}_${name}`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  } catch (error) {
    console.warn("[FirebaseStorage] Upload error:", error);
    throw error;
  }
}
