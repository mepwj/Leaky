import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth';
import transactionRouter from './routes/transaction';
import categoryRouter from './routes/category';
import assetRouter from './routes/asset';
import holidayRouter from './routes/holiday';
import budgetRouter from './routes/budget';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 미들웨어
app.use(cors());
app.use(express.json());

// APK 다운로드 파일 제공
const downloadsDir = path.join(__dirname, '../public');
app.use('/downloads', express.static(downloadsDir));

// 헬스 체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 라우트
app.use('/auth', authRouter);
app.use('/transactions', transactionRouter);
app.use('/categories', categoryRouter);
app.use('/assets', assetRouter);
app.use('/holidays', holidayRouter);
app.use('/budgets', budgetRouter);

// 404 핸들러
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// 전역 에러 핸들러
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Leaky API server running on http://localhost:${PORT}`);
});

export default app;
