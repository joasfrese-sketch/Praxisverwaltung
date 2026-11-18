import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Praxisverwaltung",
    short_name: "Praxis",
    description: "Terminplanung, Störungsmanagement und Patientenakte",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f5",
    theme_color: "#34495f",
    lang: "de",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
