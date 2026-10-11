"use client"

import { usePathname } from "next/navigation"
import { CatalogProvider, useCatalog } from "@/components/catalog-context"
import { CartProvider } from "@/components/cart-context"
import { SiteSidebar } from "@/components/site-sidebar"

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { activeCategory, setActiveCategory, isSidebarOpen, setSidebarOpen } = useCatalog()

  if (pathname?.startsWith("/admin")) {
    return <>{children}</>
  }

  return (
    <div
      className={`min-h-screen bg-background transition-[padding] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
        isSidebarOpen ? "md:pl-[312px]" : "md:pl-[104px]"
      }`}
    >
      <SiteSidebar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        isOpen={isSidebarOpen}
        onOpenChange={setSidebarOpen}
      />
      {children}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CatalogProvider>
      <CartProvider>
        <ShellInner>{children}</ShellInner>
      </CartProvider>
    </CatalogProvider>
  )
}