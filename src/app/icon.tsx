// App icons used by Android and the web manifest: served at /icon/192 and /icon/512.
import { renderAppIcon } from "@/lib/appIcon";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [192, 512].map((px) => ({ id: String(px), size: { width: px, height: px }, contentType }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  return renderAppIcon(Number(await id));
}
