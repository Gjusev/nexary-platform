"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9 relative overflow-hidden" aria-label="Toggle theme">
                <span className="sr-only">Toggle theme</span>
            </Button>
        )
    }

    const isDark = resolvedTheme === "dark"

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative overflow-hidden"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ rotate: -90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 90, scale: 0, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            duration: 0.3,
                        }}
                        className="absolute"
                    >
                        <Moon className="h-4 w-4 text-foreground" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ rotate: 90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: -90, scale: 0, opacity: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                            duration: 0.3,
                        }}
                        className="absolute"
                    >
                        <Sun className="h-4 w-4 text-foreground" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Glow effect on hover */}
            <motion.div
                className="absolute inset-0 rounded-md bg-primary/10 opacity-0"
                whileHover={{ opacity: 1, scale: 1.1 }}
                transition={{ duration: 0.2 }}
            />

            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
