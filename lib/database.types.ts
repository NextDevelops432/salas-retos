export type TaskCompletionStatus = 'pending' | 'approved' | 'rejected';
export type RedemptionStatus = 'pending' | 'approved' | 'rejected';
export type RoomRole = 'owner' | 'member';

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
};

export type Task = {
  id: string;
  room_id: string;
  title: string;
  description: string;
  points: number;
  due_at: string | null;
  requires_approval: boolean;
  is_recurring: boolean;
  recurrence_hours: number | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
};

export type TaskCompletion = {
  id: string;
  task_id: string;
  room_id: string;
  user_id: string;
  photo_url: string | null;
  note: string | null;
  status: TaskCompletionStatus;
  points_awarded: number;
  completed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type Reward = {
  id: string;
  room_id: string;
  title: string;
  description: string;
  cost_points: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

export type RewardRedemption = {
  id: string;
  reward_id: string;
  room_id: string;
  user_id: string;
  points_spent: number;
  status: RedemptionStatus;
  redeemed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type RoomMemberPoints = {
  room_id: string;
  user_id: string;
  points_balance: number;
  points_earned: number;
  points_spent: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      rooms: { Row: Room; Insert: Partial<Room>; Update: Partial<Room>; Relationships: [] };
      room_members: {
        Row: RoomMember;
        Insert: Partial<RoomMember>;
        Update: Partial<RoomMember>;
        Relationships: [];
      };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task>; Relationships: [] };
      task_completions: {
        Row: TaskCompletion;
        Insert: Partial<TaskCompletion>;
        Update: Partial<TaskCompletion>;
        Relationships: [];
      };
      rewards: { Row: Reward; Insert: Partial<Reward>; Update: Partial<Reward>; Relationships: [] };
      reward_redemptions: {
        Row: RewardRedemption;
        Insert: Partial<RewardRedemption>;
        Update: Partial<RewardRedemption>;
        Relationships: [];
      };
    };
    Views: {
      room_member_points: { Row: RoomMemberPoints; Relationships: [] };
    };
    Functions: {
      create_room: { Args: { room_name: string; room_description?: string }; Returns: Room };
      join_room: { Args: { code: string }; Returns: Room };
      complete_task: {
        Args: { p_task_id: string; p_photo_url?: string | null; p_note?: string | null };
        Returns: TaskCompletion;
      };
      review_completion: {
        Args: { p_completion_id: string; p_approve: boolean; p_review_note?: string | null };
        Returns: TaskCompletion;
      };
      redeem_reward: { Args: { p_reward_id: string }; Returns: RewardRedemption };
      review_redemption: {
        Args: { p_redemption_id: string; p_approve: boolean; p_review_note?: string | null };
        Returns: RewardRedemption;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
