/**
 * Continent and Region Constants
 *
 * Used for filtering opportunities by geographic region.
 */

export const AFRICAN_COUNTRIES = [
	"Algeria",
	"Angola",
	"Benin",
	"Botswana",
	"Burkina Faso",
	"Burundi",
	"Cabo Verde",
	"Cape Verde",
	"Cameroon",
	"Central African Republic",
	"Chad",
	"Comoros",
	"Congo",
	"Democratic Republic of the Congo",
	"DRC",
	"Cote d'Ivoire",
	"Ivory Coast",
	"Djibouti",
	"Egypt",
	"Equatorial Guinea",
	"Eritrea",
	"Eswatini",
	"Swaziland",
	"Ethiopia",
	"Gabon",
	"Gambia",
	"Ghana",
	"Guinea",
	"Guinea-Bissau",
	"Kenya",
	"Lesotho",
	"Liberia",
	"Libya",
	"Madagascar",
	"Malawi",
	"Mali",
	"Mauritania",
	"Mauritius",
	"Morocco",
	"Mozambique",
	"Namibia",
	"Niger",
	"Nigeria",
	"Rwanda",
	"Sao Tome and Principe",
	"Senegal",
	"Seychelles",
	"Sierra Leone",
	"Somalia",
	"South Africa",
	"South Sudan",
	"Sudan",
	"Tanzania",
	"Togo",
	"Tunisia",
	"Uganda",
	"Zambia",
	"Zimbabwe",
	// Common variations
	"Africa",
	"Sub-Saharan Africa",
	"East Africa",
	"West Africa",
	"North Africa",
	"Southern Africa",
	"Central Africa",
];

export const CONTINENT_FILTERS = {
	africa: {
		label: "Africa",
		countries: AFRICAN_COUNTRIES,
	},
	asia: {
		label: "Asia",
		countries: [
			"Afghanistan", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China",
			"India", "Indonesia", "Japan", "Kazakhstan", "Kyrgyzstan", "Laos",
			"Malaysia", "Maldives", "Mongolia", "Myanmar", "Nepal", "North Korea",
			"Pakistan", "Philippines", "Singapore", "South Korea", "Sri Lanka",
			"Taiwan", "Tajikistan", "Thailand", "Timor-Leste", "Turkmenistan",
			"Uzbekistan", "Vietnam", "Asia", "Southeast Asia", "South Asia",
			"Central Asia", "East Asia",
		],
	},
	europe: {
		label: "Europe",
		countries: [
			"Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
			"Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia",
			"Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland",
			"Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
			"Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia",
			"Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia",
			"Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine",
			"United Kingdom", "UK", "Vatican City", "Europe", "EU", "European Union",
			"Western Europe", "Eastern Europe",
		],
	},
	americas: {
		label: "Americas",
		countries: [
			"Argentina", "Bahamas", "Barbados", "Belize", "Bolivia", "Brazil",
			"Canada", "Chile", "Colombia", "Costa Rica", "Cuba", "Dominican Republic",
			"Ecuador", "El Salvador", "Guatemala", "Guyana", "Haiti", "Honduras",
			"Jamaica", "Mexico", "Nicaragua", "Panama", "Paraguay", "Peru",
			"Suriname", "Trinidad and Tobago", "United States", "USA", "US",
			"Uruguay", "Venezuela", "Americas", "North America", "South America",
			"Central America", "Latin America", "Caribbean",
		],
	},
	middleEast: {
		label: "Middle East",
		countries: [
			"Bahrain", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon",
			"Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey",
			"United Arab Emirates", "UAE", "Yemen", "Middle East", "MENA", "Gulf",
		],
	},
	oceania: {
		label: "Oceania",
		countries: [
			"Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia",
			"Nauru", "New Zealand", "Palau", "Papua New Guinea", "Samoa",
			"Solomon Islands", "Tonga", "Tuvalu", "Vanuatu", "Oceania", "Pacific",
		],
	},
} as const;

export type ContinentKey = keyof typeof CONTINENT_FILTERS;

/**
 * Check if a country/region string matches a continent
 */
export function matchesContinent(countryRegion: string | null | undefined, continent: ContinentKey): boolean {
	if (!countryRegion) return false;
	const normalized = countryRegion.toLowerCase();
	return CONTINENT_FILTERS[continent].countries.some(
		(c) => normalized.includes(c.toLowerCase()) || c.toLowerCase().includes(normalized)
	);
}
