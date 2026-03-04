export type RuleType =
	| 'budget_discipline'
	| 'daily_logging'
	| 'savings_milestone'
	| 'custom_challenge';
export type RewardStatus = 'pending' | 'approved' | 'rejected';

export interface PointRule {
	id: string;
	family_id: string;
	rule_type: RuleType;
	name: string;
	description: string | null;
	points_value: number;
	config: Record<string, unknown>;
	is_active: boolean;
	created_by: string;
	created_at: string;
}

export interface PointEvent {
	id: string;
	family_id: string;
	user_id: string;
	rule_id: string | null;
	points: number;
	description: string;
	month: string;
	created_at: string;
}

export interface Reward {
	id: string;
	family_id: string;
	name: string;
	description: string | null;
	point_cost: number;
	proposed_by: string;
	status: RewardStatus;
	approved_by: string | null;
	created_at: string;
}

export interface RewardRedemption {
	id: string;
	family_id: string;
	reward_id: string;
	redeemed_by: string;
	points_spent: number;
	redeemed_at: string;
	fulfilled: boolean;
}

export interface GamificationProfile {
	family_id: string;
	user_id: string;
	current_points: number;
	streak_days: number;
	last_log_date: string | null;
}

export interface LeaderboardEntry {
	user_id: string;
	display_name: string;
	current_points: number;
	streak_days: number;
	points_this_month: number;
}
