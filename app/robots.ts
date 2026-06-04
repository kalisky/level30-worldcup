import type { MetadataRoute } from "next";
import { getServerBaseUrl } from "@/lib/server-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getServerBaseUrl();
  const sitemap = baseUrl ? new URL("/sitemap.xml", baseUrl).toString() : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/r/", "/room/", "/welcome"],
    },
    ...(sitemap ? { sitemap } : {}),
  };
}
