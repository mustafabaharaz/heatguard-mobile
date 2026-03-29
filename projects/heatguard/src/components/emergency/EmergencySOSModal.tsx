import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { AlertCircle, Phone, Users, MapPin, X } from 'lucide-react-native';

interface EmergencySOSModalProps {
  visible: boolean;
  onClose: () => void;
  onCallEmergency: () => void;
  onContactFamily: () => void;
  onShareLocation: () => void;
}

export default function EmergencySOSModal({
  visible,
  onClose,
  onCallEmergency,
  onContactFamily,
  onShareLocation
}: EmergencySOSModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center">
              <AlertCircle size={28} color="#E63946" strokeWidth={2.5} />
              <Text className="text-2xl font-bold text-thermal-ocean ml-3">
                Emergency SOS
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 active:opacity-60"
              accessibilityLabel="Close emergency menu"
              accessibilityRole="button"
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Warning Message */}
          <View className="bg-thermal-lava/10 rounded-2xl p-4 mb-6">
            <Text className="text-base text-thermal-lava font-semibold">
              ⚠️ Choose an emergency action below
            </Text>
          </View>

          {/* Emergency Actions - All ≥44pt touch targets */}
          
          {/* Call 911 */}
          <TouchableOpacity
            onPress={onCallEmergency}
            className="bg-thermal-lava rounded-2xl p-5 mb-4 flex-row items-center active:opacity-80"
            style={{ minHeight: 44 }}
            accessibilityLabel="Call 911 emergency services"
            accessibilityRole="button"
          >
            <View className="bg-white/20 p-3 rounded-full">
              <Phone size={24} color="white" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-bold">
                Call 911
              </Text>
              <Text className="text-white/90 text-sm mt-1">
                Emergency medical services
              </Text>
            </View>
          </TouchableOpacity>

          {/* Contact Emergency Contacts */}
          <TouchableOpacity
            onPress={onContactFamily}
            className="bg-thermal-ember rounded-2xl p-5 mb-4 flex-row items-center active:opacity-80"
            style={{ minHeight: 44 }}
            accessibilityLabel="Contact emergency contacts"
            accessibilityRole="button"
          >
            <View className="bg-white/20 p-3 rounded-full">
              <Users size={24} color="white" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-bold">
                Contact Family
              </Text>
              <Text className="text-white/90 text-sm mt-1">
                Alert your emergency contacts
              </Text>
            </View>
          </TouchableOpacity>

          {/* Share Location */}
          <TouchableOpacity
            onPress={onShareLocation}
            className="bg-thermal-desert rounded-2xl p-5 mb-4 flex-row items-center active:opacity-80"
            style={{ minHeight: 44 }}
            accessibilityLabel="Share your location with emergency contacts"
            accessibilityRole="button"
          >
            <View className="bg-white/20 p-3 rounded-full">
              <MapPin size={24} color="white" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-lg font-bold">
                Share Location
              </Text>
              <Text className="text-white/90 text-sm mt-1">
                Send GPS coordinates to contacts
              </Text>
            </View>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-100 rounded-2xl p-4 items-center active:opacity-60"
            style={{ minHeight: 44 }}
            accessibilityLabel="Cancel emergency request"
            accessibilityRole="button"
          >
            <Text className="text-gray-700 text-lg font-semibold">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
