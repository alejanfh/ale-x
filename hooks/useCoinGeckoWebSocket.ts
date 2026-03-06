import { useEffect, useRef, useState } from "react";

const WS_BASE = `${process.env.NEXT_PUBLIC_COINGECKO_BASE_URL}?x_cg_pro_api_key=${process.env.NEXT_PUBLIC_COINGECKO_API_KEY}`;

export const useCoinGeckoWebSocket = ({
  coinId,
  poolId,
  liveInterval,
}: UseCoinGeckoWebSocketProps): UseCoinGeckoWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const subscribed = useRef(<Set<string>>new Set());

  const [price, setPrice] = useState<ExtendedPriceData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ohlcv, setOhlcv] = useState<OHLCData | null>(null);

  const [isWsReady, setIsWsReady] = useState(false);

  // Sets up the Websocket and make sure it is alive
  useEffect(() => {
    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    const send = (payload: Record<string, unknown>) =>
      ws.send(JSON.stringify(payload));

    const handleMessage = (event: MessageEvent) => {
      const msg: WebSocketMessage = JSON.parse(event.data);

      // Handle ping-pong
      if (msg.type === "ping") {
        send({ type: "pong" });
        return;
      }

      // Subscription confirmation
      if (msg.type === "confirm_subscription") {
        const { channel } = JSON.parse(msg?.identifier ?? " ");

        subscribed.current.add(channel);
      }

      // Price update
      if (msg.c === "C1") {
        setPrice({
          usd: msg.p ?? 0,
          coin: msg.i,
          price: msg.p,
          change24h: msg.pp,
          marketCap: msg.m,
          volume24h: msg.v,
          timestamp: msg.t,
        });
      }

      // Trades update
      if (msg.c === "G2") {
        const newTrade: Trade = {
          price: msg.pu,
          value: msg.vo,
          timestamp: msg.t ?? 0,
          type: msg.ty,
          amount: msg.to,
        };

        setTrades((prev) => [newTrade, ...prev].slice(0, 7));
      }

      // OHLC update (candle)
      if (msg.ch == "G3") {
        const timestamp = msg.t ?? 0;

        const candle: OHLCData = [
          timestamp,
          Number(msg.o ?? 0),
          Number(msg.h ?? 0),
          Number(msg.l ?? 0),
          Number(msg.c ?? 0),
        ];

        setOhlcv(candle);
      }
    };

    ws.onopen = () => setIsWsReady(true);
    ws.onmessage = handleMessage;
    ws.onclose = () => setIsWsReady(false);

    return () => {
      ws.close();
      setIsWsReady(false);
    };
  }, [coinId, poolId]);

  // Connect that websocket and subscribe it to all the different chanels
  useEffect(() => {
    if (!isWsReady) return;

    const ws = wsRef.current;
    if (!ws) return;

    const send = (payload: Record<string, unknown>) =>
      ws.send(JSON.stringify(payload));

    const unsuscribeAll = () => {
      subscribed.current.forEach((channel) => {
        send({
          command: "unsubscribe",
          identifier: JSON.stringify({ channel }),
        });
      });
      subscribed.current.clear();
    };

    const suscribe = (channel: string, data?: Record<string, unknown>) => {
      if (subscribed.current.has(channel)) return;

      send({
        command: "subscribe",
        identifier: JSON.stringify({ channel }),
      });

      if (data) {
        send({
          command: "subscribe",
          identifier: JSON.stringify({ channel }),
          data: JSON.stringify(data),
        });
      }
    };

    // We can reset the local state after the current callstack to avoid
    // mid render updates that can cause bugs
    queueMicrotask(() => {
      setPrice(null);
      setTrades([]);
      setOhlcv(null);

      unsuscribeAll();

      suscribe("CGSimlpePrice", { coin_id: [coinId], action: "set_tokens" });
    });

    const poolAddress = poolId.replace("_", ":");

    if (poolAddress) {
      suscribe("OnchainTrade", {
        "network_id:pool_addresses": [poolAddress],
        action: "set_pools",
      });

      suscribe("OnchainOHLCV", {
        "network_id:pool_addresses": [poolAddress],
        interval: liveInterval,
        action: "set_pools",
      });
    }
  }, [coinId, poolId, liveInterval, isWsReady]);

  return {
    price,
    trades,
    ohlcv,
    isConnected: isWsReady,
  };
};
