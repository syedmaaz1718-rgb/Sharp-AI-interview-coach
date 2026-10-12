import fs from 'node:fs'
import crypto from 'node:crypto'
import { Resvg } from '@resvg/resvg-js'
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#141033"/><stop offset="1" stop-color="#07080d"/></linearGradient></defs><rect width="512" height="512" rx="0" fill="url(#bg)"/><rect x="91" y="91" width="330" height="330" rx="96" fill="#0d0f1a" stroke="#746589" stroke-width="4"/><path d="M334 184H236a39 39 0 0 0 0 78h57" fill="none" stroke="#c4b5fd" stroke-width="35" stroke-linecap="round"/><path d="M178 328h98a39 39 0 0 0 0-78h-57" fill="none" stroke="#2dd4bf" stroke-width="35" stroke-linecap="round"/></svg>`
fs.mkdirSync('public/icons',{recursive:true})
fs.writeFileSync('public/icons/app.svg',icon)
for (const size of [180,192,512]) fs.writeFileSync(`public/icons/app-${size}.png`,new Resvg(icon,{fitTo:{mode:'width',value:size}}).render().asPng())
const version=crypto.createHash('sha256').update(fs.readFileSync('public/offline.html')).update(icon).update(fs.readFileSync('scripts/sw-template.js')).digest('hex').slice(0,12)
fs.writeFileSync('public/sw.js',fs.readFileSync('scripts/sw-template.js','utf8').replace('__VERSION__',version))
