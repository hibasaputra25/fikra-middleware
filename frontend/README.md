# Fikra Academy Frontend

Platform persiapan SNBT/UTBK — Fikra Academy.

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS
- Recharts
- Zustand
- Lucide React Icons
- Axios

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

3. Run development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Structure

```
src/
├── app/
│   ├── login/          Login page
│   ├── siswa/          Student panel
│   ├── guru/           Teacher panel
│   └── admin/          Admin panel
├── components/
│   ├── ui/             Reusable UI components
│   └── layout/         Layout components (Navbar, Container, AuthGuard)
├── lib/
│   ├── api.ts          API client & endpoints
│   └── utils.ts        Helper functions
└── stores/
    ├── authStore.ts    Authentication state
    └── chatStore.ts    Chat state
```

## Roles

| Role | Path | Description |
|------|------|-------------|
| Siswa | `/siswa/*` | Dashboard, tryout, hasil, ranking, riwayat, chat AI |
| Guru | `/guru/*` | Overview kelas, monitoring siswa, statistik tryout |
| Admin | `/admin/*` | System overview, user management, settings |

## Design Tokens

- Primary: `#01c058`
- Secondary: `#0099cc`
- Font: Inter
- Max container width: 1200px
