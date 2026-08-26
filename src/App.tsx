import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleHelp, FileDown, FileUp, Moon, Sparkles, Sun, Waves } from 'lucide-react'
import { useAppStore, restoreAutosave, restoreInkleAutosave, type Tab } from './state/store'
import { t } from './i18n/pl'
import { HelpModal } from './ui/common/HelpModal'
import WizardView from './ui/WizardView'
import ResultView from './ui/ResultView'
import EditorView from './ui/EditorView'
import PrintView from './ui/PrintView'
import InkleWizardView from './ui/InkleWizardView'
import InkleEditorView from './ui/InkleEditorView'
import InklePrintView from './ui/InklePrintView'

const THEME_KEY = 'otterweaving:theme'

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const { dark, toggle } = useTheme()
  const [helpOpen, setHelpOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)
  const tab = useAppStore((s) => s.tab)
  const draft = useAppStore((s) => s.draft)
  const inkleDraft = useAppStore((s) => s.inkleDraft)
  const manualEdits = useAppStore((s) => s.manualEdits)
  const setTab = useAppStore((s) => s.setTab)
  const serializeProject = useAppStore((s) => s.serializeProject)
  const loadFromProjectFile = useAppStore((s) => s.loadFromProjectFile)

  useEffect(() => {
    restoreAutosave()
    if (useAppStore.getState().draft === null && restoreInkleAutosave()) {
      useAppStore.getState().setTab('inkleEditor')
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSave = useCallback(() => {
    const json = serializeProject()
    if (!json) return
    const name = useAppStore.getState().draft?.name || 'wzor'
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    downloadBlob(json, `${slug || 'wzor'}.otter.json`, 'application/json')
    setToast(t('project', 'saved'))
  }, [serializeProject])

  const handleOpenFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const ok = loadFromProjectFile(String(reader.result))
        setToast(ok ? t('project', 'loaded') : t('project', 'loadError'))
      }
      reader.readAsText(file)
    },
    [loadFromProjectFile],
  )

  const tabletTabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: 'wizard', label: t('app', 'tabWizard'), enabled: true },
    { id: 'result', label: t('app', 'tabResult'), enabled: draft !== null },
    { id: 'editor', label: t('app', 'tabEditor'), enabled: draft !== null },
    { id: 'print', label: t('app', 'tabPrint'), enabled: draft !== null },
  ]

  const inkleTabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: 'inkleWizard', label: t('app', 'tabWizard'), enabled: true },
    { id: 'inkleEditor', label: t('app', 'tabEditor'), enabled: inkleDraft !== null },
    { id: 'inklePrint', label: t('app', 'tabPrint'), enabled: inkleDraft !== null },
  ]

  const tabGroups = [
    { label: t('app', 'groupTablets'), tabs: tabletTabs },
    { label: t('app', 'groupInkle'), tabs: inkleTabs },
  ]

  return (
    <div className="flex min-h-full flex-col print:block">
      <header className="no-print sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <div className="order-1 flex items-center gap-2">
            <Waves className="text-otter-600 dark:text-otter-400" size={22} aria-hidden />
            <div className="leading-tight">
              <div className="text-sm font-bold">{t('app', 'name')}</div>
              <div className="hidden text-[11px] text-stone-500 sm:block dark:text-stone-400">
                {t('app', 'tagline')}
              </div>
            </div>
          </div>
          <nav
            className="order-3 ml-auto flex min-w-0 basis-full flex-nowrap items-center gap-2 overflow-x-auto sm:gap-3 md:order-2 md:basis-auto"
            aria-label="Sekcje aplikacji"
          >
            {tabGroups.map((group, groupIndex) => (
              <div
                key={group.label}
                className={`flex shrink-0 flex-col gap-0.5${
                  groupIndex > 0 ? ' border-l border-stone-200 pl-3 dark:border-stone-800' : ''
                }`}
              >
                <span className="text-[10px] font-semibold tracking-wide text-stone-400 uppercase dark:text-stone-500">
                  {group.label}
                </span>
                <div className="flex items-center gap-1">
                  {group.tabs.map(({ id, label, enabled }) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setTab(id)}
                      className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                        tab === id
                          ? 'bg-otter-600 text-white'
                          : 'text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-stone-300 dark:hover:bg-stone-800'
                      }`}
                      aria-current={tab === id ? 'page' : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-1 border-l border-stone-200 pl-2 md:order-3 md:ml-0 dark:border-stone-800">
            {manualEdits && (
              <span
                className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 md:inline-flex dark:bg-amber-900/40 dark:text-amber-300"
                title={t('app', 'unsaved')}
              >
                <Sparkles size={12} aria-hidden /> {t('app', 'unsaved')}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleOpenFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn-ghost"
              title={t('app', 'open')}
              aria-label={t('app', 'open')}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={17} />
            </button>
            <button
              type="button"
              className="btn-ghost"
              title={t('app', 'save')}
              aria-label={t('app', 'save')}
              onClick={handleSave}
              disabled={!draft}
            >
              <FileDown size={17} />
            </button>
            <button
              type="button"
              className="btn-ghost"
              title={t('app', 'themeDark')}
              aria-label={dark ? t('app', 'themeLight') : t('app', 'themeDark')}
              onClick={toggle}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              title={t('app', 'help')}
              aria-label={t('app', 'help')}
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 print:m-0 print:max-w-none print:p-0">
        {tab === 'wizard' && <WizardView />}
        {tab === 'result' && draft && <ResultView />}
        {tab === 'editor' && draft && <EditorView />}
        {tab === 'print' && draft && <PrintView />}
        {tab === 'inkleWizard' && <InkleWizardView />}
        {tab === 'inkleEditor' && inkleDraft && <InkleEditorView />}
        {tab === 'inklePrint' && inkleDraft && <InklePrintView />}
      </main>

      {toast && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          {toast}
        </div>
      )}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
