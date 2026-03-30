import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { Thermometer, Users, Shield } from 'lucide-react-native';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
};

const SLIDES = [
  {
    id: 1,
    icon: Thermometer,
    title: 'Real-Time Heat Monitoring',
    description: 'Stay aware of dangerous heat conditions with live temperature tracking and personalized risk alerts.',
    color: COLORS.ember,
  },
  {
    id: 2,
    icon: Users,
    title: 'Community Check-ins',
    description: 'Help vulnerable residents stay safe. Track check-ins, coordinate with volunteers, and respond quickly.',
    color: COLORS.glacier,
  },
  {
    id: 3,
    icon: Shield,
    title: 'Emergency Response',
    description: 'One-tap SOS connects you with emergency services, alerts your contacts, and shares your location.',
    color: COLORS.ocean,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ x: width * nextIndex, animated: true });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = () => {
    // Store that onboarding is complete
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('onboarding_complete', 'true');
      } else {
        const { MMKV } = require('react-native-mmkv');
        const storage = new MMKV();
        storage.set('onboarding_complete', true);
      }
    } catch (error) {
      console.error('Error saving onboarding:', error);
    }
    
    // Force navigation to tabs
    router.replace('/(tabs)');
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip Button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) => {
          const IconComponent = slide.icon;
          return (
            <View key={slide.id} style={styles.slide}>
              <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: `${slide.color}20` }]}>
                  <IconComponent size={80} color={slide.color} strokeWidth={1.5} />
                </View>
                
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Next/Get Started Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: COLORS.ocean,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.ocean,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 28,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.ocean,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  button: {
    backgroundColor: COLORS.ocean,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 44,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
