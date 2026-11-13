export const COVER_PRESETS = [
  { id: "sky", name: "晴空藍", color: "#dbeefa" },
  { id: "ice", name: "冰川藍", color: "#e6f3f7" },
  { id: "cornflower", name: "矢車菊藍", color: "#dce5fa" },
  { id: "sea", name: "海灣藍", color: "#cfe5ed" },
] as const;

// Covers are local raster data only: no remote requests, SVG or executable URLs.
export function validCourseCover(value: unknown): value is string {
  return typeof value === "string" && (COVER_PRESETS.some(p => value === `preset:${p.id}`) ||
    (value.length <= 800_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)));
}
export function normalizeCourseCovers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, cover]) => key.length <= 500 && validCourseCover(cover)).slice(0, 200));
}
export function courseCoverColor(cover?: string) {
  return COVER_PRESETS.find(p => cover === `preset:${p.id}`)?.color ?? COVER_PRESETS[0].color;
}
export async function prepareCourseCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) throw Error("請選擇 12 MB 以內的圖片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.width || !image.height) throw Error("無法讀取這張圖片。");
    const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 760;
    const context = canvas.getContext("2d"); if (!context) throw Error("無法處理圖片。");
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    context.fillStyle = "#e5f1fa"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
    const data = canvas.toDataURL("image/jpeg", .8);
    if (!validCourseCover(data)) throw Error("圖片處理後仍太大，請改用較簡單的圖片。");
    return data;
  } catch (error) {
    throw error instanceof Error ? error : Error("無法讀取圖片，請改選 JPEG 或 PNG。");
  } finally { URL.revokeObjectURL(url); }
}
