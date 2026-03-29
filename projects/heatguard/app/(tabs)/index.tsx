import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-thermal-glacier">
      <Text className="text-4xl font-bold text-thermal-ocean">
        🛡️ HeatGuard
      </Text>
      <Text className="text-lg text-thermal-ocean/70 mt-4">
        Lifesaving Elegance
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}