<img width="250" height="250" alt="Screenshot 2026-03-29 at 10 47 20 AM" src="https://github.com/user-attachments/assets/d92d475f-51e4-405a-a867-1cb24289ff17" />


# Crashly 🤝🏠

### An AI agent that finds you trusted, affordable lodging through your network.

## Inspiration

As students traveling for hackathons like YHack, we quickly realized that finding a place to stay was one of the hardest parts of the experience. Hotels were expensive, often required guests to be 21+, and coordinating with friends or mutual connections was unreliable.

We kept asking: *Why isn’t there a smarter way to use the college networks we already have?*

That idea led us to build Crashly—an AI-powered lodging agent that connects your network with real housing options

## Features

- 🤝 Network-based housing search (friends → mutuals → extended network)
- 🧠 AI-powered ranking based on trust, compatibility, and preferences
- 🌐 Fallback to real listings (Airbnb, housing groups, rentals)
- 💬 AI-generated outreach messages to contact hosts بسهولة
- 📍 Location-based search with mapping integration
- 🔒 .edu sign-up system for trusted student access

## How It Works
1.	Enter your destination, dates, and travel purpose
2.	Crashly’s AI agent searches in three stages:
	- a. Direct connections
	- b. Friends-of-friends
	- c. External housing sources
3.	Results are ranked and explained based on trust and fit
4.	Send structured requests to hosts directly in-app
5.	Manage your inbox chats and upcoming trips 

## Tech Stack
Crashly was built using:
-	React Native + Expo – mobile frontend
-	TypeScript – unified codebase
-	Supabase (Postgres) – database + authentication + messaging
-	Anthropic API – AI agent (reasoning, ranking, messaging)
-	Tavily API – real-time web search
-	Google Places API – location + mapping
-	Supabase Edge Functions (Deno) – serverless backend logic
-	GitHub + VS Code – development & collaboration


## Installation & Running Crashly
To run Crashly locally:
1. Clone the repository  
2. Install dependencies  
```bash
npm install
```
3. Set up Supabase  
- Create a project on Supabase  
- Set up your database schema (users, connections, trips, messaging)  
- Copy your **Project URL** and **Anon Public Key**
4. Set up environment variables  
Create a `.env` file in the root directory and add:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
ANTHROPIC_API_KEY=your_anthropic_api_key
TAVILY_API_KEY=your_tavily_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```
5. Start the Expo server  
```bash
npx expo start
```
6. Open in:
- iOS Simulator  
- Android Emulator  
- Expo Go (mobile device)   

### [Click here to watch our Demo Video](https://youtube.com/video/mOG1gWjKqoo)
