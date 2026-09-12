import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // localhost and 127.0.0.1 are different origins. Real Firebase SMS OTP
  // must be tested on 127.0.0.1; allow that host to use the Turbopack HMR socket.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: rootDir,
  },
  serverExternalPackages: [
    "firebase-admin",
    "jose",
    "jwks-rsa",
    "pdfkit",
    "qrcode",
    "form-data",
    "googleapis",
    "sharp",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
