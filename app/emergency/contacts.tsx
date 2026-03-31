import haptics from '../../src/utils/haptics';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Plus, Trash2, Phone, Star, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { EmergencyContact } from '../../src/features/emergency/types/contact.types';
import { getContacts, addContact, deleteContact, updateContact } from '../../src/features/emergency/storage/contactStorage';

const COLORS = {
  ocean: '#1D3557',
  glacier: '#8ECAE6',
  lava: '#E63946',
  desert: '#F4A261',
  success: '#10B981',
};

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = () => {
    setContacts(getContacts());
  };

  const handleAdd = () => {
    if (!name || !phoneNumber) {
      Alert.alert('Error', 'Please fill in name and phone number');
      return;
    }

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name,
      phoneNumber,
      relationship: relationship || 'Emergency Contact',
      isPrimary: contacts.length === 0, // First contact is primary
    };

    addContact(newContact);
    loadContacts();
    resetForm();
    setShowAddModal(false);
    Alert.alert('✓ Added', `${name} added as emergency contact`);
  };

  const handleEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhoneNumber(contact.phoneNumber);
    setRelationship(contact.relationship);
    setShowAddModal(true);
  };

  const handleUpdate = () => {
    if (!editingContact || !name || !phoneNumber) return;

    updateContact(editingContact.id, {
      name,
      phoneNumber,
      relationship: relationship || 'Emergency Contact',
    });

    loadContacts();
    resetForm();
    setShowAddModal(false);
    Alert.alert('✓ Updated', 'Contact updated successfully');
  };

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Contact?',
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteContact(contact.id);
            loadContacts();
            Alert.alert('Deleted', `${contact.name} removed`);
          },
        },
      ]
    );
  };

  const handleSetPrimary = (contact: EmergencyContact) => {
    // Unset all primary flags
    contacts.forEach(c => {
      updateContact(c.id, { isPrimary: false });
    });
    // Set this one as primary
    updateContact(contact.id, { isPrimary: true });
    loadContacts();
    Alert.alert('✓ Set Primary', `${contact.name} is now your primary contact`);
  };

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setRelationship('');
    setEditingContact(null);
  };

  const closeModal = () => {
    resetForm();
    setShowAddModal(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
        </Text>
      </View>

      {/* Contacts List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Phone size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyText}>
              Add contacts who should be notified in case of emergency
            </Text>
          </View>
        ) : (
          contacts.map(contact => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <View style={styles.contactInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Star size={14} color={COLORS.desert} fill={COLORS.desert} />
                        <Text style={styles.primaryText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                  <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
                </View>
              </View>

              <View style={styles.contactActions}>
                {!contact.isPrimary && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={() => handleSetPrimary(contact)}
                  >
                    <Star size={16} color={COLORS.desert} />
                    <Text style={[styles.actionText, { color: COLORS.desert }]}>
                      Set Primary
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEdit(contact)}
                >
                  <Text style={[styles.actionText, { color: COLORS.ocean }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(contact)}
                >
                  <Trash2 size={16} color={COLORS.lava} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <X size={24} color={COLORS.ocean} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="(480) 555-0123"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                placeholder="Spouse, Parent, Friend, etc."
                value={relationship}
                onChangeText={setRelationship}
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={editingContact ? handleUpdate : handleAdd}
            >
              <Text style={styles.saveButtonText}>
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: 'white', paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 16, color: COLORS.ocean },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.ocean },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: COLORS.ocean, marginTop: 16 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  contactCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  contactHeader: { marginBottom: 16 },
  contactInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  contactName: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean },
  primaryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8, gap: 4 },
  primaryText: { fontSize: 12, fontWeight: '600', color: COLORS.desert },
  contactRelationship: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  contactPhone: { fontSize: 16, color: COLORS.ocean, fontWeight: '500' },
  contactActions: { flexDirection: 'row', gap: 8 },
  actionButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryButton: { borderColor: COLORS.desert, flex: 1 },
  editButton: { borderColor: COLORS.ocean },
  deleteButton: { borderColor: COLORS.lava, width: 44, justifyContent: 'center', paddingHorizontal: 0 },
  actionText: { fontSize: 14, fontWeight: '500' },
  fab: { position: 'absolute', right: 24, bottom: 32, width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.ocean, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.ocean },
  modalContent: { flex: 1, padding: 20 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.ocean, marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.ocean },
  saveButton: { backgroundColor: COLORS.ocean, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 32, minHeight: 44 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
