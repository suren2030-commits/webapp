import { create } from 'zustand';

const stored = localStorage.getItem('apoc_dark_mode');

const useAppStore = create((set) => ({
  airportId:   null,
  airportCode: null,
  airportName: null,
  darkMode:    stored === 'true',

  setAirport: (id, code, name) => set({ airportId: id, airportCode: code, airportName: name }),

  toggleDarkMode: () => set((state) => {
    const next = !state.darkMode;
    localStorage.setItem('apoc_dark_mode', String(next));
    return { darkMode: next };
  }),
}));

export default useAppStore;
