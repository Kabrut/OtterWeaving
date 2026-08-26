import { X } from 'lucide-react'
import { t } from '../../i18n/pl'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null
  const sections = [
    ['threadingTitle', 'threadingBody'],
    ['turningTitle', 'turningBody'],
    ['fabricTitle', 'fabricBody'],
    ['twistTitle', 'twistBody'],
    ['inkleTitle', 'inkleBody'],
  ] as const
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('help', 'title')}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('help', 'title')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-600 dark:text-stone-300">{t('help', 'intro')}</p>
        <div className="space-y-4">
          {sections.map(([titleKey, bodyKey]) => (
            <section key={titleKey}>
              <h3 className="mb-1 font-semibold text-otter-700 dark:text-otter-300">
                {t('help', titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {t('help', bodyKey)}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
