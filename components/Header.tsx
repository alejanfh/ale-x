import Image from "next/image";
import Link from "next/link";
import { SearchModal } from "./SearchModal";
import HeaderButton from "./HeaderButton";
import { getTrendingCoins } from "@/lib/coingecko.actions";

const Header = async () => {
  const trendingCoins = await getTrendingCoins();

  return (
    <header>
      <div className="main-container inner">
        <Link href="/">
          <Image src="/logo.svg" alt="CoinPulse logo" width={132} height={40} />
        </Link>

        <nav>
          <HeaderButton pathnameUrl="/" name="Home" />

          <SearchModal initialTrendingCoins={trendingCoins} />

          <HeaderButton pathnameUrl="/coins" name="All Coins" />
        </nav>
      </div>
    </header>
  );
};

export default Header;
