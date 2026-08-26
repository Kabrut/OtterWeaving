import type { ReactNode } from 'react'
import { Download, FileJson, Printer } from 'lucide-react'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'
import { draftSvg, fabricSvg, threadingSvg, turningSvg } from '../core/export'
import { computeMetrics } from '../core/metrics'
import { FabricCanvas } from './common/FabricCanvas'

function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'wzor'
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-3.5 w-3.5 border border-stone-400 align-middle"
      style={{ backgroundColor: hex }}
    />
  )
}

function Section({
  index,
  title,
  breakBefore,
  children,
}: {
  index: number
  title: string
  breakBefore?: boolean
  children: ReactNode
}) {
  return (
    <section className={`mt-6 ${breakBefore ? 'print-break' : ''}`}>
      <h2 className="mb-2 border-b border-stone-400 pb-1 text-[12pt] font-bold">
        {index}. {title}
      </h2>
      {children}
    </section>
  )
}

export default function PrintView() {
  const draft = useAppStore((s) => s.draft)
  const generator = useAppStore((s) => s.generator)
  if (!draft) return null

  const tablets = draft.tablets.length
  const metrics = computeMetrics(draft)
  const fabricCell = Math.max(3, Math.floor(640 / tablets))
  const slug = slugify(draft.name)
  const totalThreads = metrics.threads.reduce((sum, th) => sum + th.threadCount, 0)
  const sCount = draft.tablets.filter((tb) => tb.twist === 'S').length
  const zCount = draft.tablets.filter((tb) => tb.twist === 'Z').length
  const weftColors = metrics.weft.map((w) => w.hex).join(', ')

  const reverseEvery = generator?.settings.reverseEvery ?? 0
  let reverseText: string
  if (reverseEvery > 0) {
    reverseText = fmt(t('print', 'reverseEvery'), { n: reverseEvery })
  } else {
    const reversalRows: number[] = []
    for (let y = 1; y < draft.rows.length; y += 1) {
      if (draft.rows[y].turns.some((turn, x) => turn !== draft.rows[y - 1].turns[x])) {
        reversalRows.push(y + 1)
      }
    }
    reverseText =
      reversalRows.length > 0
        ? fmt(t('print', 'reverseRows'), { rows: reversalRows.join(', ') })
        : t('print', 'reverseNone')
  }

  const steps = [
    fmt(t('print', 'step1'), { threads: totalThreads, tablets, warp: metrics.warpLengthCm }),
    fmt(t('print', 'step2'), { tablets }),
    fmt(t('print', 'step3'), { s: sCount, z: zCount }),
    t('print', 'step4'),
    fmt(t('print', 'step5'), { weft: weftColors }),
    t('print', 'step6'),
    t('print', 'step7'),
    fmt(t('print', 'step8'), { reverse: reverseText }),
    fmt(t('print', 'step9'), { width: metrics.bandWidthCm }),
    t('print', 'step10'),
  ]

  const dateStr = new Date().toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const turning = turningSvg(draft, { cell: 18 })
  const threading = threadingSvg(draft, { cell: 16 })

  const exportDraftSvg = () => downloadFile(draftSvg(draft, 18), `${slug}-draft.svg`, 'image/svg+xml')
  const exportFabric = () =>
    downloadFile(fabricSvg(draft, 6, 6), `${slug}-tkanina.svg`, 'image/svg+xml')
  const exportJson = () => {
    const json = useAppStore.getState().serializeProject()
    if (json) downloadFile(json, `${slug}.otter.json`, 'application/json')
  }

  return (
    <div>
      <div className="no-print panel mb-4 flex flex-wrap items-center gap-2 p-3">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> {t('print', 'print')}
        </button>
        <p className="mr-auto max-w-xl text-xs leading-snug text-stone-500 dark:text-stone-400">
          {t('print', 'intro')}
        </p>
        <button type="button" className="btn-secondary" onClick={exportDraftSvg}>
          <Download size={15} /> {t('print', 'exportSvg')}
        </button>
        <button type="button" className="btn-secondary" onClick={exportFabric}>
          <Download size={15} /> {t('print', 'exportFabric')}
        </button>
        <button type="button" className="btn-secondary" onClick={exportJson}>
          <FileJson size={15} /> {t('print', 'exportJson')}
        </button>
      </div>

      <div className="print-page mx-auto w-full max-w-[210mm] bg-white px-8 py-6 text-stone-900 shadow-sm print:p-0 print:shadow-none">
        <header className="border-b-2 border-stone-800 pb-3">
          <h1 className="text-[16pt] font-bold leading-tight">{draft.name}</h1>
          <p className="mt-0.5 text-[10pt] text-stone-600">{t('app', 'tagline')}</p>
          <p className="text-[9pt] text-stone-500">
            {t('print', 'generated')}: {dateStr}
          </p>
        </header>

        <Section index={1} title={t('print', 'fabric')}>
          <div className="overflow-x-auto">
            <FabricCanvas draft={draft} cell={fabricCell} className="mx-auto block" />
          </div>
        </Section>

        <Section index={2} title={t('print', 'turning')}>
          <div className="overflow-x-auto">
            <div
              className="[&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: turning }}
            />
          </div>
          <p className="mt-1 text-[9pt] italic text-stone-600">
            {t('print', 'startRow')} · {t('print', 'weaveDir')}: {t('print', 'north')}
          </p>
        </Section>

        <Section index={3} title={t('print', 'threading')}>
          <div className="overflow-x-auto">
            <div
              className="[&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: threading }}
            />
          </div>
        </Section>

        <Section index={4} title={`${t('print', 'legend')} — ${t('print', 'materials')}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[10pt] font-semibold">{t('print', 'threads')}</h3>
              <table className="w-full text-[9pt]">
                <thead>
                  <tr className="border-b border-stone-400 text-left">
                    <th className="py-0.5 font-semibold">{t('print', 'color')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('print', 'threadCount')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('print', 'warpLength')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.threads.map((th) => (
                    <tr key={th.colorId} className="border-b border-stone-200">
                      <td className="py-0.5">
                        <Swatch hex={th.hex} />
                        {th.name ? `${th.name} ` : ''}
                        {th.hex}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{th.threadCount}</td>
                      <td className="py-0.5 text-right tabular-nums">{th.warpLengthCm} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-1 text-[10pt] font-semibold">{t('print', 'weft')}</h3>
              <table className="w-full text-[9pt]">
                <thead>
                  <tr className="border-b border-stone-400 text-left">
                    <th className="py-0.5 font-semibold">{t('print', 'color')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('print', 'rowsLabel')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('print', 'weftLength')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.weft.map((w) => (
                    <tr key={w.colorId} className="border-b border-stone-200">
                      <td className="py-0.5">
                        <Swatch hex={w.hex} />
                        {w.hex}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">{w.rows}</td>
                      <td className="py-0.5 text-right tabular-nums">{w.lengthCm} cm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-[9pt]">
            {t('print', 'bandWidth')}: <strong>{metrics.bandWidthCm} cm</strong> ·{' '}
            {t('print', 'wovenLength')}: <strong>{metrics.wovenLengthCm} cm</strong> ·{' '}
            {t('print', 'totalThreads')}: <strong>{totalThreads}</strong>
          </p>
        </Section>

        <Section index={5} title={t('print', 'instructions')} breakBefore>
          <ol className="list-decimal space-y-1 pl-6 text-[10pt] leading-snug">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>

        <footer className="mt-8 border-t border-stone-300 pt-2 text-center text-[8pt] text-stone-500">
          {t('print', 'footer')}
        </footer>
      </div>
    </div>
  )
}
