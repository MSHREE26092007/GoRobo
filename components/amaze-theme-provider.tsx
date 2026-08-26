"use client"

import { useEffect, useRef } from "react"
import { ThemeProvider, useColorPalette, useTheme } from "@amazecontinuityprojects/amazeui"

function PaletteInitializer() {
  const { setPaletteId } = useColorPalette()

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("club_hub_settings")
      const saved = raw ? JSON.parse(raw) : null
      const hasPalette = Boolean(saved?.colorPalette) || Boolean(localStorage.getItem("accent"))
      if (!hasPalette) setPaletteId("forest")
    } catch {
      setPaletteId("forest")
    }
  }, [setPaletteId])

  return null
}

function PaletteSyncer() {
  const { theme } = useTheme()
  const { paletteId, setPaletteId } = useColorPalette()
  // Remember the last user-chosen (non-default) palette so it can be restored
  // after the forced "default" pass on theme switches. Written only inside an
  // effect — never during render.
  const lastNonDefaultRef = useRef("default")

  useEffect(() => {
    if (paletteId !== "default") lastNonDefaultRef.current = paletteId
  }, [paletteId])

  useEffect(() => {
    const id = lastNonDefaultRef.current
    if (id === "default") return
    setPaletteId("default")
    const raf = requestAnimationFrame(() => setPaletteId(id))
    return () => cancelAnimationFrame(raf)
  }, [theme, setPaletteId])

  return null
}

export function AmazeThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      value={{ light: "light", dark: "dark" }}
    >
      <PaletteInitializer />
      <PaletteSyncer />
      {children}
    </ThemeProvider>
  )
}