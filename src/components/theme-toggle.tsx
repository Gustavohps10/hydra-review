import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const resolvedTheme = theme === "system" ? (isSystemDark ? "dark" : "light") : theme

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light")
  }

  return (
    <button onClick={toggleTheme} className="inline-flex items-center justify-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
      {resolvedTheme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
