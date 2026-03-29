import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { X, Phone, Users, MapPin } from 'lucide-react-native';
import { getPrimaryContact } from '../../features/emergency/storage/contactStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCallEmergency: () => void;
  onContactFamily: () => void;
  onShareLocation: () => void;
}

const COLORS = {
  lava: '#E63946',
  ocean: '#1D3557',
  glacier: '#8ECAE6',
  success: '#10B981',
};

export default function EmergencySOSModal({
  visible,
  onClose,
  onCallEmergency,
  onContactFamily,
  onShareLocation,
}: Props) {
  const handleContactFamily = () => {
    const primaryContact = getPrimaryContact();
    
    if (!primaryContact) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add emergency contacts in Settings → Emergency Contacts',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Now', onPress: onClose },
        ]
      );
      return;
    }

    Alert.alert(
      `Contact ${primaryContact.name}?`,
      `Call or text ${primaryContact.phoneNumber}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            onClose();
            Linking.openURL(`tel:${primaryContact.phoneNumber}`);
          },
        },
        {
          text: 'Text',
          onPress: () => {
            onClose();
            Linking.openURL(`sms:${primaryContact.phoneNumber}?body=🆘 Emergency alert from HeatGuard. I need help due to heat conditions.`);
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🆘 Emergency SOS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.ocean} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose an emergency action below
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.emergencyButton]}
              onPress={onCallEmergency}
            >
              <Phone size={32} color="white" />
              <Text style={styles.actionText}>Call 911</Text>
              <Text style={styles.actionSubtext}>Emergency services</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.contactButton]}
              onPress={handleContactFamily}
            >
              <Users size={32} color="white" />
              <Text style={styles.actionText}>Contact Family</Text>
              <Text style={styles.actionSubtext}>Alert emergency contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.locationButton]}
              onPress={onShareLocation}
            >
              <MapPin size={32} color="white" />
              <Text style={styles.actionText}>Share Location</Text>
              <Text style={styles.actionSubtext}>Send GPS coordinates</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.lava },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 24 },
  actions: { gap: 12 },
  actionButton: { borderRadius: 16, padding: 20, alignItems: 'center', minHeight: 44 },
  emergencyButton: { backgroundColor: COLORS.lava },
  contactButton: { backgroundColor: COLORS.ocean },
  locationButton: { backgroundColor: COLORS.success },
  actionText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  actionSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
});
