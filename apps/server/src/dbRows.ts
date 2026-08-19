// Row shapes returned by the SQLite queries in db.ts. Keeping these in a
// dedicated module lets db.ts stay under the source-size limit and gives the
// prepared-statement casts a single, reviewable source of truth.

export type UserRow = {
  id: string;
  nickname: string;
  email: string | null;
  password_hash: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  rotation: number | null;
};

export type StoryProgressDbRow = {
  story_id: string;
  definition_version: number;
  node_id: string;
  flags_json: string;
  ending: string | null;
  visit_count: number;
  updated_at: string;
};

export type HouseRow = {
  building_id: string;
  name: string | null;
  owner_id: string;
  owner_nickname: string;
};

export type HousingRequestRow = {
  id: number;
  building_id: string;
  house_name: string | null;
  owner_id: string;
  owner_nickname: string;
  requester_id: string;
  requester_nickname: string;
  target_id: string;
  target_nickname: string;
  kind: 'invite' | 'application';
  created_at: string;
};

export type NpcChangeRequestRow = {
  id: number;
  requester_id: string | null;
  requester_nickname: string;
  npc_id: string;
  kind: string;
  title: string;
  summary: string;
  change_json: string;
  status: string;
  reviewer: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ChatMessageRow = {
  id: number;
  user_id: string;
  nickname: string;
  text: string;
  flagged_at: string | null;
  hidden_at: string | null;
  hidden_by: string | null;
  moderation_status: 'unreviewed' | 'pending' | 'approved' | 'rejected' | 'error';
  moderation_request_id: string | null;
  moderation_risk_types_json: string;
  moderation_error: string | null;
  moderated_at: string | null;
  created_at: string;
};

export type ChatAuthorRow = {
  user_id: string;
  nickname: string;
  messages: number;
  hidden: number | null;
  flagged: number | null;
  last_at: string;
  disabled: number | null;
};

export type AdminUserRow = {
  id: string;
  nickname: string;
  email: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
  session_expires_at: string | null;
  house_id: string | null;
};

export type AdminAuditRow = {
  id: number;
  actor: string;
  action: string;
  target: string | null;
  details_json: string;
  created_at: string;
};

export type StoryProgressAdminRow = {
  user_id: string;
  nickname: string | null;
  story_id: string;
  definition_version: number;
  node_id: string;
  ending: string | null;
  visit_count: number;
  flags_json: string;
  updated_at: string;
};
