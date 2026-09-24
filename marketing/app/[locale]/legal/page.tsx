"use client"

import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"

export default function LegalPage() {
  const t = useTranslations("legal")

  return (
    <div className="min-h-screen py-20 md:py-28">
      <div className="container max-w-4xl">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("headline")}
          </h1>
        </motion.div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="impressum" className="space-y-12">
          {/* Impressum Tab */}
          <TabsContent value="impressum">
            <Card>
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  {t("impressum.headline")}
                </h2>
                {/* Full impressum content - will be updated via translations */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Datenschutz Tab */}
          <TabsContent value="privacy">
            <Card>
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  {t("privacy.headline")}
                </h2>
                {/* Full GDPR content - will be updated via translations */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AGB Tab */}
          <TabsContent value="agb">
            <Card>
              <CardContent className="p-6 md:p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  {t("agb.headline")}
                </h2>
                {/* Full AGB content - will be updated via translations */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
