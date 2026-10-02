// The dominant colors of an image. Median cut finds starting colors: put
// every (sampled) pixel in one box, then keep splitting the box with the
// widest color range at its median until there are `count` boxes. A median
// split can cut through one cluster and average two others together, so a
// few rounds of k-means then move each color to the center of the pixels
// nearest it. Shared by palette(auto) and <pixel-canvas swatches>.

/**
 * @param {ImageData} image
 * @param {number} count how many colors (at most)
 * @returns {number[][]} `[r, g, b]` triples, most common first
 */
export function dominantColors(image, count) {
  const { data } = image;
  const total = data.length / 4;
  // Sample at most ~16k pixels: plenty for a palette, fast on video.
  const step = Math.max(1, Math.floor(total / 16384));
  const pixels = [];
  for (let i = 0; i < total; i += step) {
    if (data[i * 4 + 3] < 128) continue; // mostly transparent: not part of the picture
    pixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  if (!pixels.length) return [];
  const range = (box) => {
    let widest = 0;
    let channel = 0;
    for (let c = 0; c < 3; c++) {
      let min = 255;
      let max = 0;
      for (const p of box) {
        if (p[c] < min) min = p[c];
        if (p[c] > max) max = p[c];
      }
      if (max - min > widest) {
        widest = max - min;
        channel = c;
      }
    }
    return { widest, channel };
  };
  let boxes = [pixels];
  while (boxes.length < count) {
    let pick = -1;
    let best = { widest: 0, channel: 0 };
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const r = range(box);
      if (r.widest > best.widest) {
        best = r;
        pick = i;
      }
    });
    if (pick < 0) break; // nothing left to split: fewer distinct colors than asked for
    const box = boxes[pick].sort((a, b) => a[best.channel] - b[best.channel]);
    const middle = Math.floor(box.length / 2);
    boxes.splice(pick, 1, box.slice(0, middle), box.slice(middle));
  }
  let centers = boxes.filter((box) => box.length).map((box) => {
    const sum = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) sum[c] += p[c];
    return sum.map((v) => v / box.length);
  });
  let sizes = [];
  for (let round = 0; round < 8; round++) {
    const sums = centers.map(() => [0, 0, 0]);
    sizes = centers.map(() => 0);
    for (const p of pixels) {
      let nearest = 0;
      let best = Infinity;
      centers.forEach((center, i) => {
        const d = (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2 + (p[2] - center[2]) ** 2;
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      sizes[nearest]++;
      for (let c = 0; c < 3; c++) sums[nearest][c] += p[c];
    }
    const next = centers.map((center, i) => (sizes[i] ? sums[i].map((v) => v / sizes[i]) : center));
    const moved = next.some((center, i) => center.some((v, c) => Math.abs(v - centers[i][c]) > 0.5));
    centers = next;
    if (!moved) break;
  }
  return centers
    .map((center, i) => ({ color: center.map(Math.round), size: sizes[i] }))
    .filter(({ size }) => size > 0)
    .sort((a, b) => b.size - a.size)
    .map(({ color }) => color);
}

/**
 * `[r, g, b]` as `#rrggbb`.
 * @param {number[]} rgb
 * @returns {string}
 */
export const toHex = ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
