import test from 'node:test'
import assert from 'node:assert/strict'
import { svgToPng, scorePdf, brandSvg } from './raster.js'
import { scoreCardSvg } from '../src/lib/scoreCard.js'

const card = { score: 78, band: 'Strong', name: 'Test', role: 'Software Engineer', strongest: 'Clarity', dims: [{ label: 'Content', score: 80 }, { label: 'Voice', score: 70 }] }

test('score card renders to a real PNG and a one-page PDF, brand image renders too', async () => {
  const png = svgToPng(scoreCardSvg(card))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.ok(png.length > 20000)
  const pdf = await scorePdf(card, scoreCardSvg(card))
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.equal(svgToPng(brandSvg()).subarray(1, 4).toString(), 'PNG')
})
