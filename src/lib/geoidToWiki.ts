import type { SliceType } from '../types/database'

/** Maps 2-digit state FIPS codes to full state names for Wikipedia lookups */
const STATE_FIPS: Record<string, string> = {
  '01': 'Alabama',
  '02': 'Alaska',
  '04': 'Arizona',
  '05': 'Arkansas',
  '06': 'California',
  '08': 'Colorado',
  '09': 'Connecticut',
  '10': 'Delaware',
  '11': 'District of Columbia',
  '12': 'Florida',
  '13': 'Georgia',
  '15': 'Hawaii',
  '16': 'Idaho',
  '17': 'Illinois',
  '18': 'Indiana',
  '19': 'Iowa',
  '20': 'Kansas',
  '21': 'Kentucky',
  '22': 'Louisiana',
  '23': 'Maine',
  '24': 'Maryland',
  '25': 'Massachusetts',
  '26': 'Michigan',
  '27': 'Minnesota',
  '28': 'Mississippi',
  '29': 'Missouri',
  '30': 'Montana',
  '31': 'Nebraska',
  '32': 'Nevada',
  '33': 'New Hampshire',
  '34': 'New Jersey',
  '35': 'New Mexico',
  '36': 'New York',
  '37': 'North Carolina',
  '38': 'North Dakota',
  '39': 'Ohio',
  '40': 'Oklahoma',
  '41': 'Oregon',
  '42': 'Pennsylvania',
  '44': 'Rhode Island',
  '45': 'South Carolina',
  '46': 'South Dakota',
  '47': 'Tennessee',
  '48': 'Texas',
  '49': 'Utah',
  '50': 'Vermont',
  '51': 'Virginia',
  '53': 'Washington',
  '54': 'West Virginia',
  '55': 'Wisconsin',
  '56': 'Wyoming',
}

/**
 * Maps 3-digit county FIPS suffix (within Indiana, state FIPS '18') to county name.
 * Used for local-type slices with 5-digit county FIPS geoids.
 */
const INDIANA_COUNTIES: Record<string, string> = {
  '001': 'Adams',
  '003': 'Allen',
  '005': 'Bartholomew',
  '007': 'Benton',
  '009': 'Blackford',
  '011': 'Boone',
  '013': 'Brown',
  '015': 'Carroll',
  '017': 'Cass',
  '019': 'Clark',
  '021': 'Clay',
  '023': 'Clinton',
  '025': 'Crawford',
  '027': 'Daviess',
  '029': 'Dearborn',
  '031': 'Decatur',
  '033': 'DeKalb',
  '035': 'Delaware',
  '037': 'Dubois',
  '039': 'Elkhart',
  '041': 'Fayette',
  '043': 'Floyd',
  '045': 'Fountain',
  '047': 'Franklin',
  '049': 'Fulton',
  '051': 'Gibson',
  '053': 'Grant',
  '055': 'Greene',
  '057': 'Hamilton',
  '059': 'Hancock',
  '061': 'Harrison',
  '063': 'Hendricks',
  '065': 'Henry',
  '067': 'Howard',
  '069': 'Huntington',
  '071': 'Jackson',
  '073': 'Jasper',
  '075': 'Jay',
  '077': 'Jefferson',
  '079': 'Jennings',
  '081': 'Johnson',
  '083': 'Knox',
  '085': 'Kosciusko',
  '087': 'LaGrange',
  '089': 'Lake',
  '091': 'LaPorte',
  '093': 'Lawrence',
  '095': 'Madison',
  '097': 'Monroe',
  '099': 'Montgomery',
  '101': 'Morgan',
  '103': 'Newton',
  '105': 'Noble',
  '107': 'Ohio',
  '109': 'Orange',
  '111': 'Owen',
  '113': 'Parke',
  '115': 'Perry',
  '117': 'Pike',
  '119': 'Porter',
  '121': 'Posey',
  '123': 'Pulaski',
  '125': 'Putnam',
  '127': 'Randolph',
  '129': 'Ripley',
  '131': 'Rush',
  '133': 'St. Joseph',
  '135': 'Scott',
  '137': 'Shelby',
  '139': 'Spencer',
  '141': 'Starke',
  '143': 'Steuben',
  '145': 'Sullivan',
  '147': 'Switzerland',
  '149': 'Tippecanoe',
  '151': 'Tipton',
  '153': 'Union',
  '155': 'Vanderburgh',
  '157': 'Vermillion',
  '159': 'Vigo',
  '161': 'Wabash',
  '163': 'Warren',
  '165': 'Warrick',
  '167': 'Washington',
  '169': 'Wayne',
  '171': 'Wells',
  '173': 'White',
  '175': 'Whitley',
}

/**
 * Combined county lookup keyed as '{stateFips}-{countyFips}'.
 * Currently covers Indiana; extend by adding other states' county maps here.
 */
const COUNTY_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(INDIANA_COUNTIES).map(([countyFips, name]) => [`18-${countyFips}`, name])
)

/**
 * Resolves a Wikipedia article title for the given slice type and geoid.
 *
 * - federal/state: returns the state name (from first 2 FIPS digits)
 * - local (5-digit county FIPS): returns '{County} County, {State}'
 * - neighborhood/unified/volunteer: returns null (use sliceCopy defaultPhoto)
 *
 * Returns null if no mapping is found (Wikipedia fetch will be skipped).
 */
export function geoidToWikiTitle(sliceType: SliceType, geoid: string): string | null {
  const stateFips = geoid.slice(0, 2)
  const stateName = STATE_FIPS[stateFips] ?? null

  switch (sliceType) {
    case 'federal':
    case 'state':
      return stateName

    case 'local': {
      if (geoid.length !== 5) return stateName
      const countyFips = geoid.slice(2)
      const countyKey = `${stateFips}-${countyFips}`
      const countyName = COUNTY_NAMES[countyKey]
      if (!countyName || !stateName) return stateName
      return `${countyName} County, ${stateName}`
    }

    case 'neighborhood':
    case 'unified':
    case 'volunteer':
    default:
      return null
  }
}
