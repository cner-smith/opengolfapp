import type { RoundSummaryContent } from '../_shared/round-summary.ts'

const INK = '#1C211C'
const ACCENT = '#1F3D2C'
const NEG = '#A33A2A'
const LINE = '#D9D2BF'
const BG = '#FBF8F1'

// Inline-styled, table-based HTML — the email-safe standard. No external
// stylesheet, no web fonts: renders consistently in Gmail / Outlook / Apple Mail.
export function renderHtml(c: RoundSummaryContent): string {
  const toParColor = c.hero.toPar < 0 ? ACCENT : c.hero.toPar > 0 ? NEG : INK
  const bars = c.bars
    .map((b) => {
      const barColor = b.value < 0 ? NEG : ACCENT
      const valueLabel = `${b.value > 0 ? '+' : ''}${b.value.toFixed(1)}`
      return `
      <tr>
        <td style="padding:6px 0;font:13px/1.4 -apple-system,Segoe UI,sans-serif;color:${INK};width:120px">${b.label}</td>
        <td style="padding:6px 0;width:100%">
          <div style="background:#EBE5D6;border-radius:2px;height:10px;width:100%">
            <div style="background:${barColor};height:10px;border-radius:2px;width:${b.widthPct}%"></div>
          </div>
        </td>
        <td style="padding:6px 0 6px 10px;font:13px/1.4 -apple-system,Segoe UI,sans-serif;color:${barColor};text-align:right;white-space:nowrap">${valueLabel}</td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html><body style="margin:0;background:${BG};padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid ${LINE};border-radius:4px">
    <tr><td style="padding:28px 28px 0">
      <div style="font:600 11px/1 -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8A8B7E">Round summary</div>
      <div style="font:500 24px/1.2 Georgia,serif;color:${INK};margin-top:10px">${c.hero.score} <span style="color:${toParColor};font-size:18px">(${c.hero.toParLabel})</span></div>
      <p style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#5C6356;margin:10px 0 0">${c.lede}</p>
    </td></tr>
    <tr><td style="padding:20px 28px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#8A8B7E">
      OGA is free and open source. <a href="https://oga.golf" style="color:${ACCENT};text-decoration:none">View the full report →</a><br>
      Don't want these? Turn off round summaries in the app.
    </td></tr>
  </table>
</body></html>`
}
