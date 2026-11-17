import { Camera } from '../core/Camera';
import { getConfig } from '../data/ConfigLoader';
import { TowerShot } from '../systems/TowerCombatSystem';
import { AssetLoader } from './AssetLoader';

/** Arrow tips follow their flight path; rotation follows the tangent of its shallow arc. */
export class ProjectileArt {
  private image: HTMLImageElement | null = null;
  private bounds = {x:0,y:0,width:1,height:1};
  constructor(private camera: Camera, private assets: AssetLoader) {}

  draw(ctx: CanvasRenderingContext2D, shot: TowerShot): void {
    const cfg=getConfig(),z=this.camera.zoom,t=Math.max(0,Math.min(1,shot.age/cfg.rendering.towerShotSeconds));
    const a=this.camera.worldToScreen((shot.x+.5)*cfg.map.tileSize,(shot.y+.5)*cfg.map.tileSize);
    const b=this.camera.worldToScreen((shot.targetX+.5)*cfg.map.tileSize,(shot.targetY+.5)*cfg.map.tileSize);
    a.y-=95*z;b.y-=16*z;
    const dx=b.x-a.x,dy=b.y-a.y,arc=cfg.rendering.towerArrowArc*z;
    const x=a.x+dx*t,y=a.y+dy*t-Math.sin(Math.PI*t)*arc;
    const angle=Math.atan2(dy-Math.cos(Math.PI*t)*Math.PI*arc,dx);
    const image=this.assets.getArrow?.()??null;
    if(image!==this.image) {this.image=image;if(image)this.bounds=this.visibleBounds(image);}
    const length=cfg.rendering.towerArrowLength*z;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=true;
    if(image) {
      const r=this.bounds,height=length*r.height/r.width;
      ctx.drawImage(image,r.x,r.y,r.width,r.height,-length,-height/2,length,height);
    } else {
      ctx.strokeStyle='#d9b775';ctx.lineWidth=1.5*z;ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(0,0);ctx.stroke();
      ctx.fillStyle='#bec2b1';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-6*z,-2.5*z);ctx.lineTo(-6*z,2.5*z);ctx.fill();
      ctx.strokeStyle='#ede1be';ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(-length+5*z,-3*z);ctx.moveTo(-length,0);ctx.lineTo(-length+5*z,3*z);ctx.stroke();
    }
    ctx.restore();
  }

  /** Trim only transparent padding at render time; the generated PNG remains unmodified. */
  private visibleBounds(image:HTMLImageElement) {
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    return right<left?{x:0,y:0,width:canvas.width,height:canvas.height}:{x:left,y:top,width:right-left+1,height:bottom-top+1};
  }
}
