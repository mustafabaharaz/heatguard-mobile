export interface TemperatureReading {
  time: Date;
  temperature: number;
  riskLevel: 'safe' | 'caution' | 'high' | 'critical';
}

export function generateHistoricalData(): TemperatureReading[] {
  const now = new Date();
  const data: TemperatureReading[] = [];
  
  // Generate 24 hours of data (hourly readings)
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();
    
    // Simulate temperature curve: cool at night, hot in afternoon
    let temp;
    if (hour >= 0 && hour < 6) {
      temp = 24 + Math.random() * 3; // Night: 24-27°C
    } else if (hour >= 6 && hour < 12) {
      temp = 28 + (hour - 6) * 1.5 + Math.random() * 2; // Morning: rising
    } else if (hour >= 12 && hour < 17) {
      temp = 37 + Math.random() * 4; // Afternoon: 37-41°C (hottest)
    } else if (hour >= 17 && hour < 21) {
      temp = 35 - (hour - 17) * 2 + Math.random() * 2; // Evening: cooling
    } else {
      temp = 26 + Math.random() * 2; // Late night
    }
    
    const riskLevel = 
      temp >= 40 ? 'critical' :
      temp >= 35 ? 'high' :
      temp >= 30 ? 'caution' : 'safe';
    
    data.push({ time, temperature: Math.round(temp), riskLevel });
  }
  
  return data;
}

export function getHottestTime(data: TemperatureReading[]): { time: Date; temp: number } {
  const hottest = data.reduce((max, reading) => 
    reading.temperature > max.temperature ? reading : max
  );
  return { time: hottest.time, temp: hottest.temperature };
}

export function getCoolestTime(data: TemperatureReading[]): { time: Date; temp: number } {
  const coolest = data.reduce((min, reading) => 
    reading.temperature < min.temperature ? reading : min
  );
  return { time: coolest.time, temp: coolest.temperature };
}
