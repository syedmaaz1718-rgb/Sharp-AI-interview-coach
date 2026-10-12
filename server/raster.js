// SVG to PNG (for link previews, which do not render SVG) and a one-page PDF of the Score card.
// Fonts are bundled (DejaVu Sans, free license) so text renders the same on any host, even one with no system fonts.
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import PDFDocument from 'pdfkit'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts')
const fontFiles = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f))
const cache = new Map()

export function svgToPng(svg, width = 1200) {
  const key = crypto.createHash('sha256').update(svg).digest('hex') + ':' + width
  if (cache.has(key)) return cache.get(key)
  const png = new Resvg(svg.replace(/font-family="[^"]*"/g, 'font-family="DejaVu Sans"'), { fitTo: { mode: 'width', value: width }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' } }).render().asPng()
  if (cache.size > 60) cache.delete(cache.keys().next().value)
  cache.set(key, png)
  return png
}

export const brandSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07080d"/><stop offset="1" stop-color="#141033"/></linearGradient><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#34d399"/></linearGradient><radialGradient id="a" cx=".15" cy=".1" r=".6"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".45"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient><radialGradient id="b" cx=".9" cy=".95" r=".55"><stop offset="0" stop-color="#34d399" stop-opacity=".35"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#b)"/><rect x="80" y="90" width="72" height="72" rx="20" fill="url(#g)"/><text x="116" y="143" text-anchor="middle" font-size="46" font-weight="700" fill="#07080d" font-family="Inter,Arial,sans-serif">S</text><text x="172" y="140" font-size="40" font-weight="700" fill="#fff" font-family="Inter,Arial,sans-serif">SharpAI</text><text x="80" y="300" font-size="72" font-weight="700" fill="#fff" font-family="Inter,Arial,sans-serif">Interview like it</text><text x="80" y="388" font-size="72" font-weight="700" fill="url(#g)" font-family="Inter,Arial,sans-serif">counts. Out loud.</text><text x="80" y="470" font-size="28" fill="#aab4d6" font-family="Inter,Arial,sans-serif">Voice and video AI interviews for candidates and recruiters.</text><text x="80" y="520" font-size="24" fill="#7f8ab0" font-family="Inter,Arial,sans-serif">1,300+ company styles · Hinglish · Verified Skill Passport</text></svg>`

export function scorePdf(card, svg) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `SharpAI Score ${card.score}/100`, Author: 'SharpAI', Subject: `${card.role || 'Mock interview'} score card` } })
    const chunks = []
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject)
    const W = doc.page.width - 80
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff')
    doc.image(svgToPng(svg, 1800), 40, 40, { width: W })
    let y = 40 + W * 0.525 + 28
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(18).text(card.name ? `${card.name}'s SharpAI Score` : 'SharpAI Score', 40, y); y += 28
    doc.font('Helvetica').fontSize(11).fillColor('#374151').text(`${card.role || 'Mock interview'}  |  ${card.score} / 100  |  ${card.band}`, 40, y); y += 24
    for (const d of (card.dims || []).slice(0, 5)) {
      doc.fillColor('#111827').fontSize(11).text(d.label, 40, y, { width: 170, continued: false })
      doc.roundedRect(215, y + 2, 260, 9, 4.5).fill('#e5e7eb')
      doc.roundedRect(215, y + 2, Math.max(4, 2.6 * d.score), 9, 4.5).fill('#7c3aed')
      doc.fillColor('#111827').text(String(d.score), 485, y, { width: 40 }); y += 22
    }
    y += 10
    doc.fillColor('#374151').fontSize(10).text(`Strongest area: ${card.strongest || 'n/a'}`, 40, y, { width: W }); y += 30
    doc.fillColor('#6b7280').fontSize(9).text('How this was scored: content, voice, presence and consistency, from the answers given in a SharpAI practice interview. It is a practice signal and not a hiring decision, and it is not affiliated with any company. Generated ' + new Date().toUTCString() + '.', 40, y, { width: W, lineGap: 2 })
    doc.end()
  })
}
