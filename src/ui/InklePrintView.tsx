import { Fragment, useMemo } from 'react'
import { Printer } from 'lucide-react'
import type { InklePass } from '../core/inkle'
import { computeInkleMetrics } from '../core/inkle'
import { useAppStore } from '../state/store'
import { t } from '../i18n/pl'

const PRINT_PASS_CHUNK = 40

function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-3.5 w-3.5 border border-stone-400 align-middle"
      style={{ backgroundColor: hex }}
    />
  )
}

export default function InklePrintView() {
  const draft = useAppStore((s) => s.inkleDraft)
  const metrics = useMemo(() => (draft ? computeInkleMetrics(draft) : null), [draft])
  if (!draft || !metrics) return null

  const hexById = new Map(draft.palette.map((c) => [c.id, c.hex]))
  const warpCount = draft.warp.length
  const passesCount = draft.passes.length
  const printCell = Math.min(passesCount > 40 ? 10 : 12, Math.floor(688 / Math.max(warpCount, 1)))
  const printPassChunks: InklePass[][] = []
  for (let i = 0; i < draft.passes.length; i += PRINT_PASS_CHUNK) {
    printPassChunks.push(draft.passes.slice(i, i + PRINT_PASS_CHUNK))
  }
  const dateStr = new Date().toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const weftHex = hexById.get(draft.weft) ?? '#000000'

  const steps = [
    fmt(t('inkle', 'step1'), {
      threads: metrics.warpCount,
      warp: metrics.warpLengthCm,
    }),
    t('inkle', 'step2'),
    t('inkle', 'step3'),
    t('inkle', 'step4'),
    t('inkle', 'step5'),
    t('inkle', 'step6'),
    t('inkle', 'step7'),
    fmt(t('inkle', 'step8'), { width: metrics.bandWidthCm }),
    t('inkle', 'step9'),
  ]

  return (
    <div>
      <div className="no-print panel mb-4 flex flex-wrap items-center gap-2 p-3">
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> {t('inkle', 'print')}
        </button>
        <p className="mr-auto max-w-xl text-xs leading-snug text-stone-500 dark:text-stone-400">
          {t('inkle', 'printIntro')}
        </p>
      </div>

      <div className="print-page mx-auto w-full max-w-[210mm] bg-white px-8 py-6 text-stone-900 shadow-sm print:p-0 print:shadow-none">
        <header className="border-b-2 border-stone-800 pb-3">
          <h1 className="text-[16pt] font-bold leading-tight">{draft.name}</h1>
          <p className="mt-0.5 text-[10pt] text-stone-600">{t('app', 'tagline')}</p>
          <p className="text-[9pt] text-stone-500">
            {t('inkle', 'generated')}: {dateStr}
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-2 border-b border-stone-400 pb-1 text-[12pt] font-bold">
            1. {t('inkle', 'printThreading')}
          </h2>
          <div className="flex flex-wrap gap-px">
            {draft.warp.map((thread, i) => (
              <div key={i} className="flex w-4 flex-col items-center">
                <span className="text-[6pt] tabular-nums text-stone-500">{i + 1}</span>
                <span
                  className={`h-3.5 w-3.5 border border-stone-400 ${thread.pattern ? 'outline outline-1 outline-stone-800' : ''}`}
                  style={{ backgroundColor: hexById.get(thread.colorId) ?? '#000000' }}
                />
                <span className="text-[7pt] font-bold leading-4">{thread.heddled ? 'O' : 'P'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 border-b border-stone-400 pb-1 text-[12pt] font-bold">
            2. {t('inkle', 'printPickup')}
          </h2>
          <div>
            {printPassChunks.map((chunk, ci) => (
              <div key={ci} className="break-inside-avoid">
                <div
                  className="grid w-fit"
                  style={{ gridTemplateColumns: `1.6rem repeat(${warpCount}, ${printCell}px)` }}
                >
                  <div />
                  {draft.warp.map((_, x) => (
                    <div
                      key={x}
                      className="text-center text-[6pt] tabular-nums leading-3 text-stone-500"
                    >
                      {x + 1}
                    </div>
                  ))}
                  {chunk.map((pass, yi) => {
                    const y = ci * PRINT_PASS_CHUNK + yi
                    return (
                      <Fragment key={y}>
                        <div className="pr-1 text-right text-[7pt] tabular-nums leading-none">
                          {y + 1}
                          <span aria-hidden>{pass.up ? '▲' : '▼'}</span>
                        </div>
                        {pass.picks.map((picked, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center border border-stone-200"
                            style={{ width: printCell, height: printCell }}
                          >
                            {picked && (
                              <span
                                className="block rounded-full"
                                style={{
                                  width: printCell * 0.5,
                                  height: printCell * 0.5,
                                  backgroundColor: hexById.get(draft.warp[i].colorId) ?? '#000000',
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-2 border-b border-stone-400 pb-1 text-[12pt] font-bold">
            3. {t('inkle', 'legend')} — {t('inkle', 'materials')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[10pt] font-semibold">{t('inkle', 'threads')}</h3>
              <table className="w-full text-[9pt]">
                <thead>
                  <tr className="border-b border-stone-400 text-left">
                    <th className="py-0.5 font-semibold">{t('inkle', 'color')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('inkle', 'threadCount')}</th>
                    <th className="py-0.5 text-right font-semibold">{t('inkle', 'warpLength')}</th>
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
                      <td className="py-0.5 text-right tabular-nums">{th.count}</td>
                      <td className="py-0.5 text-right tabular-nums">{metrics.warpLengthCm} cm</td>
                    </tr>
                  ))}
                  <tr className="border-b border-stone-200">
                    <td className="py-0.5">
                      <Swatch hex={weftHex} />
                      {t('inkle', 'weftTable')} {weftHex}
                    </td>
                    <td />
                    <td />
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-[9pt]">
                {t('inkle', 'metricsWidth')}: <strong>{metrics.bandWidthCm} cm</strong> ·{' '}
                {t('inkle', 'metricsWovenLength')}: <strong>{metrics.wovenLengthCm} cm</strong> ·{' '}
                {t('inkle', 'metricsThreads')}: <strong>{metrics.warpCount}</strong>
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[10pt] font-semibold">{t('inkle', 'legend')}</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-[9pt] leading-snug">
                <li>{t('inkle', 'legendO')}</li>
                <li>{t('inkle', 'legendP')}</li>
                <li>{t('inkle', 'legendUp')}</li>
                <li>{t('inkle', 'legendDown')}</li>
                <li>{t('inkle', 'legendPick')}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="print-break mt-6">
          <h2 className="mb-2 border-b border-stone-400 pb-1 text-[12pt] font-bold">
            4. {t('inkle', 'instructions')}
          </h2>
          <ol className="list-decimal space-y-1 pl-6 text-[10pt] leading-snug">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        <footer className="mt-8 border-t border-stone-300 pt-2 text-center text-[8pt] text-stone-500">
          {t('inkle', 'printFooter')}
        </footer>
      </div>
    </div>
  )
}
