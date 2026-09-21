export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ForgotPasswordResponse {
  message: string;
  // Only populated in dev mode when no email provider is configured —
  // never present once real email sending is set up server-side.
  dev_reset_link?: string | null;
}

export interface Profile {
  id: number;
  user_id: number;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_preference: string | null;
  daily_step_goal: number;
  weekly_active_minutes_goal: number;
  daily_water_goal_ml: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateInput {
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_preference?: string | null;
  daily_step_goal?: number;
  weekly_active_minutes_goal?: number;
  daily_water_goal_ml?: number;
}

export interface ApiError {
  detail: string;
}

export interface TodayActivity {
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
  step_goal: number;
  goal_progress_percent: number;
  has_activity: boolean;
}

export interface ActivityRecord {
  id: number;
  user_id: number;
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
  activity_type: string | null;
  data_source: string;
  created_at: string;
  updated_at: string;
}

export interface DailyStepsPoint {
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
}

export interface AddActivityInput {
  steps: number;
  distance_km: number;
  active_minutes: number;
  activity_type?: string | null;
}

// --- Water (Phase 4) ---

export interface TodayWater {
  date: string;
  total_ml: number;
  goal_ml: number;
  progress_percent: number;
  recommended_goal_ml: number | null;
  is_using_recommended_goal: boolean;
}

export interface WaterRecord {
  id: number;
  user_id: number;
  consumed_at: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
}

export interface DailyWaterPoint {
  date: string;
  amount_ml: number;
}

// --- Unified Goals (Phase 4) ---

export type GoalKey = "daily_steps" | "weekly_active_minutes" | "daily_water_ml";

export type GoalCategory = "activity" | "hydration";

export interface GoalProgress {
  key: GoalKey;
  label: string;
  target: number;
  unit: string;
  category: GoalCategory;
  current: number;
  progress_percent: number;
}

// --- Analytics (Phase 4) ---

export interface ActivityAnalytics {
  average_daily_steps: number;
  total_weekly_steps: number;
  average_active_minutes: number;
  best_day_date: string | null;
  best_day_steps: number | null;
  goal_completion_percent: number;
}

export interface WaterAnalytics {
  average_daily_ml: number;
  best_day_date: string | null;
  best_day_ml: number | null;
  average_goal_completion_percent: number;
  days_goal_reached: number;
}

export interface ConsistencyScore {
  score_percent: number;
  components: Record<string, number>;
  formula: string;
}

export interface AnalyticsSummary {
  activity: ActivityAnalytics;
  water: WaterAnalytics;
  consistency: ConsistencyScore;
}

// --- History (Phase 4) ---

export interface HistoryDayEntry {
  date: string;
  steps: number;
  distance_km: number;
  active_minutes: number;
  water_ml: number;
}

export type HistoryRangePreset = "today" | "last_7_days" | "last_30_days";

// --- AI Insights & Assistant (Phase 5) ---

export interface DailyInsight {
  insight_type: "daily";
  generated_at: string;
  content: string;
  source: string;
  disclaimer: string;
}

export interface WeeklyInsight {
  insight_type: "weekly";
  generated_at: string;
  content: string;
  source: string;
  disclaimer: string;
}

export interface AIChatResponse {
  question: string;
  answer: string;
  source: string;
  disclaimer: string;
}

export interface AIInsightHistoryItem {
  id: number;
  insight_type: string;
  generated_at: string;
  content: string;
  source: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

export interface StreakCounts {
  current: number;
  best: number;
}

/** Mirrors backend/app/schemas/streak.py StreaksResponse — see
 * backend/app/services/streak_service.py for the exact rule each streak
 * uses. Web and mobile both read this same endpoint so streak numbers
 * can never diverge between them. */
export interface Streaks {
  overall: StreakCounts;
  steps: StreakCounts;
  hydration: StreakCounts;
}

export interface StreakHistoryDay {
  date: string;
  steps: number;
  water_ml: number;
  step_goal_met: boolean;
  hydration_goal_met: boolean;
  overall_goal_met: boolean;
}
