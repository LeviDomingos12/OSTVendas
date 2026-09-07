export const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error loading logo for PDF:", err);
    return "";
  }
};

export const getFormatFromBase64 = (base64: string): string => {
  if (!base64) return "JPEG";
  if (base64.startsWith("data:image/png")) return "PNG";
  if (base64.startsWith("data:image/webp")) return "WEBP";
  if (base64.startsWith("data:image/gif")) return "GIF";
  if (base64.startsWith("data:image/svg")) return "SVG";
  return "JPEG";
};
