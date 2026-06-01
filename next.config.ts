import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!firebaseAuthDomain) return [];

    return {
      beforeFiles: [
        {
          source: "/__/auth/:path*",
          destination: `https://${firebaseAuthDomain}/__/auth/:path*`,
        },
        {
          source: "/__/firebase/:path*",
          destination: `https://${firebaseAuthDomain}/__/firebase/:path*`,
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
