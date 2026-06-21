import { create } from 'zustand';

const useAppStore = create((set) => ({
  airportId:   null,
  airportCode: null,
  airportName: null,
  setAirport: (id, code, name) => set({ airportId: id, airportCode: code, airportName: name }),
}));

export default useAppStore;
