import { Platform } from 'react-native';
import { EmergencyContact } from '../types/contact.types';

const CONTACTS_KEY = 'emergency_contacts';

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

export function saveContacts(contacts: EmergencyContact[]): void {
  storage.set(CONTACTS_KEY, JSON.stringify(contacts));
}

export function getContacts(): EmergencyContact[] {
  const data = storage.getString(CONTACTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addContact(contact: EmergencyContact): void {
  const contacts = getContacts();
  contacts.push(contact);
  saveContacts(contacts);
}

export function updateContact(id: string, updates: Partial<EmergencyContact>): void {
  const contacts = getContacts();
  const index = contacts.findIndex(c => c.id === id);
  if (index !== -1) {
    contacts[index] = { ...contacts[index], ...updates };
    saveContacts(contacts);
  }
}

export function deleteContact(id: string): void {
  const contacts = getContacts().filter(c => c.id !== id);
  saveContacts(contacts);
}

export function getPrimaryContact(): EmergencyContact | null {
  const contacts = getContacts();
  return contacts.find(c => c.isPrimary) || contacts[0] || null;
}
