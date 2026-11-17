/** Deterministic foliage rustle and wooden gathering taps; no external audio license required. */
import {writeFileSync} from 'node:fs';
const rate=22050,duration=.55,count=Math.ceil(rate*duration),wav=Buffer.alloc(44+count*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(count*2,40);
let seed=7021,low=0;
for(let i=0;i<count;i++) {
  const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/2147483648-1;low+=.18*(noise-low);
  let value=0;
  for(const onset of [0,.18,.32]) {
    const age=t-onset;if(age<0)continue;
    value+=low*.5*Math.exp(-age*15)*Math.min(1,age*200);
    value+=Math.sin(2*Math.PI*640*age)*.15*Math.exp(-age*65);
  }
  const fade=Math.min(1,(duration-t)*60);
  wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value*fade))*32767),44+i*2);
}
writeFileSync(new URL('../public/assets/sounds/herbs.wav',import.meta.url),wav);
