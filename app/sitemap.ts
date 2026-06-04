import type { MetadataRoute } from "next";
import { getServerBaseUrl } from "@/lib/server-url";

const PUBLIC_ROUTES = [
  {
    path: "/",
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    path: "/bets-to-make-with-friends-app",
    changeFrequency: "weekly" as const,
    priority: 0.9,
  },
  {
    path: "/rules",
    changeFrequency: "monthly" as const,
    priority: 0.4,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getServerBaseUrl();
  if (!baseUrl) return [];

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route.path, baseUrl).toString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
