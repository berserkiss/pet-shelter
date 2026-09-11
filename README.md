# Pet Adoption Platform

This is my diploma project (Software Engineering for Information Technologies,
"Программное обеспечение информационных технологий"). It's a full-stack MERN
app that connects animal shelters with people looking to adopt. It can
recognize a pet's breed from a photo, recommend pets based on what you like,
chat with adopters through an AI assistant, take donations through Stripe,
and gives shelters a full admin panel to run things.

## Stack

- **Client**: React
- **Server**: Node.js / Express, MongoDB (Mongoose)
- **Storage**: Cloudinary (pet images)
- **Payments**: Stripe
- **AI**: Google Gemini (chat assistant, breed recognition, recommendations)
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
- Adoption request forms and a shelter-side review workflow
- AI breed recognition from photos
- AI-driven pet recommendations based on user preferences
- AI chat assistant for adopters
- Donations (one-off and scheduled) via Stripe
- Volunteer applications
- Pet care calendar
- Admin panel for managing users, shelters, pets, and volunteers, plus a dashboard
- Email OTP verification and Google OAuth login

## Local development

### With Docker Compose (recommended)

```bash
cp .env.example .env   # fill in real values
docker compose up --build
```

This starts the client on `:3000`, the server on `:4000`, MongoDB on
`:27017`, and the nginx proxy on `:18080`/`:18443`.

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

Check `.env.example` (root, `client/`, `server/`) for the full list: MongoDB
connection string, session secret, email (Gmail App Password), Stripe keys,
Google OAuth client ID, Gemini API key, and Cloudinary credentials. None of
this is committed, so you'll need to generate or grab your own values.

## Not tracked in this repo

- `node_modules/`
- `.env` files (real credentials, see `.env.example` for the shape)
- `docs/`, `diagrams/`, `pptx_unpacked/`, `extracted_images/`, `tools/`: thesis
  writing and diagram-generation material, not application source
