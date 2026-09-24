from pathlib import Path

src = Path("/mnt/data/cities.js")
out = Path("/mnt/data/cities_humanized.js")

text = src.read_text(encoding="utf-8")

replacements = {
"New York": (
"New York grew around the Hudson River and one of the finest natural harbors on the Atlantic. "
"Manhattan became the city's dense center, but the five boroughs spread far beyond it, each with its own neighborhoods and character. "
"From the air, the harbor, rivers, bridges, and unmistakable Manhattan skyline make the city unusually easy to recognize. "
"Central Park breaks up the middle of Manhattan like a huge green rectangle, while the surrounding city seems to run in every direction."
),
"Los Angeles": (
"Los Angeles sprawls across a broad coastal basin with the San Gabriel Mountains rising sharply to the north. "
"It is a city of long roads, scattered neighborhoods, hills, beaches, and valleys rather than one compact downtown. "
"Hollywood sits among the hills, the ports occupy the coast to the south, and on a clear day the mountains form a dramatic backdrop over nearly everything. "
"The dry summers and winter rains also give the landscape a very different look depending on the season."
),
"Denver": (
"Denver sits at about 5,280 feet on the High Plains, with the Front Range rising dramatically just to the west. "
"The city began as a gold-rush settlement along the South Platte in 1858 and eventually became Colorado's capital. "
"From the air, the change from flat prairie to mountains is hard to miss, especially when the weather is clear. "
"Downtown's original street grid is still visible, and the gold-covered dome of the State Capitol stands out near the center of the city."
),
"London": (
"London grew along the River Thames from the Roman settlement of Londinium into a huge city made up of hundreds of neighborhoods. "
"The historic City of London is still surprisingly compact, while Greater London stretches for miles in every direction. "
"From above, the Thames provides a useful thread through the city, passing landmarks, bridges, parks, and the old center of Westminster. "
"The Underground, opened in 1863, was the world's first subway and became one of the defining pieces of London's identity."
),
"Paris": (
"Paris grew outward from islands in the Seine, and the river still gives the city much of its shape. "
"Wide boulevards cut through the older neighborhoods, while the twenty arrondissements wrap around the historic center in a rough spiral. "
"From the air, the Seine, bridges, parks, and long avenues make the city surprisingly easy to read. "
"The Eiffel Tower is only one part of the skyline, with the older central districts spreading around it toward the Périphérique."
),
"Tokyo": (
"Tokyo sits on the broad Kantō Plain at the head of Tokyo Bay, where the city seems to keep going long after the skyline disappears. "
"The old city of Edo became Tokyo in 1868, and modern Tokyo grew into a collection of distinct centers such as Shinjuku, Shibuya, Ginza, and Ikebukuro. "
"From above, the contrast between dense development, the Imperial Palace grounds, the bay, and the surrounding plain is striking. "
"Earthquakes and rebuilding have changed the city repeatedly, but the old palace grounds and street patterns still anchor the center."
),
"Sydney": (
"Sydney wraps itself around Port Jackson, a huge natural harbor filled with bays, headlands, ferries, and beaches. "
"The Opera House and Harbour Bridge sit almost side by side at the heart of the city, making the waterfront instantly recognizable from the air. "
"The first British fleet arrived here in 1788, and the city has grown outward along the harbor and Pacific coast ever since. "
"Sandstone cliffs, green suburbs, and long beaches give Sydney a much more open feel than many other major cities."
),
"Cairo": (
"Cairo sits along the Nile where a narrow strip of green meets the surrounding desert. "
"The modern city grew beside older settlements, and centuries of history are packed into the same stretch of river, from Islamic Cairo to the Citadel and modern downtown. "
"From the air, the difference between the built-up city, the green Nile corridor, and the desert beyond is especially clear. "
"The Giza pyramids sit just across the western edge of the metropolis, close enough to feel like part of the city rather than a distant destination."
),
"Rio de Janeiro": (
"Rio de Janeiro is squeezed between mountains, Atlantic beaches, rainforest, and the broad waters of Guanabara Bay. "
"Granite peaks such as Sugarloaf and Corcovado rise almost straight out of the city, giving Rio one of the most dramatic natural settings of any major metropolis. "
"From the air, the beaches and mountains make the city's layout almost impossible to confuse with anywhere else. "
"Rio was Brazil's capital until 1960 and remains famous for Carnival, football, music, and the busy life along its beaches."
),
"Rome": (
"Rome is a city built in layers, with ancient ruins, medieval streets, Renaissance buildings, baroque churches, and modern neighborhoods sharing the same landscape. "
"The Tiber runs through the historic center, while the old city grew across several hills to the east. "
"From the air, the Colosseum, ancient forums, Vatican area, and dense historic streets reveal just how much history is packed into a relatively small area. "
"Modern Rome extends well beyond the old Aurelian Walls, but the ancient core still gives the city its distinctive shape."
),
"Istanbul": (
"Istanbul stretches across both sides of the Bosporus, putting Europe and Asia within sight of each other. "
"Constantinople became the eastern Roman capital in 330, and the Ottoman conquest in 1453 added another enormous layer to the city's history. "
"From above, the Bosporus is the defining feature, with the old peninsula, Golden Horn, bridges, and dense neighborhoods climbing away from the water. "
"Ships still pass through the strait every day, making it both a historic landmark and a busy working waterway."
),
"Cape Town": (
"Cape Town sits beneath Table Mountain at the southwestern tip of Africa, with the city, harbor, vineyards, and ocean all packed into the same dramatic landscape. "
"The Dutch established a supply station here in 1652, and the settlement grew into one of South Africa's major cities. "
"From the air, Table Mountain and the surrounding peninsula dominate everything, while the Atlantic opens out beyond the city. "
"The famous southeaster, known locally as the Cape Doctor, can make the summer weather noticeably windy."
),
"Mumbai": (
"Mumbai grew from a group of islands along India's western coast into the country's financial capital and one of its biggest cities. "
"The old waterfront is lined with Victorian-era buildings, while the city spreads north through former mill districts, dense neighborhoods, and film studios. "
"From the air, the narrow peninsula and enormous urban sprawl make it easy to see how much of Mumbai has been built outward from the original shoreline. "
"The monsoon is a major part of life here, bringing months of heavy rain rather than the occasional summer shower."
),
"Beijing": (
"Beijing sits on the North China Plain and has served as China's capital for centuries. "
"The Forbidden City, Tiananmen Square, and the old north-south axis still give the center a strong sense of order, while ring roads mark the edges of the historic city. "
"From the air, the contrast between the dense central districts and the enormous urban area beyond them is striking. "
"The Great Wall is often associated with Beijing, but the famous sections are actually outside the city in the surrounding hills."
),
"Mexico City": (
"Mexico City occupies a high valley that was once a lake, with the modern city built over much of the old lakebed. "
"The Mexica founded Tenochtitlan around 1325, and the Spanish later built their colonial capital directly over its ruins. "
"From the air, the enormous basin and mountains around it help explain the city's unusual scale and geography. "
"At roughly 2,240 meters above sea level, the city is already high before the surrounding volcanoes rise into the horizon."
),
"Moscow": (
"Moscow grew along the Moskva River from a settlement first mentioned in 1147 into the political and cultural center of Russia. "
"The Kremlin and Red Square remain the heart of the historic city, while broad rings of roads follow the paths of older walls. "
"From the air, the city spreads outward in enormous layers, with the river, parks, and radial roads helping define its shape. "
"Winters can be severe, and some of the deepest Metro stations were built with civil-defense use in mind."
),
"Dubai": (
"Dubai began as a small creek-side trading settlement and grew into one of the world's most recognizable modern cities. "
"The old harbor and traditional dhows are still there, but they now share the skyline with the Burj Khalifa, Palm Jumeirah, huge highways, and one of the world's busiest airports. "
"From the air, the contrast between the old creek, modern towers, desert, and reclaimed coastline is almost surreal. "
"Summer heat can be extreme, so much of the city's daily life moves indoors during the hottest months."
),
"Singapore": (
"Singapore is a city-state at the southern tip of the Malay Peninsula, sitting beside one of the world's busiest shipping routes. "
"The island has changed dramatically since the British established a trading post here in 1819, with large areas of shoreline reclaimed from the sea. "
"From the air, the mix of dense development, greenery, reservoirs, port facilities, and reclaimed land is immediately apparent. "
"Rain is frequent and often arrives in short, heavy bursts, fitting a city located just a little north of the equator."
),
"Berlin": (
"Berlin grew along the River Spree and has spent much of its history reinventing itself. "
"It became a Prussian and later German capital, was divided by the Berlin Wall after World War II, and became the capital of reunified Germany in 1990. "
"From the air, the city is surprisingly green and low-rise for a major European capital, with the former Wall route still traceable through parts of the street plan. "
"The Reichstag, government district, parks, lakes, and long avenues give the city a distinctive mix of old and modern."
),
"Toronto": (
"Toronto sits on the north shore of Lake Ontario and has grown from the small settlement of York into Canada's largest city. "
"The lake dominates the southern horizon, while the downtown skyline gives way quickly to a huge spread of suburbs. "
"From the air, Toronto's ravines are surprisingly noticeable, cutting green corridors through an otherwise dense urban area. "
"The city is Canada's financial center and one of its most diverse places, with people arriving from all over the world."
),
"Jakarta": (
"Jakarta sits on the northwest coast of Java, where the Ciliwung River reaches the sea. "
"The city grew from the old port of Sunda Kelapa into Dutch Batavia and eventually modern Jakarta, spreading into one of the world's largest urban regions. "
"From the air, the enormous density of the city contrasts sharply with the coastline and surrounding lowlands. "
"Parts of northern Jakarta are already below sea level, so flooding, pumps, and sea walls are an important part of the city's story."
)
}

facts = {
"New York": "Central Park opened in 1858, when much of the land around it was still outside the built-up part of the city.",
"Los Angeles": "The Los Angeles Aqueduct began delivering Owens Valley water to the city in 1913, helping make its enormous growth possible.",
"Denver": "A marker on the west side of the State Capitol records a spot exactly one mile above sea level.",
"London": "More than 300 languages are spoken across Greater London, reflecting the city's long history as a global crossroads.",
"Paris": "Paris's first Métro line opened in 1900 for the Exposition Universelle, beginning the network that now runs beneath the city.",
"Tokyo": "Tokyo Station's Marunouchi brick façade was designed with Amsterdam Centraal as part of its inspiration.",
"Sydney": "The Harbour Bridge took eight years to build and opened in 1932, creating one of the city's most recognizable landmarks.",
"Cairo": "The Nile through Cairo still carries working freight as well as ferries and sightseeing boats.",
"Rio de Janeiro": "Christ the Redeemer was dedicated in 1931 and stands almost 700 meters above the city on Corcovado.",
"Rome": "The Pantheon's huge unreinforced concrete dome has survived for roughly two thousand years and remains an engineering landmark.",
"Istanbul": "The Bosporus is still a working international strait, with large commercial ships passing through the middle of the historic city.",
"Cape Town": "Table Mountain's cableway opened in 1929 and carries visitors to the plateau above the city.",
"Mumbai": "Mumbai was officially known as Bombay until 1995, although the older name is still heard in everyday speech.",
"Beijing": "Some of Beijing's hutong alleyways still follow the street patterns laid out during the Ming period.",
"Mexico City": "Because the city was built on drained lakebed, parts of Mexico City continue to sink unevenly.",
"Moscow": "Several historic Moscow Metro stations were built deep underground and designed to double as bomb shelters.",
"Dubai": "Dubai Creek was the original center of the city's trade, and traditional cargo dhows still operate there.",
"Singapore": "Roughly a quarter of Singapore's present land area has been created through reclamation from the sea.",
"Berlin": "The Berlin Wall stood from 1961 to 1989, and its former route can still be followed through parts of the city.",
"Toronto": "Toronto's ravines began as natural waterways and ice-age valleys and now form a surprisingly large connected park system.",
"Jakarta": "Some northern neighborhoods are below sea level and depend on pumps, drainage systems, and sea defenses."
}

# Replace only extract and fact string values while preserving the original JS structure.
import re

for city, new_extract in replacements.items():
    pattern = rf'(n:"{re.escape(city)}".*?\n\s+extract:)"(.*?)",\n\s+fact:"(.*?)"'
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise ValueError(f"Could not locate {city}")
    replacement = m.group(1) + '"' + new_extract.replace('"', '\\"') + '",\n     fact:"' + facts[city].replace('"', '\\"') + '"'
    text = text[:m.start()] + replacement + text[m.end():]

out.write_text(text, encoding="utf-8")

print(f"Created: {out}")
print(f"Updated {len(replacements)} city entries.")
