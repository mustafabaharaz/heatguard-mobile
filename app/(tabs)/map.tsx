import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MapPin, Navigation, Phone, Clock, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useLocation } from '../../src/lib/hooks/useLocation';
import { COOLING_CENTERS, CoolingCenter } from '../../src/features/map/data/mockLocations';

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
  success: '#10B981',
};

export default function MapScreen() {
  const { location } = useLocation();

  const userLocation = location || { lat: 33.4255, lon: -111.9400 }; // Default to Tempe

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'cooling_center':
        return COLORS.glacier;
      case 'emergency_shelter':
        return COLORS.ember;
      case 'hospital':
        return COLORS.lava;
      default:
        return COLORS.ocean;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'cooling_center':
        return 'Cooling Center';
      case 'emergency_shelter':
        return 'Emergency Shelter';
      case 'hospital':
        return 'Hospital';
      default:
        return 'Location';
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance.toFixed(1);
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone Number', 'Contact information not available');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDirections = (lat: number, lon: number, address: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lon}`,
      android: `geo:0,0?q=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url);
  };

  const sortedCenters = [...COOLING_CENTERS].sort((a, b) => {
    const distA = parseFloat(calculateDistance(userLocation.lat, userLocation.lon, a.latitude, a.longitude));
    const distB = parseFloat(calculateDistance(userLocation.lat, userLocation.lon, b.latitude, b.longitude));
    return distA - distB;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Safety Locations</Text>
          <Text style={styles.subtitle}>Cooling Centers & Emergency Services</Text>
        </View>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            📍 Interactive map available on mobile app
          </Text>
        </View>
      )}

      {/* List View */}
      <ScrollView style={styles.listView} contentContainerStyle={styles.listContent}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.glacier }]} />
            <Text style={styles.legendText}>Cooling Center</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.ember }]} />
            <Text style={styles.legendText}>Emergency Shelter</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.lava }]} />
            <Text style={styles.legendText}>Hospital</Text>
          </View>
        </View>

        {sortedCenters.map((center) => (
          <View key={center.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={[styles.typeBadge, { backgroundColor: `${getMarkerColor(center.type)}20` }]}>
                <MapPin size={16} color={getMarkerColor(center.type)} />
                <Text style={[styles.typeBadgeText, { color: getMarkerColor(center.type) }]}>
                  {getTypeLabel(center.type)}
                </Text>
              </View>
              <Text style={styles.distanceText}>
                {calculateDistance(userLocation.lat, userLocation.lon, center.latitude, center.longitude)} mi
              </Text>
            </View>

            <Text style={styles.listCardName}>{center.name}</Text>
            <Text style={styles.listCardAddress}>{center.address}</Text>
            
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Clock size={14} color="#6B7280" />
                <Text style={styles.listCardHours}>{center.hours}</Text>
              </View>
              {center.capacity && (
                <View style={styles.detailItem}>
                  <Users size={14} color="#6B7280" />
                  <Text style={styles.listCardCapacity}>{center.capacity} capacity</Text>
                </View>
              )}
            </View>

            <View style={styles.listCardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.directionsButton]}
                onPress={() => handleDirections(center.latitude, center.longitude, center.address)}
              >
                <Navigation size={16} color="white" />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>

              {center.phoneNumber && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.callButton]}
                  onPress={() => handleCall(center.phoneNumber)}
                >
                  <Phone size={16} color="white" />
                  <Text style={styles.actionButtonText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 30, fontWeight: 'bold', color: COLORS.ocean },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  webNote: { backgroundColor: COLORS.glacier + '20', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  webNoteText: { fontSize: 14, color: COLORS.ocean, fontWeight: '500' },
  listView: { flex: 1 },
  listContent: { padding: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#6B7280' },
  listCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  listCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  distanceText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  listCardName: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 6 },
  listCardAddress: { fontSize: 14, color: '#374151', marginBottom: 8 },
  detailsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listCardHours: { fontSize: 13, color: '#6B7280' },
  listCardCapacity: { fontSize: 13, color: '#6B7280' },
  listCardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6, minHeight: 44 },
  directionsButton: { backgroundColor: COLORS.ocean },
  callButton: { backgroundColor: COLORS.success },
  actionButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
