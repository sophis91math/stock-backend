const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 매핑 테이블: 프론트엔드 심볼 -> 야후 파이낸스 심볼
const SYMBOL_MAP = {
  '^KS11': '^KS11',       // 코스피 지수
  '^GSPC': '^GSPC',       // S&P 500 지수
  '005930': '005930.KS',  // 삼성전자
  '000660': '000660.KS',  // SK하이닉스
  '001440': '001440.KS',  // 대한전선
  '006400': '006400.KS',  // 삼성SDI
  '047050': '047050.KS'   // 포스코인터내셔널 (추가됨)
};

// Yahoo v8 Chart API를 통해 직접 실시간 데이터 수신
async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo API error for ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();
  const meta = data?.chart?.result?.[0]?.meta;

  if (!meta) {
    throw new Error(`Invalid data structure for ${symbol}`);
  }

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
  const previousClose = meta.chartPreviousClose ?? price;
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  return {
    price,
    change,
    changePercent,
    currency: meta.currency || 'KRW'
  };
}

app.get('/api/stocks/realtime', async (req, res) => {
  try {
    const responseData = {};

    await Promise.all(
      Object.entries(SYMBOL_MAP).map(async ([frontendSymbol, yahooSymbol]) => {
        try {
          const quote = await fetchYahooQuote(yahooSymbol);
          responseData[frontendSymbol] = {
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            currency: quote.currency,
            time: new Date().toISOString()
          };
        } catch (err) {
          console.error(`Error fetching ${frontendSymbol} (${yahooSymbol}):`, err.message);
        }
      })
    );

    console.log(`[${new Date().toLocaleTimeString()}] 📈 실시간 주가 수신 성공 (${Object.keys(responseData).length}개 종목)`);
    res.json(responseData);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '주가 데이터를 가져오는 중 오류가 발생했습니다.' });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 주가 모니터링 백엔드 서버가 정상 작동 중입니다!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
