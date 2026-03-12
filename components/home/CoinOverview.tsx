/* eslint-disable react-hooks/error-boundaries */
import { fetcher } from "@/lib/coingecko.actions";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";
import CandlestickChart from "../CandlestickChart";

const CoinOverview = async () => {
  try {
    const [coin, coinOHLCData] = await Promise.all([
      fetcher<CoinDetailsData>("/coins/bitcoin", {
        dex_pair_format: "symbol",
      }),
      fetcher<OHLCData[]>("/coins/bitcoin/ohlc", {
        vs_currency: "usd",
        days: 1,
        precision: "full",
      }),
    ]);

    return (
      <div id="coin-overview">
        <CandlestickChart
          data={coinOHLCData}
          coinId="bitcoin"
          liveOhlcv={undefined}
          liveInterval={undefined}
          setLiveInterval={undefined}
        >
          {" "}
          <div className="header pt-2">
            <Image
              src={coin.image.large}
              alt={coin.name}
              width={56}
              height={56}
            />
            <div className="info">
              <p>
                {coin.name} / {coin.symbol.toUpperCase()}
              </p>
              <h1>{formatCurrency(coin.market_data.current_price.usd)}</h1>
            </div>
          </div>{" "}
        </CandlestickChart>
      </div>
    );
  } catch (error) {
    console.error("Error fetching coin overview:", error);
    return <div>Loading Trending Coins...</div>;
  }
};

export default CoinOverview;
