export interface Player {
  id: string;
  name: string;
  phone?: string | null;
  is_admin: boolean;
  created_at: string;
  balance?: number;
}

export interface Match {
  id: string;
  date: string;
  total_cost: number;
  notes?: string | null;
  created_at: string;
  match_players?: MatchPlayer[];
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  player_id: string;
  cost_share: number;
  players?: { id: string; name: string } | null;
}

export type TransactionType = 'TOPUP' | 'MATCH' | 'ADJUSTMENT' | 'ACTIVITY';

export interface Activity {
  id: string;
  date: string;
  title: string;
  total_cost: number;
  notes?: string | null;
  created_at: string;
  activity_players?: ActivityPlayer[];
}

export interface ActivityPlayer {
  id: string;
  activity_id: string;
  player_id: string;
  cost_share: number;
  players?: { id: string; name: string } | null;
}
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Transaction {
  id: string;
  player_id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference_id?: string | null;
  notes?: string | null;
  proof_url?: string | null;
  created_at: string;
  approved_at?: string | null;
  players?: { id: string; name: string } | null;
}
