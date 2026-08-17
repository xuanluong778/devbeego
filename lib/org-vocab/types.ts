/** Organization vocabulary SaaS — shared types. */

export type OrgMemberRole = "owner" | "teacher" | "student";

export type OrganizationRow = {
  id: number;
  name: string;
  slug: string | null;
  is_active: number;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export type ClassroomRow = {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  teacher_user_id: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export type VocabularySetRow = {
  id: number;
  organization_id: number;
  created_by: number;
  title: string;
  description: string | null;
  level: string;
  topic: string | null;
  word_count: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export type VocabularySetWordRow = {
  id: number;
  set_id: number;
  word: string;
  meaning_vi: string;
  ipa: string | null;
  part_of_speech: string;
  example_sentence: string | null;
  example_vi: string | null;
  level: string | null;
  topic: string | null;
  sort_order: number;
  created_at: Date;
};

export type AssignmentRow = {
  id: number;
  organization_id: number;
  classroom_id: number;
  set_id: number;
  assigned_by: number;
  title: string;
  instructions: string | null;
  due_at: Date | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

export type ImportWordInput = {
  word: string;
  meaning_vi: string;
  ipa?: string;
  part_of_speech?: string;
  example_sentence?: string;
  example_vi?: string;
  level?: string;
  topic?: string;
};

export type AuthContext = {
  userId: number;
  isSystemAdmin: boolean;
  userName: string;
  userEmail: string | null;
};
