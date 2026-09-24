import { redirect } from "next/navigation"
import { EXTERNAL_URLS } from "@/lib/constants"

export default async function RegisterPage() {
    redirect(EXTERNAL_URLS.nexus.register)
}
