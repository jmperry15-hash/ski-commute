// The icon iPhone shows when you tap Share → Add to Home Screen (180×180 is Apple's size).
import { renderAppIcon } from "@/lib/appIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width);
}
