export interface CoolingCenter {
  id: string;
  name: string;
  type: 'cooling_center' | 'emergency_shelter' | 'hospital';
  address: string;
  latitude: number;
  longitude: number;
  hours: string;
  hasAC: boolean;
  capacity?: number;
  phoneNumber?: string;
}

// Tempe, AZ area locations
export const COOLING_CENTERS: CoolingCenter[] = [
  {
    id: '1',
    name: 'Tempe Public Library',
    type: 'cooling_center',
    address: '3500 S Rural Rd, Tempe, AZ',
    latitude: 33.3942,
    longitude: -111.9261,
    hours: '9 AM - 9 PM',
    hasAC: true,
    capacity: 200,
    phoneNumber: '(480) 350-5500',
  },
  {
    id: '2',
    name: 'Escalante Community Center',
    type: 'cooling_center',
    address: '2150 E Orange St, Tempe, AZ',
    latitude: 33.4233,
    longitude: -111.9094,
    hours: '8 AM - 8 PM',
    hasAC: true,
    capacity: 150,
    phoneNumber: '(480) 350-5201',
  },
  {
    id: '3',
    name: 'Tempe Emergency Shelter',
    type: 'emergency_shelter',
    address: '1010 S 48th St, Tempe, AZ',
    latitude: 33.4156,
    longitude: -111.9783,
    hours: '24/7',
    hasAC: true,
    capacity: 100,
    phoneNumber: '(480) 858-2323',
  },
  {
    id: '4',
    name: 'Tempe St. Luke\'s Hospital',
    type: 'hospital',
    address: '1500 S Mill Ave, Tempe, AZ',
    latitude: 33.4115,
    longitude: -111.9400,
    hours: '24/7',
    hasAC: true,
    phoneNumber: '(480) 784-5500',
  },
  {
    id: '5',
    name: 'Arizona Mills Mall',
    type: 'cooling_center',
    address: '5000 S Arizona Mills Cir, Tempe, AZ',
    latitude: 33.3832,
    longitude: -111.9651,
    hours: '10 AM - 9 PM',
    hasAC: true,
    capacity: 500,
  },
  {
    id: '6',
    name: 'Pyle Adult Recreation Center',
    type: 'cooling_center',
    address: '655 E Southern Ave, Tempe, AZ',
    latitude: 33.3932,
    longitude: -111.9324,
    hours: '8 AM - 5 PM',
    hasAC: true,
    capacity: 100,
    phoneNumber: '(480) 350-5201',
  },
];

// Heat risk zones (polygons)
export const HEAT_ZONES = [
  {
    id: 'zone1',
    name: 'Downtown Tempe - High Risk',
    riskLevel: 'high',
    coordinates: [
      { latitude: 33.4255, longitude: -111.9400 },
      { latitude: 33.4355, longitude: -111.9300 },
      { latitude: 33.4155, longitude: -111.9300 },
    ],
  },
  {
    id: 'zone2',
    name: 'ASU Campus - Medium Risk',
    riskLevel: 'medium',
    coordinates: [
      { latitude: 33.4242, longitude: -111.9281 },
      { latitude: 33.4300, longitude: -111.9200 },
      { latitude: 33.4200, longitude: -111.9200 },
    ],
  },
];
