/** Original, transparent vector assets. Decorative images never replace text labels. */
export const iconNames = [
  'wood', 'food', 'fur', 'tools', 'villagers', 'comfort', 'research', 'book',
  'save', 'load', 'sound', 'muted', 'pause', 'axe', 'bow', 'wheat', 'hammer',
  'home', 'build', 'repair', 'work', 'move', 'resume', 'stop', 'restart',
  'release', 'gateOpen', 'gateClosed', 'demolish', 'warning', 'check', 'close', 'plus', 'minus',
] as const;
export type IconName = typeof iconNames[number];
const iconUrl = (name: IconName) => `${import.meta.env.BASE_URL}assets/ui/icons/${name}.svg`;
export function iconMarkup(name: IconName, small = false): string {
  return `<img class="game-icon${small ? ' game-icon--small' : ''}" data-ui-icon="${name}" src="${iconUrl(name)}" width="24" height="24" alt="" aria-hidden="true" draggable="false">`;
}
export function setButtonContent(button: HTMLElement, label: string, icon?: IconName): void {
  button.innerHTML = icon ? `${iconMarkup(icon)}<span class="button-label"></span>` : '<span class="button-label"></span>';
  button.querySelector('.button-label')!.textContent = label;
  button.classList.toggle('icon-button', !!icon);
  button.setAttribute('aria-label', label);
}
