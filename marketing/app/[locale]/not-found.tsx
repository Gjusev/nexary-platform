import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    const t = useTranslations('notFound')

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
                {t('title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md">
                {t('description')}
            </p>
            <Link href="/">
                <Button size="lg">
                    {t('backHome')}
                </Button>
            </Link>
        </div>
    )
}
