import { Platform } from 'react-native';
import { CheckInRecord } from '../types/community.types';

const CHECKINS_KEY = 'check_in_records';

// Web fallback storage
class WebStorage {
  set(key: string, value: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }
  
  getString(key: string): string | undefined {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key) || undefined;
    }
    return undefined;
  }
}

// Use MMKV on native, localStorage on web
let storage: any;
if (Platform.OS === 'web') {
  storage = new WebStorage();
} else {
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV();
}

export function saveCheckInRecords(records: CheckInRecord[]): void {
  storage.set(CHECKINS_KEY, JSON.stringify(records));
}

export function getCheckInRecords(): CheckInRecord[] {
  const data = storage.getString(CHECKINS_KEY);
  if (!data) return [];
  
  // Parse and convert date strings back to Date objects
  const records = JSON.parse(data);
  return records.map((r: any) => ({
    ...r,
    timestamp: new Date(r.timestamp),
  }));
}

export function addCheckInRecord(record: CheckInRecord): void {
  const records = getCheckInRecords();
  records.push(record);
  saveCheckInRecords(records);
}

export function getResidentCheckIns(residentId: string): CheckInRecord[] {
  const records = getCheckInRecords();
  return records
    .filter(r => r.residentId === residentId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getLastCheckIn(residentId: string): CheckInRecord | null {
  const records = getResidentCheckIns(residentId);
  return records[0] || null;
}
