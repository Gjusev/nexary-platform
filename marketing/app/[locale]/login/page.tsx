import { redirect } from "next/navigation"
import { EXTERNAL_URLS } from "@/lib/constants"

export default async function LoginPage() {
    redirect(EXTERNAL_URLS.nexus.login)
}
