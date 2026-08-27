export type DemoProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  price: number;
  currency: string;
  hasModifiers: boolean;
};

export type DemoBootstrapResponse = {
  enabled: boolean;
  businessId: string;
  businessName: string;
  currency: string;
  logoUrl?: string;
  locations: unknown[];
  products: DemoProduct[];
};
