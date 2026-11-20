export type CreateBankInput = {
  provider: string;
  label: string;
  account_name?: string;
  account_number?: string;
  mobile_code?: string;
  currency: string;
};

export type UpdateBankInput = CreateBankInput & {
  is_active: boolean;
};

export type PaymentRoute = {
  /** Player-safe channel labels (internal gateways are not returned on public routes). */
  provider: "local_checkout" | "international_checkout" | "manual_transfer" | string;
  currency: string;
  country_code?: string;
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
  banks?: Array<{
    id: string;
    provider: string;
    label: string;
    account_name?: string;
    account_number?: string;
    mobile_code?: string;
    currency: string;
  }>;
};
