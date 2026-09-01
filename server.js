// =================================================================
// 🚀 Node.js 실시간 증시 데이터 프록시 서버 (Express + yahoo-finance2)
// =================================================================
// 이 서버는 코스피, S&P500, 삼성전자, SK하이닉스, 대한전선, 삼성SDI의
// 실제 시세를 Yahoo Finance에서 조회하여 프론트엔드 모바일 앱에 JSON으로 제공합니다.

const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CORS 허용 (모바일 앱 웹페이지에서 이 서버의 API를 자유롭게 호출할 수 있도록 설정)
app.use(cors());
app.use(express.json());

// 2. 프론트엔드 종목 Symbol과 Yahoo Finance Symbol 매핑 테이블
// (한국 주식은 종목코드 뒤에 .KS를 붙여야 Yahoo Finance에서 인식합니다)
const SYMBOL_MAP = {
  '^KS11': '^KS11',       // 코스피 지수
  '^GSPC': '^GSPC',       // S&P 500 지수
  '005930': '005930.KS',  // 삼성전자
  '000660': '000660.KS',  // SK하이닉스
  '001440': '001440.KS',  // 대한전선
  '006400': '006400.KS'   // 삼성SDI
};

// 3. 실시간 주가 데이터 조회 API 앤드포인트
app.get('/api/stocks/realtime', async (req, res) => {
  try {
    const yahooSymbols = Object.values(SYMBOL_MAP);
    
    // Yahoo Finance에서 여러 종목 정보를 동시에 조회
    const quotes = await Promise.all(
      yahooSymbols.map(async (sym) => {
        try {
          const result = await yahooFinance.quote(sym);
          return { symbol: sym, data: result };
        } catch (err) {
          console.error(`Error fetching quote for ${sym}:`, err.message);
          return { symbol: sym, data: null };
        }
      })
    );

    // 프론트엔드(index.html)에서 사용하는 데이터 구조에 맞게 파싱 및 정형화
    const responseData = {};

    quotes.forEach(({ symbol, data }) => {
      if (!data) return;

      // Yahoo Symbol을 다시 프론트엔드 코드(005930, ^KS11 등)로 역매핑
      const frontendSymbol = Object.keys(SYMBOL_MAP).find(
        (key) => SYMBOL_MAP[key] === symbol
      );

      if (frontendSymbol) {
        // 현재가, 전일 대비 변동액, 변동률 계산
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

// 4. 서버 기본 루트 앤드포인트 (서버 정상 작동 확인용)
app.get('/', (req, res) => {
  res.send('🚀 주가 모니터링 백엔드 서버가 정상 작동 중입니다!');
});

// 5. 서버 시작
app.listen(PORT, () => {
  console.log(`
  =======================================================
  🚀 주가 모니터링 백엔드 서버가 성공적으로 실행되었습니다!
  📡 API URL: http://localhost:${PORT}/api/stocks/realtime
  =======================================================
  `);
});
