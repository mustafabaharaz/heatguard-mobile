/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        thermal: {
          glacier: '#8ECAE6',
          arctic: '#F8F9FA',
          desert: '#F4A261',
          ember: '#E76F51',
          lava: '#E63946',
          ocean: '#1D3557',
        }
      }
    }
  },
  plugins: []
}
