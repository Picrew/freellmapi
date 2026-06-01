import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useI18n()
  const label = language === 'zh' ? t('Switch to English') : t('Switch to Chinese')

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      aria-label={label}
      title={label}
      className="gap-1.5"
    >
      <Languages className="size-4" />
      <span className="text-xs font-medium tabular-nums">{language === 'zh' ? 'EN' : '中'}</span>
    </Button>
  )
}
