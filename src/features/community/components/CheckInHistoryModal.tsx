import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, Clock, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react-native';
import { CheckInRecord, CheckInStatus } from '../types/community.types';
import { getResidentCheckIns } from '../storage/checkInStorage';
import { useEffect, useState } from 'react';

const COLORS = {
  ocean: '#1D3557',
  success: '#10B981',
  warning: '#F59E0B',
  lava: '#E63946',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  residentId: string;
  residentName: string;
}

export default function CheckInHistoryModal({ visible, onClose, residentId, residentName }: Props) {
  const [history, setHistory] = useState<CheckInRecord[]>([]);

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible, residentId]);

  const loadHistory = () => {
    const records = getResidentCheckIns(residentId);
    setHistory(records);
  };

  const getStatusIcon = (status: CheckInStatus) => {
    switch (status) {
      case 'safe':
        return <CheckCircle size={20} color={COLORS.success} />;
      case 'needs_check':
        return <AlertTriangle size={20} color={COLORS.warning} />;
      case 'emergency':
        return <AlertCircle size={20} color={COLORS.lava} />;
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
        return 'Checked In - Safe';
      case 'needs_check':
        return 'Needs Check';
      case 'emergency':
        return 'Emergency Reported';
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (hours > 24) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const formatFullTimestamp = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Check-in History</Text>
            <Text style={styles.subtitle}>{residentName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={COLORS.ocean} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Clock size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Check-in History</Text>
              <Text style={styles.emptyText}>
                Check-ins will appear here once recorded
              </Text>
            </View>
          ) : (
            history.map((record) => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View style={styles.statusBadge}>
                    {getStatusIcon(record.status)}
                    <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                      {getStatusText(record.status)}
                    </Text>
                  </View>
                  <Text style={styles.timeAgo}>{formatTimestamp(record.timestamp)}</Text>
                </View>

                <View style={styles.recordDetails}>
                  <View style={styles.detailRow}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.detailText}>{formatFullTimestamp(record.timestamp)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.volunteerText}>
                      Checked by: {record.volunteerId}
                    </Text>
                  </View>
                  {record.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{record.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.ocean },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: COLORS.ocean, marginTop: 16 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  recordCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 15, fontWeight: '600' },
  timeAgo: { fontSize: 14, color: '#6B7280' },
  recordDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: '#374151' },
  volunteerText: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
  notesContainer: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginTop: 4 },
  notesText: { fontSize: 14, color: '#374151' },
});
