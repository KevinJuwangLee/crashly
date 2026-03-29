# Crashly 🤝🏠

### An AI agent that finds you trusted, affordable lodging through your network.

⸻

## Inspiration

As students traveling for hackathons like YHack, we quickly realized that finding a place to stay was one of the hardest parts of the experience. Hotels were expensive, often required guests to be 21+, and coordinating with friends or mutual connections was unreliable.

We kept asking: why isn’t there a smarter way to use the college networks we already have?

That idea led us to build Crashly—an AI-powered lodging agent that connects your network with real housing options.

⸻

## Features

🤝 Network-based housing search (friends → mutuals → extended network)
🧠 AI-powered ranking based on trust, compatibility, and preferences
🌐 Fallback to real listings (Airbnb, housing groups, rentals)
💬 AI-generated outreach messages to contact hosts بسهولة
📍 Location-based search with mapping integration
🔒 .edu verification system for trusted student access

⸻

## How It Works
	1.	Enter your destination, dates, and travel purpose
	2.	Crashly’s AI agent searches in three stages:
	•	Direct connections
	•	Friends-of-friends
	•	External housing sources
	3.	Results are ranked and explained based on trust and fit
	4.	Send structured requests to hosts directly in-app

⸻

## Tech Stack
Crashly was built using:
	•	React Native + Expo – mobile frontend
	•	TypeScript – unified codebase
	•	Supabase (Postgres) – database + authentication + messaging
	•	Anthropic API – AI agent (reasoning, ranking, messaging)
	•	Tavily API – real-time web search
	•	Google Places API – location + mapping
	•	Supabase Edge Functions (Deno) – serverless backend logic
	•	GitHub + VS Code – development & collaboration

⸻

## Installation & Running Crashly

To run Crashly locally:
	1.	Clone the repository
	2.	Install dependencies
 
  npm install
  npx expo start

  4.	Open in:
	•	iOS Simulator
	•	Android Emulator
	•	Expo Go (mobile device)

## Demo
https://youtube.com/video/mOG1gWjKqoo 
