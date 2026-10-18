/**
 * Client-side heavy image compressor using HTML5 Canvas.
 * Resizes max width/height to 1024px and compresses JPEG quality to 0.6 as requested.
 * Yields ultra-compact payloads (~40KB - 90KB) for near-instant upload and OCR processing.
 */
export async function compressImageFile(file: File): Promise<{ base64Data: string; mimeType: string }> {
  // If not a raster image (e.g. PDF or SVG), read directly via FileReader
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64Data: reader.result as string, mimeType: 'application/pdf' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64Data: reader.result as string, mimeType: 'image/svg+xml' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Strict 1024px max dimension constraint
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64Data: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
          return;
        }

        // White background for JPEG conversion
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Quality strictly set to 0.6 for maximum speed & lightweight payload
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve({ base64Data: compressedBase64, mimeType: 'image/jpeg' });
      };

      img.onerror = () => {
        resolve({ base64Data: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
