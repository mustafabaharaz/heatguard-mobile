export type CheckInStatus = 'safe' | 'needs_check' | 'emergency';

export interface Resident {
  id: string;
  name: string;
  age: number;
  address: string;
  phoneNumber: string;
  riskLevel: 'low' | 'medium' | 'high';
  lastCheckIn: Date | null;
  status: CheckInStatus;
  notes?: string;
}

export interface CheckInRecord {
  id: string;
  residentId: string;
  timestamp: Date;
  status: CheckInStatus;
  volunteerId: string;
  notes?: string;
}
