# Leaky

가계부 앱

## Tech Stack

- React Native 0.84.0 (Android)
- TypeScript
- React Native Paper (Material Design 3)

## Web (Vercel)

- Next.js (web 폴더)
- Google 로그인만 지원
- 기존 API 서버를 그대로 사용

### Web local run

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

### Web env

`web/.env.local` 파일에 아래 값이 필요합니다.

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

### Vercel deploy

1. Vercel에서 Root Directory를 `web`로 설정
2. Environment Variables에 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 등록
3. Google Cloud OAuth Authorized JavaScript origins에 Vercel 도메인 추가
   - `https://<project>.vercel.app`
   - 커스텀 도메인을 쓰면 그 도메인도 추가

## Run

```bash
npm start
npm run android
```
