import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are a warm friendly housing agent for college students. Rank these direct connections by compatibility with the user then by rating. Consider: does willing_to_charge match user_willing_to_pay? Does gender_preference match? Does availability fit the trip dates? Do the user preferences match what the host offers? Write a warm 1 sentence summary for each. Return ONLY a valid JSON array with no extra text, with fields: name, university, rating, trust_score (1-10), compatibility_score (1-10), summary, willing_to_charge, availability, is_good_match (boolean)`;

const SYSTEM_PROMPT_DEGREE2 =
  "You are a warm friendly housing agent. These are second degree connections — people the user does not know directly. For each one write a short teaser (1 sentence) hinting at what they might offer without being too specific. Do not reveal their full name in the teaser. Rank by compatibility then rating. Return ONLY valid JSON array with fields: name, university, rating, trust_score (1-10), compatibility_score (1-10), teaser_summary, via_friend, willing_to_charge, requires_permission (always true)";

type FindHousingBody = {
  user_id?: number | string;
  degree?: number | string;
  destination_city?: string;
  destination_state?: string;
  date_from?: string;
  date_to?: string;
  preferences?: string;
  user_willing_to_pay?: boolean;
  user_gender_preference?: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  university: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  role: string | null;
  willing_to_charge: boolean | null;
  availability: string | null;
  gender_preference: string | null;
};

type Degree2LocalProfile = ProfileRow & { via_friend: string };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

function normalizeLoc(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/** Parse Claude's text block into a JSON array (handles optional markdown fence). */
function parseClaudeJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const raw = (fence ? fence[1] : trimmed).trim();
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Claude response is not a JSON array');
  }
  return parsed;
}

async function callClaude(
  anthropicKey: string,
  system: string,
  userMessage: string,
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    } as Record<string, string>,
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return { ok: false, status: claudeRes.status, body: errText };
  }

  const claudeJson = (await claudeRes.json()) as {
    content?: { type: string; text?: string }[];
  };

  const textBlock = claudeJson.content?.find((c) => c.type === 'text');
  const text = textBlock?.text?.trim();
  if (!text) {
    return { ok: false, status: 502, body: 'missing text' };
  }

  return { ok: true, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return errorResponse('Server configuration error', 500);
  }

  if (!anthropicKey) {
    return errorResponse('Missing API key', 500);
  }

  let body: FindHousingBody;
  try {
    body = (await req.json()) as FindHousingBody;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (body.user_id === undefined || body.user_id === null) {
    return errorResponse('user_id is required', 400);
  }
  const userId = Number(body.user_id);
  if (!Number.isFinite(userId)) {
    return errorResponse('user_id must be a finite number', 400);
  }

  const degreeNum =
    body.degree === undefined || body.degree === null
      ? 1
      : Number(body.degree);
  if (!Number.isInteger(degreeNum) || (degreeNum !== 1 && degreeNum !== 2)) {
    return errorResponse('degree must be 1 or 2', 400);
  }

  const destinationCity = body.destination_city?.trim();
  const destinationState = body.destination_state?.trim();

  if (!destinationCity || !destinationState) {
    return errorResponse('destination_city and destination_state are required', 400);
  }

  const tripPayload = {
    destination_city: destinationCity,
    destination_state: destinationState,
    date_from: body.date_from ?? '',
    date_to: body.date_to ?? '',
    preferences: body.preferences ?? '',
    user_willing_to_pay: body.user_willing_to_pay ?? false,
    user_gender_preference: body.user_gender_preference ?? '',
  };

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (degreeNum === 1) {
      const { data: connectionRows, error: connError } = await supabase
        .from('connections')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('degree', 1);

      if (connError) {
        console.error('connections query:', connError.message);
        return errorResponse('Failed to load connections', 500);
      }

      const friendIds = [
        ...new Set(
          (connectionRows ?? [])
            .map((r: { friend_id: string }) => r.friend_id)
            .filter(Boolean),
        ),
      ];

      let degree1Results: unknown[] = [];

      if (friendIds.length === 0) {
        degree1Results = [];
      } else {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, name, university, city, state, rating, role, willing_to_charge, availability, gender_preference',
          )
          .in('id', friendIds);

        if (profileError) {
          console.error('profiles query:', profileError.message);
          return errorResponse('Failed to load profiles', 500);
        }

        const wantCity = normalizeLoc(destinationCity);
        const wantState = normalizeLoc(destinationState);

        const localProfiles = (profileRows ?? []).filter((p: ProfileRow) => {
          return (
            normalizeLoc(p.city ?? '') === wantCity &&
            normalizeLoc(p.state ?? '') === wantState
          );
        });

        if (localProfiles.length === 0) {
          degree1Results = [];
        } else {
          const userMessage = JSON.stringify({
            trip: tripPayload,
            connections: localProfiles,
          });

          const claudeRes = await fetch(
            'https://api.anthropic.com/v1/messages',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
              } as Record<string, string>,
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 8192,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userMessage }],
              }),
            },
          );

          if (!claudeRes.ok) {
            const errText = await claudeRes.text();
            console.error('Anthropic API error:', claudeRes.status, errText);
            return errorResponse('Ranking service temporarily unavailable', 502);
          }

          const claudeJson = (await claudeRes.json()) as {
            content?: { type: string; text?: string }[];
          };

          const textBlock = claudeJson.content?.find((c) => c.type === 'text');
          const text = textBlock?.text?.trim();
          if (!text) {
            console.error('Claude response missing text content', claudeJson);
            return errorResponse('Invalid response from ranking service', 502);
          }

          try {
            degree1Results = parseClaudeJsonArray(text);
          } catch (e) {
            console.error('Failed to parse Claude JSON:', e, text.slice(0, 500));
            return errorResponse('Could not parse ranking results', 502);
          }
        }
      }

      return jsonResponse({ ok: true, degree1Results });
    }

    const { data: deg1ForBridge, error: deg1BridgeErr } = await supabase
      .from('connections')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('degree', 1);

    if (deg1BridgeErr) {
      console.error('connections query (degree-1 for bridge):', deg1BridgeErr.message);
      return errorResponse('Failed to load connections', 500);
    }

    const friendIds = [
      ...new Set(
        (deg1ForBridge ?? [])
          .map((r: { friend_id: string }) => r.friend_id)
          .filter(Boolean),
      ),
    ];
    const friendIdSet = new Set(friendIds);

    const { data: deg2ConnRows, error: deg2ConnError } = await supabase
      .from('connections')
      .select('friend_id')
      .eq('user_id', userId)
      .eq('degree', 2);

    if (deg2ConnError) {
      console.error('degree-2 connections query:', deg2ConnError.message);
      return errorResponse('Failed to load degree-2 connections', 500);
    }

    const deg2FriendIds = [
      ...new Set(
        (deg2ConnRows ?? [])
          .map((r: { friend_id: string }) => r.friend_id)
          .filter(Boolean),
      ),
    ];

    let degree2Results: unknown[] = [];

    if (deg2FriendIds.length > 0 && friendIds.length > 0) {
      const { data: deg2ProfileRows, error: deg2ProfileError } = await supabase
        .from('profiles')
        .select(
          'id, name, university, city, state, rating, role, willing_to_charge, availability, gender_preference',
        )
        .in('id', deg2FriendIds);

      if (deg2ProfileError) {
        console.error('degree-2 profiles query:', deg2ProfileError.message);
        return errorResponse('Failed to load degree-2 profiles', 500);
      }

      const wantCity = normalizeLoc(destinationCity);
      const wantState = normalizeLoc(destinationState);

      const deg2InDestination = (deg2ProfileRows ?? []).filter(
        (p: ProfileRow) =>
          normalizeLoc(p.city ?? '') === wantCity &&
          normalizeLoc(p.state ?? '') === wantState,
      );

      const d2Ids = deg2InDestination.map((p) => p.id).filter(Boolean);

      if (d2Ids.length > 0) {
        const { data: bridgeRows, error: bridgeError } = await supabase
          .from('connections')
          .select('friend_id, user_id')
          .in('friend_id', d2Ids)
          .eq('degree', 1);

        if (bridgeError) {
          console.error('bridge connections query:', bridgeError.message);
          return errorResponse('Failed to load bridge connections', 500);
        }

        const bridgesByFriend = new Map<string, string[]>();
        for (const row of bridgeRows ?? []) {
          const fid = (row as { friend_id: string; user_id: string })
            .friend_id;
          const uid = (row as { friend_id: string; user_id: string }).user_id;
          if (!fid || !uid) continue;
          const list = bridgesByFriend.get(fid) ?? [];
          list.push(uid);
          bridgesByFriend.set(fid, list);
        }

        const pendingBridge: { profile: ProfileRow; bridgeUserId: string }[] =
          [];

        for (const p of deg2InDestination) {
          const candidates = bridgesByFriend.get(p.id) ?? [];
          const inElihuCircle = candidates.filter((uid) =>
            friendIdSet.has(uid),
          );
          if (inElihuCircle.length === 0) continue;
          inElihuCircle.sort();
          const bridgeUserId = inElihuCircle[0]!;
          pendingBridge.push({ profile: p, bridgeUserId });
        }

        let withVia: Degree2LocalProfile[] = [];

        if (pendingBridge.length > 0) {
          const bridgeUserIdsNeeded = [
            ...new Set(pendingBridge.map((x) => x.bridgeUserId)),
          ];

          const { data: bridgeProfiles, error: bpErr } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', bridgeUserIdsNeeded);

          if (bpErr) {
            console.error('bridge profiles query:', bpErr.message);
            return errorResponse('Failed to load bridge profiles', 500);
          }

          const idToName = new Map<string, string>();
          for (const bp of bridgeProfiles ?? []) {
            const row = bp as { id: string; name: string | null };
            idToName.set(row.id, row.name ?? 'Friend');
          }

          withVia = pendingBridge.map(({ profile, bridgeUserId }) => ({
            ...profile,
            via_friend: idToName.get(bridgeUserId) ?? 'Friend',
          }));
        }

        const groupedByVia: Record<string, Degree2LocalProfile[]> = {};
        for (const row of withVia) {
          const key = row.via_friend;
          if (!groupedByVia[key]) groupedByVia[key] = [];
          groupedByVia[key].push(row);
        }

        const degree2LocalProfiles = Object.entries(groupedByVia).map(
          ([via_friend, profiles]) => ({
            via_friend,
            profiles,
          }),
        );

        if (degree2LocalProfiles.length > 0) {
          const deg2UserMessage = JSON.stringify({
            trip: tripPayload,
            connections: degree2LocalProfiles,
          });

          const claude2 = await callClaude(
            anthropicKey,
            SYSTEM_PROMPT_DEGREE2,
            deg2UserMessage,
          );

          if (!claude2.ok) {
            const errBody = claude2.body;
            console.error(
              'Anthropic API error (degree 2):',
              claude2.status,
              errBody,
            );
            return errorResponse('Ranking service temporarily unavailable', 502);
          }

          try {
            degree2Results = parseClaudeJsonArray(claude2.text);
          } catch (e) {
            console.error(
              'Failed to parse Claude JSON (degree 2):',
              e,
              claude2.text.slice(0, 500),
            );
            return errorResponse('Could not parse ranking results', 502);
          }
        }
      }
    }

    return jsonResponse({ ok: true, degree2Results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    console.error('find-housing:', e);
    return errorResponse(msg, 500);
  }
});
