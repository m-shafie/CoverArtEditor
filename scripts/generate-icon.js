// Coverify app icon generator.
// Renders a 1024x1024 rounded-square tile: dark plum background with a rose
// glow, and a vinyl disc in the app's rose gradient (#f43f5e -> #dc2626)
// with a warm-white label, matching the titlebar logo and styles.css tokens.

const { PNG } = require('pngjs');
const fs = require('fs');

const SIZE = 1024;
const png = new PNG({ width: SIZE, height: SIZE });

const cx = SIZE / 2, cy = SIZE / 2;
const CORNER_R = SIZE * 0.22;
const DISC_R = SIZE * 0.335;
const LABEL_R = DISC_R * 0.38;
const HOLE_R = DISC_R * 0.075;

// Signed distance to a rounded square centered at (cx, cy).
function roundedSquareDist(x, y) {
  const half = SIZE / 2 - 1;
  const qx = Math.abs(x - cx) - (half - CORNER_R);
  const qy = Math.abs(y - cy) - (half - CORNER_R);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - CORNER_R;
}

// 0..1 coverage from a signed distance, ~1.5px anti-aliased edge.
function smooth(dist) {
  return Math.min(1, Math.max(0, 0.5 - dist / 1.5));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const dx = x - cx, dy = y - cy;
    const dist = Math.hypot(dx, dy);

    // --- Background: dark plum vertical gradient (#1b161b -> #130f13) ---
    const tv = y / SIZE;
    let rv = mix(27, 19, tv), gv = mix(22, 15, tv), bv = mix(27, 19, tv);

    // Subtle rose glow from the top-right, like --bg-gradient.
    const gd = Math.hypot(x - SIZE * 0.82, y - SIZE * 0.1);
    const glow = Math.max(0, 1 - gd / (SIZE * 0.75)) ** 2 * 0.30;
    rv = mix(rv, 225, glow);
    gv = mix(gv, 29, glow);
    bv = mix(bv, 72, glow);

    // --- Vinyl disc: rose gradient, lit from top-left ---
    const discCov = smooth(dist - DISC_R);
    if (discCov > 0) {
      const td = (dx + dy) / (2 * DISC_R) * 0.5 + 0.5; // diagonal gradient
      let dr = mix(251, 190, td), dg = mix(81, 22, td), db = mix(115, 50, td);

      // Faint concentric grooves between label and rim.
      const ringT = (dist - LABEL_R) / (DISC_R - LABEL_R);
      if (ringT > 0.12 && ringT < 0.96) {
        const groove = Math.sin(dist * Math.PI / 14) ** 2 * 0.10;
        dr *= 1 - groove; dg *= 1 - groove; db *= 1 - groove;
      }

      // Soft light sweep across the upper-left of the disc.
      const sweep = Math.max(0, -(dx + dy) / (2 * DISC_R)) * 0.22;
      dr = mix(dr, 255, sweep); dg = mix(dg, 255, sweep); db = mix(db, 255, sweep);

      rv = mix(rv, dr, discCov);
      gv = mix(gv, dg, discCov);
      bv = mix(bv, db, discCov);
    }

    // Thin warm-white rim highlight on the disc edge.
    const rimCov = smooth(Math.abs(dist - DISC_R) - SIZE * 0.004);
    if (rimCov > 0) {
      rv = mix(rv, 250, rimCov * 0.5);
      gv = mix(gv, 200, rimCov * 0.5);
      bv = mix(bv, 210, rimCov * 0.5);
    }

    // --- Center label: warm white (#faf3f5) ---
    const labelCov = smooth(dist - LABEL_R);
    if (labelCov > 0) {
      const shade = 1 - Math.max(0, (dx + dy) / (2 * LABEL_R)) * 0.07;
      rv = mix(rv, 250 * shade, labelCov);
      gv = mix(gv, 243 * shade, labelCov);
      bv = mix(bv, 245 * shade, labelCov);
    }

    // --- Spindle hole: dark plum ---
    const holeCov = smooth(dist - HOLE_R);
    if (holeCov > 0) {
      rv = mix(rv, 25, holeCov);
      gv = mix(gv, 18, holeCov);
      bv = mix(bv, 24, holeCov);
    }

    // --- Rounded-square tile mask with transparent corners ---
    const alpha = smooth(roundedSquareDist(x, y));

    png.data[i] = Math.round(Math.min(255, Math.max(0, rv)));
    png.data[i + 1] = Math.round(Math.min(255, Math.max(0, gv)));
    png.data[i + 2] = Math.round(Math.min(255, Math.max(0, bv)));
    png.data[i + 3] = Math.round(alpha * 255);
  }
}

const outPath = process.argv[2] || 'icon.png';
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log(`Icon written to ${outPath}`);
