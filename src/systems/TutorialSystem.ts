import { Season } from '../types';
import { getConfig } from '../data/ConfigLoader';

export type TutorialControl='hunt'|'build'|'clear'|'herbs'|'tech'|'shelter';
export interface SeasonBriefing { key:string; season:Season; year:number; title:string; text:string; controls:TutorialControl[] }
export interface TutorialState {
  version:2; enabled:boolean; acknowledged:string[];
  pending:{season:Season;year:number}|null;
  protectedHunterId:string|null; firstHuntUsed:boolean;
}
interface LegacyTutorialState {enabled?:boolean;stage?:string;protectedHunterId?:string|null}

/** First-year lessons gate simulation; skipping disables the remaining briefings in this save. */
export class TutorialSystem {
  private enabled=true;
  private acknowledged=new Set<string>();
  private pending:{season:Season;year:number}|null=null;
  private protectedHunterId:string|null=null;
  private firstHuntUsed=false;

  reset():void {this.enabled=true;this.acknowledged.clear();this.pending=null;this.protectedHunterId=null;this.firstHuntUsed=false;}
  enterSeason(season:Season,year:number):void {
    if(year>getConfig().tutorial.lastYear){this.enabled=false;this.pending=null;return;}
    if(this.enabled && !this.acknowledged.has(`${year}:${season}`))this.pending={season,year};
  }
  acknowledge():void {
    if(this.pending)this.acknowledged.add(`${this.pending.year}:${this.pending.season}`);
    this.pending=null;
  }
  skip():void {this.enabled=false;this.pending=null;}
  isAwaitingAcknowledgement():boolean {return this.enabled && this.pending!==null;}
  getBriefing():SeasonBriefing|null {
    if(!this.enabled || !this.pending)return null;
    const {season,year}=this.pending,wood=getConfig().heating.woodPerShelterPerWinter;
    const lessons:Record<Season,{title:string;text:string;controls:TutorialControl[]}>= {
      [Season.Spring]:{title:'Prepare your food supply',text:'Send villagers hunting or use Build to create a garden. Plant early, keep a farmer ready to harvest, and gather food before the winter frost.',controls:['hunt','build']},
      [Season.Summer]:{title:'Wood now, warmth later',text:`Chop trees for building materials and winter fuel. Keep ${wood} wood per home or guard tower for a full winter of heating. Once your protective ward fire is built, gather herbs to keep it burning.`,controls:['clear','herbs']},
      [Season.Autumn]:{title:'Prepare warm clothing',text:'Winter is close. Open Tech to unlock the Fur Workshop, then turn hunted pelts into warm coats. Until you can make coats, keep residents inside heated shelters during winter. Save food and firewood, too.',controls:['tech']},
      [Season.Winter]:{title:'Shelter before danger arrives',text:'Winter brings deadly cold and monsters hunting through the forest. Call Shelter to bring residents indoors. Homes and guard towers protect them from monsters, but need firewood to stay warm. Warm coats help residents survive outdoors.',controls:['shelter']},
    };
    return {key:`${year}:${season}`,season,year,...lessons[season]};
  }
  // Keep the gentle first expedition from the previous onboarding without retaining its objectives.
  onHuntStarted(id:string):void {if(this.enabled&&!this.firstHuntUsed){this.protectedHunterId=id;this.firstHuntUsed=true;}}
  isProtectedHunter(id:string):boolean {return this.protectedHunterId===id;}
  onHuntResolved(id:string):void {if(this.protectedHunterId===id)this.protectedHunterId=null;}
  serialize():TutorialState {return {version:2,enabled:this.enabled,acknowledged:[...this.acknowledged],pending:this.pending?{...this.pending}:null,protectedHunterId:this.protectedHunterId,firstHuntUsed:this.firstHuntUsed};}
  deserialize(data:TutorialState|LegacyTutorialState):void {
    this.reset();
    if('version' in data && data.version===2) {
      this.enabled=data.enabled;this.acknowledged=new Set(data.acknowledged??[]);
      this.pending=this.enabled&&data.pending?{...data.pending}:null;
      this.protectedHunterId=data.protectedHunterId;this.firstHuntUsed=data.firstHuntUsed;
    } else {
      const legacy=data as LegacyTutorialState;
      this.enabled=!!legacy.enabled&&legacy.stage!=='done';this.protectedHunterId=legacy.protectedHunterId??null;
      this.firstHuntUsed=!!this.protectedHunterId;
    }
    if(this.pending && this.pending.year>getConfig().tutorial.lastYear){this.enabled=false;this.pending=null;}
  }
}
