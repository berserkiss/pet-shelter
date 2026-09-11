# Pet Adoption Platform

Diploma project (Software Engineering for Information Technologies —
Программное обеспечение информационных технологий): a full-stack MERN
platform connecting animal shelters with adopters. Includes AI-assisted pet
breed recognition, a pet-matching recommendation engine, an AI chat
assistant, donations via Stripe, and a full admin panel for shelters.

## Stack

- **Client**: React
- **Server**: Node.js / Express, MongoDB (Mongoose)
- **Storage**: Cloudinary (pet images)
- **Payments**: Stripe
- **AI**: Google Gemini (chat assistant, pet breed recognition, recommendations)
- **Auth**: JWT + Google OAuth, email OTP
- **Deployment**: Docker Compose, nginx reverse proxy with TLS

## Structure

```
diploma_project/
├── client/     # React app
├── server/     # Express API
│   ├── Controller/   # Route handlers (pets, shelters, donations, AI chat, admin, ...)
│   ├── Model/        # Mongoose schemas
│   ├── Routes/       # Express routers
│   ├── Middleware/   # Auth guards
│   └── services/     # AI recognition/recommendation, donation scheduling, cloudinary
├── nginx/      # Reverse proxy config, Dockerfile, TLS cert generation
└── docker-compose.yml
```

## Features

- Pet listings with filtering, comparison, and favorites
- Adoption request forms and shelter-side review workflow
- AI pet breed recognition from photos
- AI-driven pet recommendations based on user preferences
- AI chat assistant for adopters
- Donations (one-off and scheduled) via Stripe
- Volunteer applications
- Pet care calendar
- Admin panel: user/shelter/pet/volunteer management, dashboard
- Email OTP verification, Google OAuth login

## Local development

### With Docker Compose (recommended)

```bash
cp .env.example .env   # fill in real values
docker compose up --build
```

Services: client on `:3000`, server on `:4000`, MongoDB on `:27017`, nginx
proxy on `:18080`/`:18443`.

### Without Docker

```bash
# server
cd server
cp .env.example .env   # fill in real values
npm install
npm run dev

# client
cd client
cp .env.example .env   # fill in real values
npm install
npm start
```

## Environment variables

See `.env.example` (root, `client/`, `server/`) for the full list — MongoDB
connection, session secret, email (Gmail App Password), Stripe keys, Google
OAuth client ID, Gemini API key, and Cloudinary credentials. None of these
are committed; generate/obtain your own.

## Not tracked in this repo

- `node_modules/`
- `.env` files (real credentials — see `.env.example` for the shape)
- `docs/`, `diagrams/`, `pptx_unpacked/`, `extracted_images/`, `tools/` — thesis
  writing/diagram-generation material, not application source
