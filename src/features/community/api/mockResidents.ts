import { Resident } from '../types/community.types';

export const MOCK_RESIDENTS: Resident[] = [
  {
    id: '1',
    name: 'Margaret Chen',
    age: 78,
    address: '234 Oak Street, Tempe AZ',
    phoneNumber: '(480) 555-0123',
    riskLevel: 'high',
    lastCheckIn: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    status: 'needs_check',
    notes: 'Lives alone, no AC',
  },
  {
    id: '2',
    name: 'Robert Johnson',
    age: 82,
    address: '567 Maple Ave, Tempe AZ',
    phoneNumber: '(480) 555-0456',
    riskLevel: 'high',
    lastCheckIn: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    status: 'safe',
    notes: 'Diabetic, needs regular monitoring',
  },
  {
    id: '3',
    name: 'Patricia Williams',
    age: 71,
    address: '890 Pine Road, Tempe AZ',
    phoneNumber: '(480) 555-0789',
    riskLevel: 'medium',
    lastCheckIn: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    status: 'needs_check',
    notes: 'Has family nearby',
  },
  {
    id: '4',
    name: 'James Martinez',
    age: 85,
    address: '123 Cedar Lane, Tempe AZ',
    phoneNumber: '(480) 555-0234',
    riskLevel: 'high',
    lastCheckIn: null,
    status: 'emergency',
    notes: 'Heart condition, hasn\'t responded today',
  },
  {
    id: '5',
    name: 'Linda Davis',
    age: 69,
    address: '456 Birch Court, Tempe AZ',
    phoneNumber: '(480) 555-0567',
    riskLevel: 'low',
    lastCheckIn: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'safe',
    notes: 'Active, good health',
  },
];
