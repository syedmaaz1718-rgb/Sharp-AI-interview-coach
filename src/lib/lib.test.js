import test from 'node:test'
import assert from 'node:assert/strict'
import { countFillers, scorePace, scoreFillers, scoreEyeContact, trap, analyzeAnswer, buildReport, scoreAnswerContent, wavg } from './analysis.js'
import { headPose, FaceAccumulator, isLookingAtCamera, frameFromMediaPipe } from './faceMath.js'
import { VoiceAccumulator } from './voiceMetrics.js'

const Q = { id: 'b1', category: 'behavioral', text: 'Tell me about a time you faced a difficult challenge in a project and how you handled it.', keywords: ['challenge', 'problem', 'solution', 'learned', 'team', 'deadline', 'result'] }
const GOOD = 'During my second year project we had a deadline in two weeks and our team hit a serious problem: the model accuracy was only 61 percent. I was responsible for the data pipeline, so I analyzed the errors, found that 30% of labels were wrong, and I fixed them with a small script. As a result accuracy improved to 84 percent and we delivered on time. I learned to check the data before the model.'
const BAD = 'um so like basically I just did it you know and it was fine'

test('filler counting', () => {
  const f = countFillers('Um, so like I basically did, you know, a thing. I would like to go. It looks like rain.')
  assert.equal(f.byWord.um, 1)
  assert.equal(f.byWord.basically, 1)
  assert.equal(f.byWord['you know'], 1)
  assert.equal(f.byWord.like, 1)
})

test('trap shape and score helpers', () => {
  assert.equal(trap(5, 0, 2, 8, 10), 1)
  assert.equal(trap(1, 0, 2, 8, 10), 0.5)
  assert.equal(trap(11, 0, 2, 8, 10), 0)
  assert.equal(scorePace(140), 10)
  assert.ok(scorePace(250) < 2)
  assert.ok(scorePace(60) < 4)
  assert.equal(scoreFillers(0), 10)
  assert.ok(scoreFillers(12) === 0)
  assert.equal(scoreEyeContact(0.8), 10)
  assert.equal(scoreEyeContact(0.1), 0)
  assert.equal(wavg([[null, 1], [8, 1], [6, 3]]), 6.5)
  assert.equal(wavg([[null, 1]]), null)
})

test('good answer scores higher than bad answer', () => {
  const g = scoreAnswerContent(Q, GOOD)
  const b = scoreAnswerContent(Q, BAD)
  assert.ok(g.score >= 7, 'good ' + g.score)
  assert.ok(b.score <= 3.5, 'bad ' + b.score)
  assert.ok(g.keywordsHit.includes('deadline'))
  assert.equal(scoreAnswerContent(Q, '').score, 0)
})

test('analyzeAnswer: typed input skips voice scores, speech computes pace and fillers', () => {
  const typed = analyzeAnswer({ question: Q, transcript: GOOD, durationSec: 40, input: 'typed', metrics: {} })
  assert.equal(typed.scores.pace, null)
  assert.equal(typed.scores.voice, null)
  assert.equal(typed.scores.face, null)
  const spoken = analyzeAnswer({ question: Q, transcript: BAD + ' ' + BAD, durationSec: 12, input: 'speech', metrics: { voice: { silenceRatio: 0.2, energyDbStd: 6 } } })
  assert.ok(spoken.fillers.total >= 6)
  assert.ok(spoken.scores.filler < 4)
  assert.ok(spoken.wpm > 100)
  assert.ok(spoken.tips.some((t) => t.area === 'voice' && /filler/.test(t.text)))
})

test('face scores flow into the analysis', () => {
  const a = analyzeAnswer({ question: Q, transcript: GOOD, durationSec: 40, input: 'speech', metrics: { face: { eyeContactRatio: 0.3, smileRatio: 0.2, browMean: 0.1, headMotion: 4 } } })
  assert.ok(a.scores.eye < 3)
  assert.ok(a.tips.some((t) => t.area === 'face' && /eye contact/i.test(t.text)))
})

test('buildReport aggregates and ranks', () => {
  const mk = (t, face) => ({ question: Q, transcript: t, durationSec: 40, analysis: analyzeAnswer({ question: Q, transcript: t, durationSec: 40, input: 'speech', metrics: { face, voice: { silenceRatio: 0.2, energyDbStd: 6 } } }), metricsFace: face })
  const face = { eyeContactRatio: 0.8, smileRatio: 0.3, browMean: 0.05, headMotion: 5 }
  const r = buildReport([mk(GOOD, face), mk(BAD, face)])
  assert.equal(r.questions, 2)
  assert.equal(r.best, 0)
  assert.equal(r.worst, 1)
  assert.ok(r.scores.overall > 0 && r.scores.overall <= 10)
  assert.ok(r.stats.totalFillers >= 3)
  assert.match(r.headline, /filler/)
  assert.equal(r.stats.eyeContactPct, 80)
})

test('headPose: identity is zero, yaw rotation detected', () => {
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const p = headPose(id)
  assert.ok(Math.abs(p.yaw) < 1e-9 && Math.abs(p.pitch) < 1e-9)
  const a = (30 * Math.PI) / 180
  const yawed = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]
  assert.ok(Math.abs(Math.abs(headPose(yawed).yaw) - 30) < 1e-6)
  assert.equal(headPose(null), null)
})

test('FaceAccumulator: eye contact, smile and motion', () => {
  const acc = new FaceAccumulator()
  for (let i = 0; i < 20; i++) acc.add(i * 0.2, { yaw: 0, pitch: 0, gx: 0, gy: 0, smile: 0.5, brow: 0.1 })
  for (let i = 20; i < 30; i++) acc.add(i * 0.2, { yaw: 40, pitch: 0, gx: 0, gy: 0, smile: 0, brow: 0.1 })
  acc.add(6.2, null)
  const s = acc.summary()
  assert.equal(s.frames, 31)
  assert.ok(Math.abs(s.eyeContactRatio - 20 / 30) < 1e-9)
  assert.ok(Math.abs(s.smileRatio - 20 / 30) < 1e-9)
  assert.ok(s.detectedRatio < 1)
  assert.ok(s.headMotion > 0)
  assert.equal(isLookingAtCamera({ yaw: 0, pitch: 0, gx: 0.5, gy: 0 }), false)
})

test('frameFromMediaPipe reads blendshapes', () => {
  const f = frameFromMediaPipe([{ categoryName: 'mouthSmileLeft', score: 0.6 }, { categoryName: 'mouthSmileRight', score: 0.4 }, { categoryName: 'eyeLookOutLeft', score: 0.6 }], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  assert.ok(Math.abs(f.smile - 0.5) < 1e-9)
  assert.ok(f.gx > 0.25)
})

test('VoiceAccumulator trims lead/trail silence and measures pauses', () => {
  const v = new VoiceAccumulator()
  for (let i = 0; i < 20; i++) v.add(0.0005)
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 15; i++) v.add(0.05 + (i % 3) * 0.03)
    for (let i = 0; i < 5; i++) v.add(0.0005)
  }
  for (let i = 0; i < 20; i++) v.add(0.0005)
  const s = v.summary()
  assert.ok(s.silenceRatio > 0.1 && s.silenceRatio < 0.3, 'silence ' + s.silenceRatio)
  assert.ok(s.energyDbStd > 1)
  const quiet = new VoiceAccumulator()
  for (let i = 0; i < 50; i++) quiet.add(0.00001)
  assert.equal(quiet.summary().silenceRatio, 1)
})

import { markFillers } from './analysis.js'
test('markFillers flags the same words countFillers counts', () => {
  const text = 'Um, so like I basically did, you know, a thing. I would like to go.'
  const segs = markFillers(text)
  assert.equal(segs.map((s) => s.t).join(''), text)
  const flagged = segs.filter((s) => s.f && /[a-z]/i.test(s.t)).map((s) => s.t.toLowerCase())
  assert.deepEqual(flagged, ['um', 'like', 'basically', 'you', 'know'])
  assert.equal(countFillers(text).total, 4)
})

import { TimelineRecorder, sampleAt, eyeSegments, eyePercent, newFillerWord } from './timeline.js'
import { scoreVoice, pickVoice } from './tts.js'
import { extractResumeFacts } from '../../server/resume.js'

test('timeline recorder samples, segments and filler dedupe', () => {
  const tl = new TimelineRecorder(0.25)
  for (let i = 0; i < 40; i++) tl.add(i * 0.1, { detected: i < 35, looking: i < 20, smile: 0.2, level: 0.05 })
  tl.addFiller(1.0, 'um'); tl.addFiller(1.1, 'um'); tl.addFiller(3, 'like')
  const x = tl.export(4)
  assert.ok(x.samples.length >= 12 && x.samples.length <= 15)
  assert.equal(x.fillers.length, 2)
  assert.equal(sampleAt(x, 0.1).e, 1)
  assert.equal(sampleAt(x, 3.0).e, 0)
  const seg = eyeSegments(x)
  assert.deepEqual(seg.map((s) => s.kind), ['eye', 'away', 'none'])
  assert.ok(eyePercent(x) > 50 && eyePercent(x) < 70)
  assert.equal(sampleAt({ samples: [] }, 1), null)
  assert.equal(newFillerWord({ um: 1 }, { um: 1, like: 1 }), 'like')
  assert.equal(newFillerWord({ um: 1 }, { um: 1 }), null)
})

test('voice picking prefers natural english voices', () => {
  const voices = [
    { name: 'Microsoft Hindi', lang: 'hi-IN' },
    { name: 'eSpeak English', lang: 'en-US', localService: true },
    { name: 'Google UK English Female', lang: 'en-GB', localService: false },
    { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN', localService: false },
  ]
  assert.equal(pickVoice(voices).name, 'Microsoft Neerja Online (Natural) - English (India)')
  assert.equal(pickVoice([{ name: 'Hindi', lang: 'hi-IN' }]), null)
  assert.ok(scoreVoice(voices[2]) > scoreVoice(voices[1]))
})
