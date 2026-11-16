import { SeasonBriefing, TutorialControl } from '../systems/TutorialSystem';
import { iconMarkup, setButtonContent } from './icons';

const selectors:Record<TutorialControl,string>={hunt:'[data-global-hunt]',build:'[data-build-toggle]',clear:'[data-global-clear]',herbs:'[data-gather-herbs]',tech:'[data-tech-btn]',shelter:'[data-shelter-toggle]'};

/** Small modal lessons keep the named controls visible, but only Got it/Skip can release time. */
export class SeasonTutorial {
  private root=document.createElement('div');
  private dialog=document.createElement('section');
  private key='';
  private priorFocus:HTMLElement|null=null;
  private bars:HTMLElement[]=[];
  private previewHerbs=false;
  isHerbPreview():boolean {return this.previewHerbs;}
  constructor(private overlay:HTMLElement,private acknowledge:()=>void,private skip:()=>void) {
    this.root.id='season-tutorial';this.root.hidden=true;this.root.dataset.ui='true';
    this.dialog.setAttribute('role','dialog');this.dialog.setAttribute('aria-modal','true');
    this.dialog.setAttribute('aria-labelledby','season-tutorial-title');this.dialog.setAttribute('aria-describedby','season-tutorial-text');
    this.root.append(this.dialog);overlay.append(this.root);
    this.root.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}
      if(e.key!=='Tab')return;
      const buttons=[...this.dialog.querySelectorAll<HTMLButtonElement>('button')];
      if(e.shiftKey && document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus();}
      else if(!e.shiftKey && document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus();}
    });
  }
  update(briefing:SeasonBriefing|null):void {
    const key=briefing?.key??'';if(key===this.key)return;
    const priorTarget=this.overlay.querySelector<HTMLElement>('.tutorial-highlight');
    for(const element of this.overlay.querySelectorAll('.tutorial-highlight'))element.classList.remove('tutorial-highlight');
    for(const bar of this.bars){bar.classList.remove('tutorial-focus-bar');bar.inert=false;}this.bars=[];
    if(this.previewHerbs){const herbs=this.overlay.querySelector<HTMLElement>('[data-gather-herbs]')!;herbs.hidden=true;delete herbs.dataset.tutorialLocked;this.previewHerbs=false;}
    this.key=key;this.root.hidden=!briefing;
    if(!briefing) {
      const target=this.priorFocus?.isConnected&&this.priorFocus.offsetParent?this.priorFocus:priorTarget;
      target?.focus({preventScroll:true});return;
    }
    this.priorFocus=document.activeElement as HTMLElement;
    this.dialog.innerHTML=`<div class="season-tutorial-eyebrow">${iconMarkup('book')}<span>${briefing.season} · Year ${briefing.year}</span></div><h2 id="season-tutorial-title"></h2><p id="season-tutorial-text"></p><div class="season-tutorial-actions"></div>`;
    this.dialog.querySelector('h2')!.textContent=briefing.title;this.dialog.querySelector('p')!.textContent=briefing.text;
    const got=document.createElement('button');got.type='button';got.dataset.tutorialAcknowledge='true';got.className='icon-button';setButtonContent(got,'Got it','check');got.addEventListener('click',this.acknowledge);
    const skip=document.createElement('button');skip.type='button';skip.dataset.tutorialSkip='true';setButtonContent(skip,'Skip tutorial');skip.addEventListener('click',this.skip);
    this.dialog.querySelector('.season-tutorial-actions')!.append(got,skip);
    for(const control of briefing.controls) {
      const button=this.overlay.querySelector<HTMLElement>(selectors[control]);if(!button)continue;
      if(control==='herbs'&&button.hidden){button.hidden=false;button.dataset.tutorialLocked='true';this.previewHerbs=true;const note=document.createElement('small');note.className='season-tutorial-note';note.textContent='Herbs become available after you complete the protective ward fire.';this.dialog.querySelector('p')!.append(document.createElement('br'),note);}
      if(button.hidden)continue;
      button.classList.add('tutorial-highlight');
    }
    for(const bar of this.overlay.querySelectorAll<HTMLElement>('#game-top-bar,#game-bottom-bar')) {
      bar.classList.add('tutorial-focus-bar');bar.inert=true;this.bars.push(bar);
    }
    got.focus({preventScroll:true});
  }
}
