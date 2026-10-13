export async function compressImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choisissez une image JPEG, PNG ou WebP.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Choisissez une image de moins de 25 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Impossible de traiter cette image sur ce navigateur.");
    context.fillStyle = "#f1f5fa";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("La compression de l’image a échoué.")),
        "image/webp",
        0.82,
      ),
    );
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message.includes("Impossible")
        ? e.message
        : "Cette image n’a pas pu être lue. Essayez une autre image.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
