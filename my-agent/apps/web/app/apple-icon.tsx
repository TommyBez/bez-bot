import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <svg fill="none" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#000" height="64" width="64" />
      <rect height="46" rx="14" stroke="#fff" strokeWidth="3.5" width="46" x="9" y="9" />
      <circle cx="24.5" cy="28" fill="#fff" r="4.2" />
      <circle cx="39.5" cy="28" fill="#fff" r="4.2" />
      <path d="M23 38.5c2.6 2.6 5.6 3.9 9 3.9s6.4-1.3 9-3.9" stroke="#fff" strokeLinecap="round" strokeWidth="3.5" />
    </svg>,
    size,
  );
}
