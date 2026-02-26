# Leaky

가계부 앱

## Tech Stack

- React Native 0.84.0 (Android)
- TypeScript
- React Native Paper (Material Design 3)

## Web (Vercel)

- Expo Web (React Native Web)
- Google 로그인 지원
- 기존 API 서버를 그대로 사용

### Web local run

```bash
npm install --legacy-peer-deps
npx expo start --web
```

### Web env

루트 `.env` 파일에 아래 값이 필요합니다.

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-api-domain.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

### Vercel deploy

1. Vercel에서 Root Directory를 프로젝트 루트(`/`)로 설정
2. Environment Variables에 `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 등록
3. Google Cloud OAuth Authorized JavaScript origins에 Vercel 도메인 추가
   - `https://<project>.vercel.app`
   - 커스텀 도메인을 쓰면 그 도메인도 추가

## Run

```bash
npm start
npm run android
```
