#!/usr/bin/env node
// Converts assets/icon.png → assets/icon.icns using macOS built-in tools.
// Run: npm run make-icons
// Requires: assets/icon.png at 1024×1024px (or at least 512×512)

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'assets', 'icon.png')
const ICONSET = path.join(__dirname, '..', 'assets', 'icon.iconset')
const DEST = path.join(__dirname, '..', 'assets', 'icon.icns')

if (!fs.existsSync(SRC)) {
  console.error('❌  Place a 1024×1024 PNG at assets/icon.png first.')
  process.exit(1)
}

fs.mkdirSync(ICONSET, { recursive: true })

// Required sizes for a macOS iconset
const sizes = [16, 32, 64, 128, 256, 512, 1024]
for (const size of sizes) {
  const out = path.join(ICONSET, `icon_${size}x${size}.png`)
  execSync(`sips -z ${size} ${size} "${SRC}" --out "${out}" --resampleHeightWidthMax ${size}`, { stdio: 'pipe' })
  // @2x variant (Retina)
  if (size <= 512) {
    const out2x = path.join(ICONSET, `icon_${size}x${size}@2x.png`)
    const size2x = size * 2
    execSync(`sips -z ${size2x} ${size2x} "${SRC}" --out "${out2x}" --resampleHeightWidthMax ${size2x}`, { stdio: 'pipe' })
  }
}

execSync(`iconutil -c icns "${ICONSET}" -o "${DEST}"`)
fs.rmSync(ICONSET, { recursive: true })

console.log(`✓  Created ${DEST}`)
