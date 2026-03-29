/**
 * Seed Supabase with Elihu’s trips (connections insert is commented out).
 * Fetches all profiles, builds name → uuid idMap; validates `ADJACENCY_LIST`.
 *
 * Expected tables (run in SQL editor if missing):
 *
 * create table profiles (
 *   id uuid primary key default gen_random_uuid(),
 *   name text not null,
 *   university text not null,
 *   city text not null,
 *   state text not null,
 *   role text not null,
 *   gender_preference text,
 *   willing_to_pay boolean default false,
 *   willing_to_charge boolean default false,
 *   availability text
 * );
 *
 * create table connections (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid not null references profiles(id) on delete cascade,
 *   friend_id uuid not null references profiles(id) on delete cascade,
 *   degree integer not null,
 *   unique(user_id, friend_id)
 * );
 *
 * create table trips (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid not null references profiles(id) on delete cascade,
 *   destination_city text not null,
 *   destination_state text not null,
 *   date_from date not null,
 *   date_to date not null,
 *   status text not null
 * );
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mfvyjksetlmzfxrviadq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdnlqa3NldGxtemZ4cnZpYWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDkyNzAsImV4cCI6MjA5MDI4NTI3MH0.jHXUbbZ85beSAMpXjaVqLGnL__27CbkJDIkdBJfZ6cU';

/** Index 0 is always Elihu Yale (demo user). Order matches insert order. */
const PROFILES = [
  {
    name: 'Elihu Yale',
    university: 'Yale University',
    city: 'New Haven',
    state: 'CT',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Weekends, fall break, summer sublets',
  },
  {
    name: 'James Whitfield',
    university: 'Yale University',
    city: 'New Haven',
    state: 'CT',
    role: 'host',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Winter break; spring semester Fri–Sun',
  },
  {
    name: 'Priya Nair',
    university: 'Yale University',
    city: 'New Haven',
    state: 'CT',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Thanksgiving, January term',
  },
  {
    name: 'Zoe Martinez',
    university: 'New York University',
    city: 'New York',
    state: 'NY',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Reading week, summer internship housing',
  },
  {
    name: 'Alex Kim',
    university: 'New York University',
    city: 'New York',
    state: 'NY',
    role: 'guest',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'March spring break only',
  },
  {
    name: 'Jordan Blake',
    university: 'New York University',
    city: 'New York',
    state: 'NY',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Sofa crash OK most weekends',
  },
  {
    name: 'Taylor Reed',
    university: 'Columbia University',
    city: 'New York',
    state: 'NY',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Intercession, May',
  },
  {
    name: 'Morgan Liu',
    university: 'Columbia University',
    city: 'New York',
    state: 'NY',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Short trips 2–4 nights',
  },
  {
    name: 'Samuel Okonkwo',
    university: 'Harvard University',
    city: 'Cambridge',
    state: 'MA',
    role: 'both',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Harvard–Yale weekend, J-term',
  },
  {
    name: 'Emily Foster',
    university: 'Harvard University',
    city: 'Cambridge',
    state: 'MA',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'June–August sublet swaps',
  },
  {
    name: 'David Park',
    university: 'MIT',
    city: 'Cambridge',
    state: 'MA',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Hacks, IAP couch',
  },
  {
    name: 'Nina Shah',
    university: 'MIT',
    city: 'Cambridge',
    state: 'MA',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Conference weeks',
  },
  {
    name: 'Chris Ramirez',
    university: 'Stanford University',
    city: 'Stanford',
    state: 'CA',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Thanksgiving flyover friends',
  },
  {
    name: 'Olivia Bennett',
    university: 'Stanford University',
    city: 'Stanford',
    state: 'CA',
    role: 'host',
    gender_preference: 'same',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Most of summer',
  },
  {
    name: 'Ryan Sullivan',
    university: 'University of Michigan',
    city: 'Ann Arbor',
    state: 'MI',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Big Ten away games, spring break',
  },
  {
    name: 'Ashley Davis',
    university: 'University of Michigan',
    city: 'Ann Arbor',
    state: 'MI',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Fall break',
  },
  {
    name: 'Brandon Cole',
    university: 'Duke University',
    city: 'Durham',
    state: 'NC',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'March Madness adjacent',
  },
  {
    name: 'Kayla Brooks',
    university: 'Duke University',
    city: 'Durham',
    state: 'NC',
    role: 'guest',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'NCAA tournament travel',
  },
  {
    name: 'Ethan Morales',
    university: 'Princeton University',
    city: 'Princeton',
    state: 'NJ',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Dean’s date week crash',
  },
  {
    name: 'Hannah Ng',
    university: 'Princeton University',
    city: 'Princeton',
    state: 'NJ',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Winter recess',
  },
  {
    name: 'Lucas Wright',
    university: 'University of Chicago',
    city: 'Chicago',
    state: 'IL',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Scav hunt week, summer',
  },
  {
    name: 'Mia Torres',
    university: 'University of Chicago',
    city: 'Chicago',
    state: 'IL',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Midwest long weekends',
  },
  {
    name: 'Noah Patel',
    university: 'University of Pennsylvania',
    city: 'Philadelphia',
    state: 'PA',
    role: 'both',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Penn–Princeton transit corridor',
  },
  {
    name: 'Grace Lin',
    university: 'University of Pennsylvania',
    city: 'Philadelphia',
    state: 'PA',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Philly internship summers',
  },
  {
    name: 'Caleb Brooks',
    university: 'Cornell University',
    city: 'Ithaca',
    state: 'NY',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Slope Day adjacent',
  },
  {
    name: 'Nora Ibrahim',
    university: 'Cornell University',
    city: 'Ithaca',
    state: 'NY',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Winter carnival',
  },
  {
    name: 'Owen Hardy',
    university: 'Dartmouth College',
    city: 'Hanover',
    state: 'NH',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Ski season weekends',
  },
  {
    name: 'Ivy Chen',
    university: 'Dartmouth College',
    city: 'Hanover',
    state: 'NH',
    role: 'guest',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Spring ski trip',
  },
  {
    name: 'Sam Rivera',
    university: 'Brown University',
    city: 'Providence',
    state: 'RI',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Spring Weekend',
  },
  {
    name: 'Riley Olsen',
    university: 'Brown University',
    city: 'Providence',
    state: 'RI',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Providence summer',
  },
  {
    name: 'Drew Washington',
    university: 'Georgetown University',
    city: 'Washington',
    state: 'DC',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Inauguration week, internships',
  },
  {
    name: 'Jamie Okoro',
    university: 'Georgetown University',
    city: 'Washington',
    state: 'DC',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'DC policy summers',
  },
  {
    name: 'Tara Singh',
    university: 'UCLA',
    city: 'Los Angeles',
    state: 'CA',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Winter break (LA home)',
  },
  {
    name: 'Devon Hayes',
    university: 'UCLA',
    city: 'Los Angeles',
    state: 'CA',
    role: 'guest',
    gender_preference: 'same',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Coachella week split',
  },
  {
    name: 'Casey Murphy',
    university: 'Northwestern University',
    city: 'Evanston',
    state: 'IL',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Dillo Day, Chicago interviews',
  },
  {
    name: 'Reese Walker',
    university: 'Northwestern University',
    city: 'Evanston',
    state: 'IL',
    role: 'host',
    gender_preference: 'any',
    willing_to_pay: false,
    willing_to_charge: true,
    availability: 'Lakefill summer',
  },
  {
    name: 'Quinn Foster',
    university: 'Vanderbilt University',
    city: 'Nashville',
    state: 'TN',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Rites of Spring, CMA fest',
  },
  {
    name: 'Avery Scott',
    university: 'Vanderbilt University',
    city: 'Nashville',
    state: 'TN',
    role: 'guest',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: false,
    availability: 'Music industry summers',
  },
  {
    name: "Charlie O'Neill",
    university: 'Boston University',
    city: 'Boston',
    state: 'MA',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Siblings in NYC — flexible East Coast',
  },
  {
    name: 'Riley Nakamura',
    university: 'UC Berkeley',
    city: 'Berkeley',
    state: 'CA',
    role: 'both',
    gender_preference: 'any',
    willing_to_pay: true,
    willing_to_charge: true,
    availability: 'Bay Area startup summers',
  },
];

const ELIHU_NAME = 'Elihu Yale';

/**
 * Undirected social graph: every key is a `PROFILES[].name`, every neighbor string
 * is also a real profile name. Symmetric (if A lists B, B lists A).
 * Seed inserts one directed row per listed edge with degree = 1.
 */
const ADJACENCY_LIST = {
  'Elihu Yale': [
    'James Whitfield',
    'Zoe Martinez',
    'Taylor Reed',
    'Samuel Okonkwo',
    'Chris Ramirez',
    'Ryan Sullivan',
  ],
  'James Whitfield': [
    'Elihu Yale',
    'Priya Nair',
    'Alex Kim',
    'David Park',
    'Brandon Cole',
  ],
  'Priya Nair': ['James Whitfield'],
  'Zoe Martinez': [
    'Elihu Yale',
    'Jordan Blake',
    'Morgan Liu',
    'Ethan Morales',
    'Noah Patel',
  ],
  'Alex Kim': ['James Whitfield', 'Taylor Reed', 'Grace Lin'],
  'Jordan Blake': ['Zoe Martinez', 'Ivy Chen'],
  'Taylor Reed': [
    'Elihu Yale',
    'Morgan Liu',
    'Alex Kim',
    'Owen Hardy',
    'Drew Washington',
  ],
  'Morgan Liu': [
    'Zoe Martinez',
    'Taylor Reed',
    'Nora Ibrahim',
    'Jamie Okoro',
  ],
  'Samuel Okonkwo': [
    'Elihu Yale',
    'Emily Foster',
    'Nina Shah',
    'Lucas Wright',
    'Caleb Brooks',
  ],
  'Emily Foster': ['Samuel Okonkwo', 'Kayla Brooks'],
  'David Park': ['James Whitfield', 'Riley Nakamura'],
  'Nina Shah': ['Samuel Okonkwo', 'Mia Torres', 'Avery Scott'],
  'Chris Ramirez': [
    'Elihu Yale',
    'Olivia Bennett',
    'Tara Singh',
    'Quinn Foster',
    "Charlie O'Neill",
  ],
  'Olivia Bennett': ['Chris Ramirez', 'Devon Hayes', 'Reese Walker'],
  'Ryan Sullivan': [
    'Elihu Yale',
    'Ashley Davis',
    'Hannah Ng',
    'Sam Rivera',
    'Casey Murphy',
  ],
  'Ashley Davis': ['Ryan Sullivan', 'Riley Olsen'],
  'Brandon Cole': ['James Whitfield', 'Kayla Brooks'],
  'Kayla Brooks': ['Brandon Cole', 'Emily Foster'],
  'Ethan Morales': ['Zoe Martinez'],
  'Hannah Ng': ['Ryan Sullivan'],
  'Lucas Wright': ['Samuel Okonkwo', 'Mia Torres'],
  'Mia Torres': ['Lucas Wright', 'Nina Shah'],
  'Noah Patel': ['Zoe Martinez', 'Grace Lin'],
  'Grace Lin': ['Noah Patel', 'Alex Kim'],
  'Caleb Brooks': ['Samuel Okonkwo', 'Nora Ibrahim'],
  'Nora Ibrahim': ['Caleb Brooks', 'Morgan Liu'],
  'Owen Hardy': ['Taylor Reed', 'Ivy Chen'],
  'Ivy Chen': ['Owen Hardy', 'Jordan Blake'],
  'Sam Rivera': ['Ryan Sullivan', 'Riley Olsen'],
  'Riley Olsen': ['Sam Rivera', 'Ashley Davis'],
  'Drew Washington': ['Taylor Reed', 'Jamie Okoro'],
  'Jamie Okoro': ['Drew Washington', 'Morgan Liu'],
  'Tara Singh': ['Chris Ramirez', 'Devon Hayes'],
  'Devon Hayes': ['Tara Singh', 'Olivia Bennett'],
  'Casey Murphy': ['Ryan Sullivan', 'Reese Walker'],
  'Reese Walker': ['Casey Murphy', 'Olivia Bennett'],
  'Quinn Foster': ['Chris Ramirez', 'Avery Scott'],
  'Avery Scott': ['Quinn Foster', 'Nina Shah'],
  "Charlie O'Neill": ['Chris Ramirez', 'Riley Nakamura'],
  'Riley Nakamura': ["Charlie O'Neill", 'David Park'],
};

/** Every key / neighbor must appear in PROFILES; lists must be symmetric. */
function validateAdjacencyAgainstProfiles(adj, profiles) {
  const allowed = new Set(profiles.map((p) => p.name));
  for (const name of Object.keys(adj)) {
    if (!allowed.has(name)) {
      throw new Error(`Adjacency key not in PROFILES: "${name}"`);
    }
    const nbrs = adj[name];
    if (!Array.isArray(nbrs)) {
      throw new Error(`Adjacency["${name}"] must be an array`);
    }
    for (const n of nbrs) {
      if (!allowed.has(n)) {
        throw new Error(`Neighbor "${n}" of "${name}" not in PROFILES`);
      }
      if (n === name) {
        throw new Error(`Self-edge not allowed: "${name}"`);
      }
      const back = adj[n];
      if (!back || !back.includes(name)) {
        throw new Error(
          `Asymmetric edge: "${name}" → "${n}" but "${n}" does not list "${name}"`,
        );
      }
    }
  }
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfUtcDate(d) {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  );
}

/** Next calendar Friday strictly after `from` (local date). */
function nextFridayAfter(from = new Date()) {
  let d = startOfUtcDate(from);
  d = addDays(d, 1);
  while (d.getDay() !== 5) d = addDays(d, 1);
  return d;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    console.log('Fetching all profiles (id, name)…');
    const { data: profiles, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, name');
    if (fetchErr) throw fetchErr;

    const idMap = {};
    (profiles ?? []).forEach((p) => {
      idMap[p.name] = p.id;
    });
    console.log(`Loaded ${Object.keys(idMap).length} profiles into idMap.`);

    validateAdjacencyAgainstProfiles(ADJACENCY_LIST, PROFILES);

    // // Build connections from adjacency list (degree 1 for every edge).
    // const connectionRows = [];
    // for (const [personName, friends] of Object.entries(ADJACENCY_LIST)) {
    //   const personId = idMap[personName];
    //   if (!personId) {
    //     console.log('Missing:', personName);
    //     continue;
    //   }
    //   for (const friendName of friends) {
    //     const friendId = idMap[friendName];
    //     if (!friendId) {
    //       console.log('Missing:', friendName);
    //       continue;
    //     }
    //     connectionRows.push({
    //       user_id: personId,
    //       friend_id: friendId,
    //       degree: 1,
    //     });
    //   }
    // }
    // console.log('Built', connectionRows.length, 'connection rows');
    // const { error: connError } = await supabase
    //   .from('connections')
    //   .insert(connectionRows);
    // if (connError) throw connError;
    // console.log('Connections inserted successfully');

    const elihuId = idMap[ELIHU_NAME];
    if (!elihuId) {
      throw new Error(`Missing profile for "${ELIHU_NAME}" (trips + graph root).`);
    }
    const fri = nextFridayAfter(new Date());
    const sun = addDays(fri, 2);
    const bostonStart = addDays(startOfUtcDate(new Date()), 14);
    const bostonEnd = addDays(bostonStart, 3);

    const trips = [
      {
        user_id: elihuId,
        destination_city: 'New York',
        destination_state: 'NY',
        date_from: toISODate(fri),
        date_to: toISODate(sun),
        status: 'searching',
      },
      {
        user_id: elihuId,
        destination_city: 'Boston',
        destination_state: 'MA',
        date_from: toISODate(bostonStart),
        date_to: toISODate(bostonEnd),
        status: 'confirmed',
      },
    ];

    console.log('Inserting trips for Elihu…');
    const { error: tErr } = await supabase.from('trips').insert(trips);
    if (tErr) throw tErr;
    console.log('Inserted 2 trips.');
    console.log('Seed complete.');
  } catch (e) {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  }
}

main();
