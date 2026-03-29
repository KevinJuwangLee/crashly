/**
 * Build symmetric degree-2 connection rows from existing degree-1 edges.
 * Run: node scripts/seedDegree2.js
 *
 * Requires @supabase/supabase-js (see package.json).
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mfvyjksetlmzfxrviadq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdnlqa3NldGxtemZ4cnZpYWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDkyNzAsImV4cCI6MjA5MDI4NTI3MH0.jHXUbbZ85beSAMpXjaVqLGnL__27CbkJDIkdBJfZ6cU';

const PAGE_SIZE = 1000;
const INSERT_CHUNK = 500;

async function fetchAllDegree1(supabase) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('connections')
      .select('user_id, friend_id')
      .eq('degree', 1)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function buildAdjacency(deg1Rows) {
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  for (const { user_id: u, friend_id: f } of deg1Rows) {
    if (!u || !f) continue;
    if (!adj.has(u)) adj.set(u, new Set());
    adj.get(u).add(f);
  }
  return adj;
}

function collectAllUserIds(deg1Rows) {
  const ids = new Set();
  for (const { user_id: u, friend_id: f } of deg1Rows) {
    if (u) ids.add(u);
    if (f) ids.add(f);
  }
  return ids;
}

function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return (async () => {
    console.log('Fetching degree-1 connections…');
    const deg1Rows = await fetchAllDegree1(supabase);
    console.log(`Loaded ${deg1Rows.length} degree-1 rows.`);

    const adj = buildAdjacency(deg1Rows);
    const allUsers = collectAllUserIds(deg1Rows);

    /** @type {Set<string>} unordered pair A|C with A < C lexicographically */
    const seenUnorderedPair = new Set();
    /** @type {Set<string>} directed key user_id|friend_id */
    const seenDirected = new Set();
    /** @type {{ user_id: string, friend_id: string, degree: number }[]} */
    const insertRows = [];

    function addDirected(user_id, friend_id) {
      const k = `${user_id}|${friend_id}`;
      if (seenDirected.has(k)) return;
      seenDirected.add(k);
      insertRows.push({ user_id, friend_id, degree: 2 });
    }

    for (const A of allUsers) {
      const friendsA = adj.get(A);
      if (!friendsA || friendsA.size === 0) continue;

      for (const B of friendsA) {
        const friendsB = adj.get(B);
        if (!friendsB || friendsB.size === 0) continue;

        for (const C of friendsB) {
          if (C === A) continue;
          if (friendsA.has(C)) continue;

          const uKey = A < C ? `${A}|${C}` : `${C}|${A}`;
          if (seenUnorderedPair.has(uKey)) continue;
          seenUnorderedPair.add(uKey);

          addDirected(A, C);
          addDirected(C, A);
        }
      }
    }

    console.log(`Prepared ${insertRows.length} directed degree-2 rows to insert.`);

    let inserted = 0;
    for (let i = 0; i < insertRows.length; i += INSERT_CHUNK) {
      const chunk = insertRows.slice(i, i + INSERT_CHUNK);
      const { error } = await supabase.from('connections').insert(chunk);
      if (error) {
        console.error('Insert error:', error.message);
        process.exitCode = 1;
        return;
      }
      inserted += chunk.length;
    }

    console.log(`Inserted ${inserted} degree-2 edges (directed rows).`);
  })();
}

main();
