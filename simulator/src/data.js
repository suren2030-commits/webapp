'use strict';

// airport_id: 1=MAA 2=BLR 3=DEL 4=BOM 5=DXB 6=DOH
const AIRPORTS = [
  { id: 1, iata: 'MAA', daily_dep: 250 },
  { id: 2, iata: 'BLR', daily_dep: 200 },
  { id: 3, iata: 'DEL', daily_dep: 175 },
  { id: 4, iata: 'BOM', daily_dep: 150 },
  { id: 5, iata: 'DXB', daily_dep: 50  },
  { id: 6, iata: 'DOH', daily_dep: 30  },
];

// Routes by origin id: [dest_id, duration_min, [airline_ids], [aircraft_type_ids]]
// airline_ids: 1=6E 2=AI 3=UK 4=SG 5=EK 6=QR
// aircraft_type_ids: 1=A320 2=A321 3=B737 4=B777 5=A350 6=ATR72
const ROUTES_BY_ORIGIN = {
  1: [ // MAA
    [2, 60,  [1,2,3,4], [1,2,3,6]],
    [3, 160, [1,2,3,4], [1,2,3]],
    [4, 110, [1,2,3,4], [1,2,3]],
    [5, 240, [5,2],     [4,5]],
    [6, 225, [6,2],     [4,5]],
  ],
  2: [ // BLR
    [1,  60, [1,2,3,4], [1,2,3,6]],
    [3, 145, [1,2,3,4], [1,2,3]],
    [4, 100, [1,2,3,4], [1,2,3]],
    [5, 230, [5,2],     [4,5]],
    [6, 215, [6],       [4,5]],
  ],
  3: [ // DEL
    [1, 160, [1,2,3,4], [1,2,3]],
    [2, 145, [1,2,3,4], [1,2,3]],
    [4, 125, [1,2,3,4], [1,2,3]],
    [5, 195, [5,2],     [4,5]],
    [6, 180, [6,2],     [4,5]],
  ],
  4: [ // BOM
    [1, 110, [1,2,3,4], [1,2,3]],
    [2, 100, [1,2,3,4], [1,2,3]],
    [3, 125, [1,2,3,4], [1,2,3]],
    [5, 185, [5,2],     [4,5]],
    [6, 170, [6,2],     [4,5]],
  ],
  5: [ // DXB → India only
    [1, 240, [5,2], [4,5]],
    [2, 230, [5],   [4,5]],
    [3, 195, [5,2], [4,5]],
    [4, 185, [5,2], [4,5]],
  ],
  6: [ // DOH → India only
    [1, 225, [6,2], [4,5]],
    [3, 180, [6,2], [4,5]],
    [4, 170, [6,2], [4,5]],
  ],
};

// airline_id → IATA code
const AIRLINE_IATA = { 1:'6E', 2:'AI', 3:'UK', 4:'SG', 5:'EK', 6:'QR' };

// Airline flight number starting point (incremented per day)
const AIRLINE_FN_BASE = { 1:200, 2:100, 3:300, 4:400, 5:500, 6:600 };

// Max passengers by aircraft_type_id
const MAX_PAX = { 1:150, 2:180, 3:162, 4:350, 5:300, 6:70 };

// Hourly departure distribution in %; sums to 100
// Peaks: 07-09 morning, 19-20 evening
const HOUR_DIST = [1,1,1,1,1,2,4,7,8,6,5,5,5,4,5,4,5,5,6,8,6,5,3,2];

// Delay cause categories (weighted toward airline)
const DELAY_CAUSES = ['airline','airline','airline','airline','atc','atc','airport','airport','weather','other'];

module.exports = { AIRPORTS, ROUTES_BY_ORIGIN, AIRLINE_IATA, AIRLINE_FN_BASE, MAX_PAX, HOUR_DIST, DELAY_CAUSES };
