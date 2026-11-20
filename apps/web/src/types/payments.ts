export type PaymentRoute = {
  /** Player-safe channel: local_checkout | international_checkout | manual_transfer */
  provider: "local_checkout" | "international_checkout" | "manual_transfer" | string;
  currency: string;
  country_code?: string;
};

export type PaymentBank = {
  id: string;
  provider: string;
  label: string;
  account_name?: string;
  account_number?: string;
  mobile_code?: string;
  currency: string;
};

export type CheckoutResult = {
  intent: {
    id: string;
    amount: number;
    currency: string;
    provider: string;
    tx_ref: string;
    checkout_url?: string;
    status: string;
  };
  route: PaymentRoute;
  banks?: PaymentBank[];
};

/** True when checkout expects bank-transfer + receipt UI (no Paddle/Chapa URL). */
export function isManualCheckoutResult(res: CheckoutResult): boolean {
  const provider = (res.route?.provider || res.intent?.provider || "").trim().toLowerCase();
  if (provider === "manual_transfer" || provider === "manual") return true;
  if ((res.intent?.status || "").trim().toLowerCase() === "awaiting_receipt") return true;
  return (res.banks?.length ?? 0) > 0;
}

export type Wallet = {
  user_id: string;
  balance: number;
  currency: string;
  country_code?: string;
};

export type CheckoutInput = {
  amount: number;
  purpose: string;
  country_code: string;
  return_url?: string;
  email?: string;
};

export type PaymentReceiptInput = {
  amount: number;
  currency?: string;
  receipt_url: string;
  country_code: string;
  /** When set, claim this awaiting_receipt top-up intent (Transactions → Submit proof). */
  intent_id?: string;
};

/** Public geo + payment route fields safe for the player portal. */
export type PayoutMethod = {
  id: string;
  user_id: string;
  provider: string;
  account_name: string;
  phone: string;
  created_at?: string;
  updated_at?: string;
};

export type UpsertPayoutMethodInput = {
  provider: string;
  account_name: string;
  phone: string;
};

export type CreatePayoutRequestInput = {
  amount: number;
  currency: string;
  country_code?: string;
  method_id?: string;
};

export type PayoutRequest = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  phone: string;
  provider: string;
  status: string;
  created_at: string;
};

export type LocateResult = {
  location: {
    country_code: string;
    country_name?: string;
    region?: string;
    city?: string;
  };
  route: {
    provider: string;
    currency: string;
    country_code: string;
  };
};
