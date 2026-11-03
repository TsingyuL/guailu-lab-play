const INK = '#172623';
const hash = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };

// 笔迹固定在物体自身坐标，不在每帧随机抖动；运动来自物体的关节和风。
function stroke(ctx, points, color = INK, width = 2, closed = false, seed = 3) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  const count = points.length + (closed ? 1 : 0);
  for (let i = 1; i < count; i++) {
    const a = points[(i - 1) % points.length], b = points[i % points.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
    const wobble = Math.min(.4, length * .008) * (hash(i + seed) - .5) * 2;
    ctx.quadraticCurveTo((a[0] + b[0]) / 2 - dy / length * wobble, (a[1] + b[1]) / 2 + dx / length * wobble, b[0], b[1]);
  }
  if (closed) ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

function paper(platform) {
  if (!platform.makeCanvas) return null;
  const canvas = platform.makeCanvas(256, 256), c = canvas.getContext('2d');
  // 离屏生成一次纸纤维，渲染时只平铺；避免数千个逐帧小笔触。
  for (let i = 0; i < 1400; i++) {
    const x = hash(i * 2) * 256, y = hash(i * 2 + 1) * 256;
    c.fillStyle = i % 3 ? 'rgba(54,36,67,.055)' : 'rgba(251,240,201,.18)';
    c.fillRect(x, y, .5 + hash(i + 900) * 1.2, .5 + hash(i + 30));
  }
  for (let i = 0; i < 40; i++) {
    const x = hash(i + 7000) * 256, y = hash(i + 8000) * 256;
    stroke(c, [[x, y], [x + hash(i) * 5 + 2, y - 1]], 'rgba(94,77,43,.07)', .5);
  }
  return canvas;
}

module.exports = { INK, hash, stroke, paper };
