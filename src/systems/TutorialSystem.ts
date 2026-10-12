import { Season } from '../types';

export type TutorialStage =
  | 'markForest'
  | 'hunt'
  | 'placeHut'
  | 'buildHut'
  | 'unlockGarden'
  | 'placeGarden'
  | 'buildGarden'
  | 'assignGarden'
  | 'stockpileFood'
  | 'waitForAutumn'
  | 'shelter'
  | 'done';

export interface TutorialObjective {
  title: string;
  text: string;
  step: number;
  totalSteps: number;
}

export interface TutorialState {
  stage: TutorialStage;
  trackedBuildingId: string | null;
  clearingMarks: number;
  protectedHunterId: string | null;
  enabled: boolean;
}

const TOTAL_STEPS = 9;

/**
 * A non-blocking, action-driven first-year tutorial.
 * It advances only after the player performs the requested action, so reading
 * speed and game speed do not cause instructions to disappear.
 */
export class TutorialSystem {
  private stage: TutorialStage = 'markForest';
  private trackedBuildingId: string | null = null;
  private clearingMarks = 0;
  private protectedHunterId: string | null = null;
  private enabled = true;

  reset(): void {
    this.stage = 'markForest';
    this.trackedBuildingId = null;
    this.clearingMarks = 0;
    this.protectedHunterId = null;
    this.enabled = true;
  }

  skip(): void {
    this.stage = 'done';
    this.trackedBuildingId = null;
    this.enabled = false;
  }

  onForestMarked(): void {
    if (this.stage !== 'markForest') return;
    this.clearingMarks++;
    if (this.clearingMarks >= 4) this.advance('hunt');
  }

  onHuntStarted(villagerId: string): void {
    if (this.stage === 'hunt') {
      this.protectedHunterId = villagerId;
      this.advance('placeHut');
    }
  }

  isProtectedHunter(villagerId: string): boolean {
    return this.protectedHunterId === villagerId;
  }

  onHuntResolved(villagerId: string): void {
    if (this.protectedHunterId === villagerId) this.protectedHunterId = null;
  }

  onBuildingPlaced(buildingId: string, configId: string): void {
    if (this.stage === 'placeHut' && configId === 'hut') {
      this.trackedBuildingId = buildingId;
      this.stage = 'buildHut';
    } else if (this.stage === 'placeGarden' && configId === 'garden') {
      this.trackedBuildingId = buildingId;
      this.stage = 'buildGarden';
    }
  }

  onBuildingCompleted(buildingId: string, configId: string): void {
    if (buildingId !== this.trackedBuildingId) return;
    if (this.stage === 'buildHut' && configId === 'hut') {
      this.advance('unlockGarden');
    } else if (this.stage === 'buildGarden' && configId === 'garden') {
      this.advance('assignGarden');
    }
  }

  onTechnologyUnlocked(technologyId: string): void {
    if (this.stage === 'unlockGarden' && technologyId === 'garden') {
      this.advance('placeGarden');
    }
  }

  onGardenWorkerAssigned(): void {
    if (this.stage === 'assignGarden') this.advance('stockpileFood');
  }

  onShelterCalled(): void {
    if (this.stage === 'shelter') this.advance('done');
  }

  update(food: number, season: Season, year: number): void {
    if (!this.enabled || this.stage === 'done') return;

    if (this.stage === 'stockpileFood' && food >= 20) {
      this.advance('waitForAutumn');
    }
    if (this.stage === 'waitForAutumn' && (season === Season.Autumn || season === Season.Winter)) {
      this.advance('shelter');
    }

    // Do not let an unfinished helper linger into later years.
    if (year > 1) this.skip();
  }

  getObjective(food: number): TutorialObjective | null {
    if (!this.enabled || this.stage === 'done') return null;

    switch (this.stage) {
      case 'markForest':
        return this.objective(1, 'Make room', `Press “🪓 Clear” and mark a 2×2 area beside the clearing (${this.clearingMarks}/4 tiles).`);
      case 'hunt':
        return this.objective(2, 'Find food', 'Press “🦌 Hunt” to send one free villager into the forest.');
      case 'placeHut':
        return this.objective(3, 'Plan a new hut', 'Open “🏗 Build”, choose Hut, and place it on cleared ground.');
      case 'buildHut':
        return this.objective(3, 'Construction', 'A free villager is heading to the site automatically. Wait for the hut to finish.');
      case 'unlockGarden':
        return this.objective(4, 'Unlock food production', 'Open “📖 Tech” and unlock Garden with the technology point from the new hut.');
      case 'placeGarden':
        return this.objective(5, 'Place a garden', 'Open “🏗 Build”, choose Garden, and place it on cleared ground.');
      case 'buildGarden':
        return this.objective(5, 'Build the garden', 'A free builder will construct the garden automatically.');
      case 'assignGarden':
        return this.objective(6, 'Assign a farmer', 'Select a villager, then the finished garden, and choose “👷 Work here” or “🌾 Grow food”.');
      case 'stockpileFood':
        return this.objective(7, 'Prepare supplies', `Reach 20 food before winter. Current food: ${Math.floor(food)}/20.`);
      case 'waitForAutumn':
        return this.objective(8, 'Keep preparing', 'Your basic food reserve is ready. Keep gathering resources until autumn.');
      case 'shelter':
        return this.objective(9, 'Take shelter', 'Autumn is here. Before the horde arrives, press “🏠 To shelter”.');
      default:
        return null;
    }
  }

  serialize(): TutorialState {
    return {
      stage: this.stage,
      trackedBuildingId: this.trackedBuildingId,
      clearingMarks: this.clearingMarks,
      protectedHunterId: this.protectedHunterId,
      enabled: this.enabled,
    };
  }

  deserialize(data: TutorialState): void {
    this.stage = data.stage ?? 'done';
    this.trackedBuildingId = data.trackedBuildingId ?? null;
    this.clearingMarks = data.clearingMarks ?? 0;
    this.protectedHunterId = data.protectedHunterId ?? null;
    this.enabled = data.enabled ?? false;
  }

  private advance(next: TutorialStage): void {
    this.stage = next;
    this.trackedBuildingId = null;
    if (next === 'done') this.enabled = false;
  }

  private objective(step: number, title: string, text: string): TutorialObjective {
    return { title, text, step, totalSteps: TOTAL_STEPS };
  }
}
