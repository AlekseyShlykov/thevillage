/**
 * Sends analytics events to Google Apps Script (game-balance.json analytics.analyticsUrl).
 * Events: site_open, game_started, season_change (every season), game_over, demo_end, email_submitted.
 * Used for: Events sheet (all events) and Players sheet (aggregated per session_id).
 */
import { getConfig } from '../data/ConfigLoader';

export type AnalyticsEventType =
  | 'site_open'
  | 'game_started'
  | 'season_change'
  | 'game_over'
  | 'demo_end'
  | 'email_submitted';

export type Outcome = 'playing' | 'game_over' | 'demo_end';

export interface AnalyticsPayload {
  session_id: string;
  ts: string;
  event_type: AnalyticsEventType;
  season?: string;
  year?: number;
  play_time_seconds?: number;
  winters_survived?: number;
  buildings_count?: number;
  outcome?: Outcome;
  email_submitted?: boolean;
}

export class AnalyticsSystem {
  private sessionId = '';
  private sessionStartTime = 0;
  private url: string | null = null;

  constructor() {
    const url = getConfig().analytics?.analyticsUrl;
    if (url && url.includes('YOUR_ANALYTICS')) this.url = null;
    else this.url = url || null;
  }

  private ensureSessionId(): string {
    if (!this.sessionId) {
      this.sessionId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `s${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    return this.sessionId;
  }

  trackSiteOpen(): void {
    if (!this.url) return;
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'site_open',
    });
  }

  trackGameStart(): void {
    if (!this.url) return;
    this.sessionStartTime = Date.now();
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'game_started',
    });
  }

  getPlayTimeSeconds(): number {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  trackSeasonChange(data: {
    season: string;
    year: number;
    buildings_count: number;
    outcome?: Outcome;
  }): void {
    if (!this.url) return;
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'season_change',
      season: data.season,
      year: data.year,
      play_time_seconds: this.getPlayTimeSeconds(),
      winters_survived: data.year - 1,
      buildings_count: data.buildings_count,
      outcome: data.outcome ?? 'playing',
      email_submitted: false,
    });
  }

  trackGameOver(data: { season: string; year: number; buildings_count: number }): void {
    if (!this.url) return;
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'game_over',
      season: data.season,
      year: data.year,
      play_time_seconds: this.getPlayTimeSeconds(),
      winters_survived: data.year - 1,
      buildings_count: data.buildings_count,
      outcome: 'game_over',
      email_submitted: false,
    });
  }

  trackDemoEnd(data: { season: string; year: number; buildings_count: number }): void {
    if (!this.url) return;
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'demo_end',
      season: data.season,
      year: data.year,
      play_time_seconds: this.getPlayTimeSeconds(),
      winters_survived: data.year - 1,
      buildings_count: data.buildings_count,
      outcome: 'demo_end',
      email_submitted: false,
    });
  }

  trackEmailSubmitted(): void {
    if (!this.url) return;
    this.send({
      session_id: this.ensureSessionId(),
      ts: new Date().toISOString(),
      event_type: 'email_submitted',
      email_submitted: true,
    });
  }

  private send(payload: AnalyticsPayload): void {
    if (!this.url) return;
    // Use text/plain to avoid CORS preflight (OPTIONS); Apps Script only handles GET/POST.
    fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}
