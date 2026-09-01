const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;

// Yahoo Finance 경고 및 모듈 설정
yahooFinance.suppressNotices(['yahooSurvey']);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const SYMBOL_MAP = {
  '^KS11': '^KS11',       // 코스피 지수
  '^GSPC': '^GSPC',       // S&P 500 지수
  '005930': '005930.KS',  // 삼성전자
  '000660': '000660.KS',  // SK하이닉스
  '001440': '001440.KS',  // 대한전선
  '006400': '006400.KS'   // 삼성SDI
};

app.get('/api/stocks/realtime', async (req, res) => {
  try {
    const yahooSymbols = Object.values(SYMBOL_MAP);
    
    const quotes = await Promise.all(
      yahooSymbols.map(async (sym) => {
        try {
          // fetchOptions 추가하여 브라우저 요청처럼 위장
          const result = await yahooFinance.quote(sym, {}, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          return { symbol: sym, data: result };
        } catch (err) {
          console.error(`Error fetching quote for ${sym}:`, err.message);
          return { symbol: sym, data: null };
        }
      })
    );

    const responseData = {};

    quotes.forEach(({ symbol, data }) => {
      if (!data) return;

      const frontendSymbol = Object.keys(SYMBOL_MAP).find(
        (key) => SYMBOL_MAP[key] === symbol
      );

      if (frontendSymbol) {
        const regularMarketPrice = data.regularMarketPrice || 0;
        const regularMarketChange = data.regularMarketChange || 0;
        const regularMarketChangePercent = data.regularMarketChangePercent || 0;

        responseData[frontendSymbol] = {
          price: regularMarketPrice,
          change: regularMarketChange,
          changePercent: regularMarketChangePercent,
          currency: data.currency || (symbol.includes('.KS') || symbol === '^KS11' ? 'KRW' : 'USD'),
          time: new Date().toISOString()
        };
      }
    });

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
