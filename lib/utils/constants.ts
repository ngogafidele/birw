// Defines the stable store identifier and its human-facing identity.
export const STORE_KEYS = ["store1"] as const

export type StoreKey = (typeof STORE_KEYS)[number]

// Store identity is shared by reports and generated documents.
export const STORE_LABELS: Record<StoreKey, string> = {
  store1: "BIRW INVESTMENT GROUP Ltd",
}

// Customer-facing PDFs identify the store company.
export const STORE_ADDRESSES: Record<StoreKey, string> = {
  store1: "KIGALI/GASABO/GISOZI/GAKIRIRO",
}

export const STORE_TINS: Record<StoreKey, string> = {
  store1: "129103643",
}

export const STORE_PHONES: Record<StoreKey, string> = {
  store1: "0788229874 / 0788737188",
}

export const STORE_EMAILS: Record<StoreKey, string> = {
  store1: "birwgroup2023@gmail.com",
}

export const STORE_BPR_BANK_ACCOUNTS: Record<StoreKey, string> = {
  store1: "4493574895 (Rwf) / 4493947209 (USD)",
}

export const STORE_MOMO_NUMBERS: Record<StoreKey, string> = {
  store1: "0784637231",
}

export const STORE_DOCUMENT_DETAILS: Record<
  StoreKey,
  {
    name: string
    address: string
    tin: string
    phone: string
    email: string
    bprBankAccounts: string
    momo: string
  }
> = {
  store1: {
    name: STORE_LABELS.store1,
    address: STORE_ADDRESSES.store1,
    tin: STORE_TINS.store1,
    phone: STORE_PHONES.store1,
    email: STORE_EMAILS.store1,
    bprBankAccounts: STORE_BPR_BANK_ACCOUNTS.store1,
    momo: STORE_MOMO_NUMBERS.store1,
  },
}
