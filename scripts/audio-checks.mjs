import assert from 'node:assert/strict';

/** Offline audio audit; never connects decoded samples to an audio destination.
 * ITU-R BS.1770 stereo K weighting at 48 kHz; 400 ms blocks, 75% overlap,
 * -70 LUFS absolute gate and -10 LU relative gate.
 * https://www.itu.int/rec/R-REC-BS.1770/en
 */
function measureAudio(buffer) {
  const rate = buffer.sampleRate;
  if (rate !== 48000) throw Error('Loudness filter requires 48 kHz');
  const step = 4800, bins = new Float64Array(Math.floor(buffer.length / step));
  // A mono media source feeds both speakers during stereo playback.
  const outputWeight = buffer.numberOfChannels === 1 ? 2 : 1;
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, h1 = 0, h2 = 0, z1 = 0, z2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      peak = Math.max(peak, Math.abs(x));
      const y = 1.53512485958697*x - 2.69169618940638*x1 + 1.19839281085285*x2
        + 1.69065929318241*y1 - .73248077421585*y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const z = y - 2*h1 + h2 + 1.99004745483398*z1 - .99007225036621*z2;
      h2 = h1; h1 = y; z2 = z1; z1 = z;
      const bin = Math.floor(i / step);
      if (bin < bins.length) bins[bin] += outputWeight*z*z / step;
    }
  }
  const loudness = power => -.691 + 10*Math.log10(Math.max(power, 1e-20));
  const blocks = [];
  for (let i = 0; i + 3 < bins.length; i++) blocks.push((bins[i]+bins[i+1]+bins[i+2]+bins[i+3])/4);
  const absolute = blocks.filter(power => loudness(power) > -70);
  assertFinite(absolute.length);
  const mean = values => values.reduce((sum, n) => sum+n, 0)/values.length;
  const gate = Math.max(-70, loudness(mean(absolute))-10);
  const gated = absolute.filter(power => loudness(power) > gate);
  return {lufs:loudness(mean(gated)), peakDbFS:20*Math.log10(peak), duration:buffer.duration};
  function assertFinite(count) { if (!count) throw Error('Audio contains no measurable signal'); }
}

export async function runAudioChecks({check, ev}) {
  await check('blocked seasonal autoplay resumes once on interaction and respects mute', async () => {
    const result = await ev(`(async () => {
      const sound = new g.soundManager.constructor(), original = HTMLMediaElement.prototype.play;
      let calls = 0, blocked = true;
      HTMLMediaElement.prototype.play = function() {
        this.muted = true;
        calls++;
        return blocked ? Promise.reject(new DOMException('User interaction required', 'NotAllowedError')) : Promise.resolve();
      };
      try {
        sound.playSeason('spring'); await Promise.resolve();
        blocked = false;
        window.dispatchEvent(new Event('pointerup'));
        document.body.dispatchEvent(new KeyboardEvent('keydown', {bubbles:true}));
        const pointerCalls = calls;
        blocked = true;
        sound.playSeason('summer'); await Promise.resolve();
        blocked = false;
        document.body.dispatchEvent(new KeyboardEvent('keydown', {bubbles:true}));
        window.dispatchEvent(new Event('pointerup'));
        const keyboardCalls = calls;
        blocked = true;
        sound.playSeason('autumn'); await Promise.resolve();
        sound.toggleSound();
        window.dispatchEvent(new Event('pointerup'));
        return {pointerCalls, keyboardCalls, mutedCalls:calls};
      } finally {
        if (sound.isSoundEnabled()) sound.toggleSound();
        HTMLMediaElement.prototype.play = original;
      }
    })()`);
    assert.deepEqual(result, {pointerCalls:2, keyboardCalls:4, mutedCalls:5});
    return result;
  });
  let clips;
  await check('all seasonal ambience and action cues use configured gains and respect mute', async () => {
    clips = await ev(`(() => {
      const sound = new g.soundManager.constructor(), original = HTMLMediaElement.prototype.play, calls = [];
      HTMLMediaElement.prototype.play = function() {
        this.muted = true;
        calls.push({file:this.src.split('/').pop(), src:this.src, volume:this.volume, loop:this.loop});
        return Promise.resolve();
      };
      const methods = ['playHorde','playHordeAttack','playWood','playBuilding','playDead','playHunt','playHerbs','playShelter','playLeaveShelter','playHungry'];
      try {
        for (const season of ['spring','summer','autumn','winter']) sound.playSeason(season);
        for (const method of methods) sound[method]();
        sound.stopHordeLoop(); sound.startHordeLoop();
        const count = calls.length;
        sound.toggleSound();
        for (const season of ['spring','summer','autumn','winter']) sound.playSeason(season);
        for (const method of methods) sound[method]();
        sound.startHordeLoop();
        if (calls.length !== count) throw Error('Muted sound still started playback');
        return calls;
      } finally {
        sound.stopHordeLoop(); sound.stopBuildingSound(); sound.stopWood();
        HTMLMediaElement.prototype.play = original;
      }
    })()`);
    assert.equal(clips.length, 15);
    assert(clips.slice(0,4).every(c => c.loop && c.file.endsWith('.m4a')));
    assert(clips.every(c => c.volume > 0 && c.volume <= 1));
    return {cues:14, mutedNewPlaybacks:0};
  });
  await check('decoded game ambience and effects have consistent playback loudness', async () => {
    assert(clips, 'Playback audit must succeed first');
    const measurements = [];
    for (const clip of clips.slice(0,14)) {
      const result = await ev(`(async () => {
        const decoder = new OfflineAudioContext(2, 1, 48000);
        const response = await fetch(${JSON.stringify(clip.src)});
        if (!response.ok) throw Error('Missing audio: '+response.status);
        const decoded = await decoder.decodeAudioData(await response.arrayBuffer());
        return (${measureAudio.toString()})(decoded);
      })()`);
      const gainDb = 20*Math.log10(clip.volume);
      measurements.push({file:clip.file, lufs:result.lufs+gainDb, peakDbFS:result.peakDbFS+gainDb, duration:result.duration});
    }
    const seasons = measurements.slice(0,4).map(c => c.lufs);
    assert(Math.max(...seasons)-Math.min(...seasons) < .8, JSON.stringify(measurements));
    assert(seasons.every(level => Math.abs(level+30) < .6));
    assert(measurements.slice(4).every(c => c.lufs > -29.6 && c.lufs < -27.3), JSON.stringify(measurements));
    assert(measurements.every(c => c.peakDbFS < -3), JSON.stringify(measurements));
    return measurements.map(c => ({...c, lufs:+c.lufs.toFixed(2), peakDbFS:+c.peakDbFS.toFixed(2)}));
  });
}
