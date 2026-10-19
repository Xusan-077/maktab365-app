This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Google orqali kirish (Auth.js)

Login ixtiyoriy: sayt accountsiz ham ishlaydi. Faqat `/kabinet`, `/ustoz`, `/sozlamalar` sessiya talab qiladi (`src/proxy.ts`).

1. `.env.example` ni `.env.local` ga nusxalang.
2. [Google Cloud Console](https://console.cloud.google.com/) da loyiha yarating (yoki mavjudini tanlang).
3. **APIs & Services → OAuth consent screen**: User type — External, ilova nomi va email'ni kiriting. Test rejimida **Test users** ga o'zingizning Google email'ingizni qo'shing.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, turi — **Web application**.
5. **Authorized JavaScript origins**: `http://localhost:3000` (production'da sayt manzili).
6. **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (production'da `https://<domen>/api/auth/callback/google`).
7. Berilgan **Client ID** va **Client secret** ni `.env.local` dagi `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` ga yozing.
8. `AUTH_SECRET` uchun tasodifiy kalit yarating: `npx auth secret` (yoki `openssl rand -base64 32`).
9. `npm run dev` va headerdagi **Kirish** tugmasini bosing.

Rol va profil hozircha mock API orqali brauzer `localStorage` ida saqlanadi (`maktab365-mock-db`); DRF tayyor bo'lganda `HttpApi.saveProfile` / `getMe` yoziladi.

## Deploy (Vercel)

Monorepo: Vercel loyihasida **Root Directory = `frontend`** qilib belgilang. Buyruqlar shu papkada ishlaydi (`npm install`, `npm run dev`, `npm run build`, `npm test`).
