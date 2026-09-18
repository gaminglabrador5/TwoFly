# TwoFly

Freeware point-to-point dispatch generator for Microsoft Flight Simulator 2024. Also usable as a planning sheet for other sims.

**MIT License.** Free to use, copy, modify, and share. See [LICENSE](LICENSE) and [NOTICE.txt](NOTICE.txt).

Designed and directed by the author. Software implementation with Grok (xAI).

Not affiliated with Microsoft, Asobo Studio, or any aircraft or scenery publisher.

## Desk

Airport of departure to airport of arrival only. No visual-world taskings (no banner towing, no search-and-rescue the sim already shows).

- Free Flight and Airline Mode
- Hangar, certificates (Student Pilot → Private Pilot → Commercial Pilot → ATP), pay, and credit
- Collectables: landmarks, cities, airports
- Local save only. No sim connection.

## Operation

Windows pack: unzip and double-click `TwoFly.exe`.

From source: open `index.html` (airport data is bundled in `airports.js`).

1. Enter departure ICAO / IATA / city.
2. Select aircraft.
3. Set leg length and task category.
4. Issue taskings.
5. Accept. Complete on arrival.

## Data

- Airfields: trimmed OurAirports public-domain data (~14,000)
- IBM Plex fonts: SIL Open Font License 1.1
- Aircraft type names are identifiers only
