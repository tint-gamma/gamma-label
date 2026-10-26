/* คำนวณการจัดเรียงกล่องบนพาเลทของตู้ฉายรังสี
   พาเลท กว้าง 55 × ยาว 120 ซม. วางกล่องสูงได้ไม่เกิน 120 ซม. (ทุกค่าภายในเป็นมิลลิเมตร)
   ใน 1 ชั้น ใช้การตัดแบ่งพื้นที่แบบ guillotine (หาค่าดีที่สุดด้วย dynamic programming บนจุด raster)
   จึงผสมกล่องแนวตั้งและแนวนอนในชั้นเดียวกันได้ ทุกชั้นจัดเหมือนกัน */
(function (root) {
  'use strict';
  const PALLET = { L: 1200, W: 550, H: 1200 };

  // ทุกค่าที่เกิดจาก i*a + j*b ไม่เกิน limit (จุดที่ควรตัดแบ่งพื้นที่)
  function raster(limit, a, b) {
    const s = new Set([0]);
    for (let i = 0; i * a <= limit; i++) for (let j = 0; i * a + j * b <= limit; j++) s.add(i * a + j * b);
    return Array.from(s).sort((p, q) => p - q);
  }
  function floorIdx(arr, v) {            // index ของค่าที่มากที่สุดซึ่งไม่เกิน v
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; }
    return lo;
  }

  // จำนวนกล่องสูงสุดใน 1 ชั้น: พื้นที่ L × W, กล่องฐาน a × b หมุน 90° ได้
  function pack2D(L, W, a, b) {
    const Rx = raster(L, a, b), Ry = raster(W, a, b), nx = Rx.length, ny = Ry.length;
    const val = new Int32Array(nx * ny), how = new Array(nx * ny);
    for (let i = 0; i < nx; i++) {
      const X = Rx[i];
      for (let j = 0; j < ny; j++) {
        const Y = Ry[j], id = i * ny + j;
        const g1 = Math.floor(X / a) * Math.floor(Y / b), g2 = Math.floor(X / b) * Math.floor(Y / a);
        let best = Math.max(g1, g2), h = { t: 'g', r: g2 > g1 };
        for (let k = 1; k < nx && Rx[k] <= X / 2; k++) {
          const rest = floorIdx(Rx, X - Rx[k]);
          const v = val[k * ny + j] + val[rest * ny + j];
          if (v > best) { best = v; h = { t: 'v', k: k, rest: rest }; }
        }
        for (let k = 1; k < ny && Ry[k] <= Y / 2; k++) {
          const rest = floorIdx(Ry, Y - Ry[k]);
          const v = val[i * ny + k] + val[i * ny + rest];
          if (v > best) { best = v; h = { t: 'h', k: k, rest: rest }; }
        }
        val[id] = best; how[id] = h;
      }
    }
    const rects = [];
    (function build(i, j, ox, oy) {
      const h = how[i * ny + j], X = Rx[i], Y = Ry[j];
      if (h.t === 'g') {
        const dx = h.r ? b : a, dy = h.r ? a : b;
        for (let p = 0; p < Math.floor(X / dx); p++) for (let q = 0; q < Math.floor(Y / dy); q++)
          rects.push({ x: ox + p * dx, y: oy + q * dy, dx: dx, dy: dy, rot: h.r });
      } else if (h.t === 'v') { build(h.k, j, ox, oy); build(h.rest, j, ox + Rx[h.k], oy); }
      else { build(i, h.k, ox, oy); build(i, h.rest, ox, oy + Ry[h.k]); }
    })(floorIdx(Rx, L), floorIdx(Ry, W), 0, 0);
    return { count: rects.length, rects: rects };
  }

  // box = [กว้าง, ยาว, สูง] หน่วย มม.  tip = ยอมวางตะแคงกล่องได้
  function plan(box, opts) {
    const o = opts || {}, P = o.pallet || PALLET;
    const [w, l, h] = box.map(v => Math.round(v));
    const cands = [{ foot: [w, l], h: h, upright: true }];
    if (o.tip) cands.push({ foot: [l, h], h: w, upright: false }, { foot: [w, h], h: l, upright: false });
    let best = null;
    cands.forEach(c => {
      if (c.h > P.H) return;
      const fits = (c.foot[0] <= P.L && c.foot[1] <= P.W) || (c.foot[1] <= P.L && c.foot[0] <= P.W);
      if (!fits) return;
      const layer = pack2D(P.L, P.W, c.foot[0], c.foot[1]);
      if (!layer.count) return;
      const layers = Math.floor(P.H / c.h), total = layer.count * layers;
      if (!best || total > best.total) best = Object.assign({}, c, { perLayer: layer.count, layers: layers, total: total, rects: layer.rects });
    });
    if (!best) return null;
    // จัดให้อยู่กลางพาเลท
    const ux = Math.max.apply(null, best.rects.map(r => r.x + r.dx)), uy = Math.max.apply(null, best.rects.map(r => r.y + r.dy));
    const ox = (P.L - ux) / 2, oy = (P.W - uy) / 2;
    best.rects.forEach(r => { r.x += ox; r.y += oy; });
    best.usedL = ux; best.usedW = uy; best.stackH = best.layers * best.h;
    best.util = best.total * w * l * h / (P.L * P.W * P.H);
    best.pallet = P;
    return best;
  }

  const api = { plan: plan, pack2D: pack2D, PALLET: PALLET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PalletCalc = api;
})(this);
