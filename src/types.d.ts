export { };


export interface Asset {
  symbol: string,
  amount: string,
}

export interface Gift {
  sender: string,
  receiver: string,
  datetime: number,
  message: string,
  native: Asset,
  erc20: Asset[],
}

declare global {
  interface Window {
    setGift: (gift: Gift) => void,
  }
}
