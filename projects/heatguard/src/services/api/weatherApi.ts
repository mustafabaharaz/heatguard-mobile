const OPENWEATHER_API_KEY = 'demo-key'; // Replace with real key later
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
  temperature: number; // Celsius
  feelsLike: number;
  humidity: number;
  description: string;
  location: string;
}

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
  try {
    const response = await fetch(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Weather API request failed');
    }
    
    const data = await response.json();
    
    return {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      description: data.weather[0].description,
      location: data.name,
    };
  } catch (error) {
    console.error('Weather API error:', error);
    // Return mock data for demo
    return {
      temperature: 38,
      feelsLike: 42,
      humidity: 65,
      description: 'clear sky',
      location: 'Tempe, AZ',
    };
  }
}
