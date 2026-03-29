import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Users, Phone, MapPin, Clock, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { Resident, CheckInStatus } from '../../src/features/community/types/community.types';
import { MOCK_RESIDENTS } from '../../src/features/community/api/mockResidents';

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
  success: '#10B981',
  warning: '#F59E0B',
};

export default function CommunityScreen() {
  const [residents, setResidents] = useState<Resident[]>(MOCK_RESIDENTS);
  const [filter, setFilter] = useState<'all' | CheckInStatus>('all');

  const filteredResidents = filter === 'all' 
    ? residents 
    : residents.filter(r => r.status === filter);

  const handleCheckIn = (residentId: string) => {
    Alert.alert(
      'Check-in Resident?',
      'Mark this resident as safe and checked?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Safe',
          onPress: () => {
            setResidents(prev =>
              prev.map(r =>
                r.id === residentId
                  ? { ...r, status: 'safe', lastCheckIn: new Date() }
                  : r
              )
            );
            Alert.alert('Success', 'Resident marked as safe ✓');
          },
        },
      ]
    );
  };

  const handleCall = (resident: Resident) => {
    Alert.alert(
      `Call ${resident.name}?`,
      resident.phoneNumber,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => console.log('Calling...') },
      ]
    );
  };

  const handleEmergency = (resident: Resident) => {
    Alert.alert(
      '🆘 Report Emergency',
      `Report emergency for ${resident.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            setResidents(prev =>
              prev.map(r =>
                r.id === resident.id ? { ...r, status: 'emergency' } : r
              )
            );
            Alert.alert('Emergency Reported', '911 and emergency contacts notified');
          },
        },
      ]
    );
  };

  const getStatusIcon = (status: CheckInStatus) => {
    switch (status) {
      case 'safe':
        return <CheckCircle size={24} color={COLORS.success} />;
      case 'needs_check':
        return <AlertTriangle size={24} color={COLORS.warning} />;
      case 'emergency':
        return <AlertCircle size={24} color={COLORS.lava} />;
    }
  };

  const getStatusColor = (status: CheckInStatus) => {
    switch (status) {
      case 'safe':
        return COLORS.success;
      case 'needs_check':
        return COLORS.warning;
      case 'emergency':
        return COLORS.lava;
    }
  };

  const getStatusText = (status: CheckInStatus) => {
    switch (status) {
      case 'safe':
        return 'Checked In';
      case 'needs_check':
        return 'Needs Check';
      case 'emergency':
        return 'EMERGENCY';
    }
  };

  const getLastCheckInText = (lastCheckIn: Date | null) => {
    if (!lastCheckIn) return 'Never checked';
    
    const hours = Math.floor((Date.now() - lastCheckIn.getTime()) / (1000 * 60 * 60));
    const minutes = Math.floor((Date.now() - lastCheckIn.getTime()) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const stats = {
    total: residents.length,
    safe: residents.filter(r => r.status === 'safe').length,
    needsCheck: residents.filter(r => r.status === 'needs_check').length,
    emergency: residents.filter(r => r.status === 'emergency').length,
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community Check-ins</Text>
        <Text style={styles.subtitle}>Vulnerable Residents Monitoring</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { borderLeftColor: COLORS.ocean }]}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
          <Text style={styles.statNumber}>{stats.safe}</Text>
          <Text style={styles.statLabel}>Safe</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.warning }]}>
          <Text style={styles.statNumber}>{stats.needsCheck}</Text>
          <Text style={styles.statLabel}>Need Check</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.lava }]}>
          <Text style={styles.statNumber}>{stats.emergency}</Text>
          <Text style={styles.statLabel}>Emergency</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'needs_check' && styles.filterTabActive]}
          onPress={() => setFilter('needs_check')}
        >
          <Text style={[styles.filterText, filter === 'needs_check' && styles.filterTextActive]}>
            Needs Check
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'emergency' && styles.filterTabActive]}
          onPress={() => setFilter('emergency')}
        >
          <Text style={[styles.filterText, filter === 'emergency' && styles.filterTextActive]}>
            Emergency
          </Text>
        </TouchableOpacity>
      </View>

      {/* Residents List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContent}>
        {filteredResidents.map(resident => (
          <View key={resident.id} style={styles.residentCard}>
            {/* Header */}
            <View style={styles.residentHeader}>
              <View style={styles.residentInfo}>
                <Text style={styles.residentName}>{resident.name}</Text>
                <Text style={styles.residentAge}>{resident.age} years old</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(resident.status)}15` }]}>
                {getStatusIcon(resident.status)}
                <Text style={[styles.statusText, { color: getStatusColor(resident.status) }]}>
                  {getStatusText(resident.status)}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.residentDetails}>
              <View style={styles.detailRow}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.detailText}>{resident.address}</Text>
              </View>
              <View style={styles.detailRow}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.detailText}>Last check: {getLastCheckInText(resident.lastCheckIn)}</Text>
              </View>
              {resident.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesText}>📝 {resident.notes}</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={() => handleCall(resident)}
              >
                <Phone size={18} color="white" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>

              {resident.status !== 'safe' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.checkInButton]}
                  onPress={() => handleCheckIn(resident.id)}
                >
                  <CheckCircle size={18} color="white" />
                  <Text style={styles.actionButtonText}>Check In</Text>
                </TouchableOpacity>
              )}

              {resident.status !== 'emergency' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.emergencyButton]}
                  onPress={() => handleEmergency(resident)}
                >
                  <AlertCircle size={18} color="white" />
                  <Text style={styles.actionButtonText}>SOS</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 30, fontWeight: 'bold', color: COLORS.ocean },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginHorizontal: 4, borderLeftWidth: 3 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.ocean },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterTabActive: { borderBottomColor: COLORS.ocean },
  filterText: { fontSize: 14, color: '#6B7280' },
  filterTextActive: { color: COLORS.ocean, fontWeight: '600' },
  scrollView: { flex: 1 },
  listContent: { padding: 16 },
  residentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  residentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  residentInfo: { flex: 1 },
  residentName: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean },
  residentAge: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusText: { fontSize: 14, fontWeight: '600' },
  residentDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  detailText: { fontSize: 14, color: '#374151', flex: 1 },
  notesContainer: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginTop: 4 },
  notesText: { fontSize: 13, color: '#92400E' },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6, minHeight: 44 },
  callButton: { backgroundColor: COLORS.ocean },
  checkInButton: { backgroundColor: COLORS.success },
  emergencyButton: { backgroundColor: COLORS.lava },
  actionButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
