import { Camera } from '../core/Camera';
import { BuildingInstance, Season } from '../types';
import { footprint } from './IsometricArt';
import { AssetLoader } from './AssetLoader';
import { moatConnectionMask, moatDirections, moatSprite } from '../world/MoatConnections';

const tilePixels=128;

/** Painted modular terrain: rotate before projecting, so bends stay on the simulation grid. */
export class MoatArt {
  private tiles=new Map<string,HTMLCanvasElement>();
  private atlas:HTMLImageElement|null=null;
  constructor(private camera:Camera,private assets:AssetLoader) {}

  draw(ctx:CanvasRenderingContext2D,b:BuildingInstance,all:BuildingInstance[],season:Season):void {
    const atlas=this.assets.getMoatAtlas();
    if(this.atlas!==atlas) {this.atlas=atlas;this.tiles.clear();}
    const mask=moatConnectionMask(b,all),key=`${mask}:${season}:${b.built}`;
    let tile=this.tiles.get(key);
    if(!tile) {tile=this.makeTile(mask,season,b.built,atlas);this.tiles.set(key,tile);}
    const pts=footprint(this.camera,b.tileX,b.tileY),p=pts[0];
    ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.transform((pts[1].x-p.x)/tilePixels,(pts[1].y-p.y)/tilePixels,
      (pts[3].x-p.x)/tilePixels,(pts[3].y-p.y)/tilePixels,p.x,p.y);
    ctx.drawImage(tile,-1,-1);ctx.restore();
  }

  private makeTile(mask:number,season:Season,built:boolean,atlas:HTMLImageElement|null):HTMLCanvasElement {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=tilePixels;
    const ctx=canvas.getContext('2d')!,{frame,turns}=moatSprite(mask);
    const cold=season===Season.Winter;
    if(atlas) {
      const cw=atlas.width/3,ch=atlas.height/2,inset=.045;
      ctx.filter=!built?'sepia(1) saturate(.65)':cold?'saturate(.48) brightness(1.25)':'none';
      ctx.save();ctx.translate(tilePixels/2,tilePixels/2);ctx.rotate(turns*Math.PI/2);
      ctx.drawImage(atlas,(frame%3+inset)*cw,(Math.floor(frame/3)+inset)*ch,cw*(1-inset*2),ch*(1-inset*2),
        -tilePixels/2,-tilePixels/2,tilePixels,tilePixels);ctx.restore();
      // Sample the same painted straight section at every open mouth. This removes
      // generated cell margins and keeps bank/water widths identical across joins.
      const collar=document.createElement('canvas');collar.width=tilePixels;collar.height=20;
      const c=collar.getContext('2d')!;c.filter=ctx.filter;
      c.drawImage(atlas,(2+inset)*cw,ch*.42,cw*(1-inset*2),ch*.16,0,0,tilePixels,20);
      c.globalCompositeOperation='destination-in';const fade=c.createLinearGradient(0,0,0,20);
      fade.addColorStop(0,'#fff');fade.addColorStop(.45,'#fff');fade.addColorStop(1,'#fff0');
      c.fillStyle=fade;c.fillRect(0,0,tilePixels,20);ctx.filter='none';
      for(let i=0;i<4;i++)if(mask&(1<<i)) {
        ctx.save();ctx.translate(tilePixels/2,tilePixels/2);ctx.rotate(i*Math.PI/2);
        ctx.drawImage(collar,-tilePixels/2,-tilePixels/2);ctx.restore();
      }
    } else this.fallback(ctx,mask,cold,built);
    // Extruded edge pixels prevent hairline grass seams at fractional camera zooms.
    const padded=document.createElement('canvas');padded.width=padded.height=tilePixels+2;
    const p=padded.getContext('2d')!;p.drawImage(canvas,1,1);
    p.drawImage(canvas,0,0,tilePixels,1,1,0,tilePixels,1);
    p.drawImage(canvas,0,tilePixels-1,tilePixels,1,1,tilePixels+1,tilePixels,1);
    p.drawImage(canvas,0,0,1,tilePixels,0,1,1,tilePixels);
    p.drawImage(canvas,tilePixels-1,0,1,tilePixels,tilePixels+1,1,1,tilePixels);
    return padded;
  }

  private fallback(ctx:CanvasRenderingContext2D,mask:number,cold:boolean,built:boolean):void {
    const path=new Path2D(),c=tilePixels/2;
    if(!mask)path.roundRect(c-25,c-25,50,50,18);
    else for(let i=0;i<4;i++)if(mask&(1<<i)) {
      path.moveTo(c,c);path.lineTo(c+moatDirections[i][0]*c,c+moatDirections[i][1]*c);
    }
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const [width,color]of [[104,cold?'#929a83':'#98754c'],[80,'#493728'],[56,built?(cold?'#54706a':'#244e48'):'#574332']] as const) {
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke(path);
    }
  }
}
