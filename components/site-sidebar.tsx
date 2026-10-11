"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BatteryCharging,
  Bot,
  Cable,
  CircuitBoard,
  Cog,
  Cpu,
  Gamepad2,
  GitFork,
  Heart,
  History,
  Info,
  LayoutGrid,
  Lightbulb,
  Mail,
  MessageCircle,
  Microchip,
  Monitor,
  Package,
  Plane,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  ToggleLeft,
  Truck,
  Wifi,
  Zap,
} from "lucide-react"
import {
  IconBadge,
  Sidebar,
  SidebarContent,
  SidebarExpandButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarItem,
  SidebarThemeControl,
  Text,
  useSidebar,
  useTheme,
  View,
} from "@amazecontinuityprojects/amazeui"
import { categories, products } from "@/lib/products"
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  WHATSAPP_CHANNEL_URL,
  buildGeneralInquiryUrl,
} from "@/lib/contact"
import { GITHUB_REPO_URL } from "@/lib/site"
import { animateThemeCircularExpansion } from "@/components/theme-switcher"
import { GoRoboLogo } from "@/components/gorobo-logo"
import { useCart } from "@/components/cart-context"

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Arduino Boards": Cpu,
  "ESP Boards & Shields": Wifi,
  "Motors & Actuators": Cog,
  "Sensors & Modules": Activity,
  "Display Board & LED": Monitor,
  "Power Supply & Converters": BatteryCharging,
  "Quadcopter & Drones": Plane,
  "Robotic Kits": Bot,
  "Transistors & IC": CircuitBoard,
  "Motor Driver & Shield": ToggleLeft,
  "Combo Products": Package,
  "Resistor & Capacitors": Sparkles,
  "STM32": Microchip,
  "Relays": Zap,
  "Accesories & Cables": Cable,
  "Robotic Arms & Grippers": Gamepad2,
  "LED & Lighting": Lightbulb,
}

type SiteSidebarProps = {
  activeCategory: string | null
  onSelectCategory: (category: string | null) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

function SidebarLogo() {
  const { isOpen } = useSidebar()
  const router = useRouter()
  if (!isOpen) return null
  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      aria-label="Go RoBo — back to the catalog"
      className="flex cursor-pointer items-center px-1 py-1 rounded-xl text-left transition-opacity hover:opacity-80"
    >
      <GoRoboLogo className="h-6 w-auto" />
    </button>
  )
}

function SidebarGroupRow({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebar()
  return <SidebarGroup className={isOpen ? "" : "items-center"}>{children}</SidebarGroup>
}

function SidebarHeaderRow({ onExpand }: { onExpand: () => void }) {
  const { isOpen } = useSidebar()
  return (
    <div
      className={`flex items-center gap-2 ${
        isOpen ? "justify-between" : "justify-center"
      }`}
    >
      <SidebarLogo />
      <SidebarExpandButton onClick={onExpand} />
    </div>
  )
}

function SidebarFooterContent({
  theme,
  onThemeChange,
}: {
  theme: string
  onThemeChange: (next: string) => void
}) {
  const { isOpen } = useSidebar()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <>
      {mounted && <SidebarThemeControl theme={theme} onThemeChange={onThemeChange} />}
      {isOpen && (
        <View className="mt-3 flex flex-col gap-0.5 px-0.5">
          <Text className="text-[11px] text-sidebar-foreground/50">{CONTACT_PHONE}</Text>
          <Text className="truncate text-[11px] text-sidebar-foreground/50">{CONTACT_EMAIL}</Text>
        </View>
      )}
    </>
  )
}

export function SiteSidebar({
  activeCategory,
  onSelectCategory,
  isOpen,
  onOpenChange,
}: SiteSidebarProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { count: cartCount } = useCart()

  const countFor = (category: string) =>
    products.filter((p) => p.category === category).length

  const selectCategory = (category: string | null) => {
    onSelectCategory(category)
    if (pathname !== "/") router.push("/")
  }

  return (
    <Sidebar isOpen={isOpen} onOpenChange={onOpenChange} side="left">
      <SidebarHeader>
        <SidebarHeaderRow onExpand={() => onOpenChange(!isOpen)} />
      </SidebarHeader>

      <SidebarContent className="gorobo-sidebar-scroll">
        <SidebarGroupRow>
          <SidebarGroupLabel>Shop</SidebarGroupLabel>
          <SidebarItem
            icon={<LayoutGrid className="size-5" aria-hidden="true" />}
            label="All Products"
            isActive={pathname === "/" && activeCategory === null}
            onClick={() => selectCategory(null)}
          />
          <SidebarItem
            icon={<ShoppingCart className="size-5" aria-hidden="true" />}
            label="Shopping Cart"
            isActive={pathname === "/cart"}
            rightElement={
              cartCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : undefined
            }
            onClick={() => router.push("/cart")}
          />
          <SidebarItem
            icon={<Truck className="size-5" aria-hidden="true" />}
            label="Track Order"
            isActive={pathname === "/track"}
            onClick={() => router.push("/track")}
          />
        </SidebarGroupRow>

        <SidebarGroupRow>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category] ?? Tag
            return (
              <SidebarItem
                key={category}
                icon={<Icon className="size-5" aria-hidden="true" />}
                label={category}
                isActive={activeCategory === category}
                rightElement={
                  <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/60">
                    {countFor(category)}
                  </span>
                }
                onClick={() => selectCategory(category)}
              />
            )
          })}
        </SidebarGroupRow>

        <SidebarGroupRow>
          <SidebarGroupLabel>Support</SidebarGroupLabel>
          <SidebarItem
            icon={<MessageCircle className="size-5" aria-hidden="true" />}
            label="WhatsApp"
            onClick={() =>
              window.open(buildGeneralInquiryUrl(), "_blank", "noopener,noreferrer")
            }
          />
          <SidebarItem
            icon={<Radio className="size-5" aria-hidden="true" />}
            label="Join Channel"
            onClick={() =>
              window.open(WHATSAPP_CHANNEL_URL, "_blank", "noopener,noreferrer")
            }
          />
          <SidebarItem
            icon={<Mail className="size-5" aria-hidden="true" />}
            label="Email"
            onClick={() => window.open(`mailto:${CONTACT_EMAIL}`)}
          />
        </SidebarGroupRow>

        <SidebarGroupRow>
          <SidebarGroupLabel>About</SidebarGroupLabel>
          <SidebarItem
            icon={<Info className="size-5" aria-hidden="true" />}
            label="About"
            onClick={() => router.push("/about")}
          />
          <SidebarItem
            icon={<Heart className="size-5" aria-hidden="true" />}
            label="Hall of Fame"
            onClick={() => router.push("/hall-of-fame")}
          />
          <SidebarItem
            icon={<History className="size-5" aria-hidden="true" />}
            label="Changelog"
            onClick={() => router.push("/changelog")}
          />
          <SidebarItem
            icon={<GitFork className="size-5" aria-hidden="true" />}
            label="Open Source"
            onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")}
          />
          <SidebarItem
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            label="Admin"
            isActive={pathname === "/admin"}
            onClick={() => router.push("/admin")}
          />
        </SidebarGroupRow>
      </SidebarContent>

      <SidebarFooter className="rounded-b-[24px]">
        <SidebarFooterContent
          theme={theme ?? "dark"}
          onThemeChange={(next) => animateThemeCircularExpansion(null, next, setTheme)}
        />
      </SidebarFooter>
    </Sidebar>
  )
}