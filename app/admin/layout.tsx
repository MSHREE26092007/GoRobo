import type { Metadata } from "next"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: "Admin — Go RoBo Orders",
  description: "Internal order management dashboard",
  robots: "noindex,nofollow",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Render children without the main site AppShell / sidebar
  return children
}
