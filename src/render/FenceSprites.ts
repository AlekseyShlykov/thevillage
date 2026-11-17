import { AssetLoader } from './AssetLoader';
import { Camera } from '../core/Camera';
import { Season } from '../types';
import { Point } from './IsometricArt';

interface Bounds {x:number;y:number;width:number;height:number}

/** Project painted front-facing panels onto each connected half of a fence tile.
 * Posts remain upright; both ground endpoints match the existing grid joins. */
export class FenceSprites {
  private bounds = new WeakMap<HTMLImageElement,Bounds>();
  constructor(private assets: AssetLoader, private camera: Camera) {}

  private trim(image: HTMLImageElement): Bounds {
    const cached=this.bounds.get(image);if(cached)return cached;
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,c.width,c.height).data;
    let left=c.width,top=c.height,right=0,bottom=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>16){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    const box=left<=right?{x:left,y:top,width:right-left+1,height:bottom-top+1}:{x:0,y:0,width:c.width,height:c.height};
    this.bounds.set(image,box);return box;
  }

  panel(ctx:CanvasRenderingContext2D,a:Point,b:Point,height:number,season:Season):boolean {
    const image=this.assets.getReinforcedFence?.(season);if(!image)return false;
    const box=this.trim(image);
    ctx.save();ctx.transform((b.x-a.x)/box.width,(b.y-a.y)/box.width,0,height*this.camera.zoom/box.height,a.x,a.y);
    ctx.drawImage(image,box.x,box.y,box.width,box.height,0,-box.height,box.width,box.height);ctx.restore();return true;
  }

  post(ctx:CanvasRenderingContext2D,p:Point,height:number,width:number,season:Season):boolean {
    const image=this.assets.getReinforcedFence?.(season);if(!image)return false;
    const box=this.trim(image),z=this.camera.zoom;
    ctx.drawImage(image,box.x+box.width*.43,box.y,box.width*.14,box.height,p.x-width*z/2,p.y-height*z,width*z,height*z);
    return true;
  }

  gate(ctx:CanvasRenderingContext2D,a:Point,b:Point,season:Season,open:boolean,reinforced:boolean):boolean {
    const image=this.assets.getPalisadeGate?.(season,open);if(!image)return false;
    // All four variants share these post-foot anchors; only the leaves and snow change.
    const ax=image.width*.165,ay=image.height*.71,bx=image.width*.82,by=image.height*.905;
    const sy=(reinforced?49:42)*this.camera.zoom/(image.height*.6);
    const sx=(b.x-a.x)/(bx-ax),shear=(b.y-a.y-sy*(by-ay))/(bx-ax);
    ctx.save();ctx.transform(sx,shear,0,sy,a.x-sx*ax,a.y-shear*ax-sy*ay);
    ctx.drawImage(image,0,0);ctx.restore();return true;
  }
}
