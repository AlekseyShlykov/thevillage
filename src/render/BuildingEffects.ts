/** Smoke is a separate time-based effect; empty houses render none at all. */
export function chimneySmoke(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number, mouth = {x: -.207, y: -.713}): void {
  const mouthX = x + size * mouth.x, mouthY = y + size * mouth.y;
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const age = (time * .22 + i / 6) % 1, radius = size * (.009 + age * .022);
    const px = mouthX + Math.sin(age * 3 + time * .35) * age * size * .035 + age * size * .055;
    const py = mouthY - age * size * .18;
    const gradient = ctx.createRadialGradient(px,py,0,px,py,radius);
    gradient.addColorStop(0, `rgba(242,235,209,${(1-age)*.85})`); gradient.addColorStop(.65, `rgba(228,226,205,${(1-age)*.6})`); gradient.addColorStop(1,'rgba(214,215,192,0)');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(px,py,radius,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
