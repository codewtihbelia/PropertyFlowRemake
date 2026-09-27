/**
 * Cloudinary Upload Service for Web
 */
export async function uploadImageToCloudinary(file: File | Blob): Promise<string> {
  const cloudName =
    (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || 'ri4xxxwk';
  const uploadPreset =
    (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET || 'splitzy';

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary cloud name or upload preset is missing.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Cloudinary Web] Upload error:', errorText);
    throw new Error(`Failed to upload to Cloudinary: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary response missing secure_url');
  }

  return data.secure_url;
}
